// Mechanical migration of existing bilingual literals. Calendar and its shell are excluded.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const localePaths = ['es-MX', 'zh-CN'].map(lang => path.join(root, `src/locales/${lang}.json`));
const [es, zh] = localePaths.map(file => JSON.parse(fs.readFileSync(file, 'utf8')));
const pages = ['Dashboard', 'Devices', 'Employees', 'Branches', 'Schedules', 'Incidents', 'Reports', 'Audit', 'Users', 'Settings'];
let migrated = 0;
for (const page of pages) {
  const file = path.join(root, `src/pages/${page}Page.tsx`);
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = node => {
    if (ts.isConditionalExpression(node) && ts.isStringLiteral(node.whenTrue) && ts.isStringLiteral(node.whenFalse)) {
      const condition = node.condition.getText(source).replaceAll(' ', '');
      if (condition === 'isZh' || condition === "language==='zh-CN'" || condition === 'language==="zh-CN"') {
        const chinese = node.whenTrue.text;
        const spanish = node.whenFalse.text;
        if (chinese !== spanish) {
          const stem = spanish.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().split(/\s+/).slice(0, 6).join('_').toLowerCase() || 'label';
          let key = `${page.toLowerCase()}.ui_${stem}`;
          let suffix = 2;
          while (es[key] && (es[key] !== spanish || zh[key] !== chinese)) key = `${page.toLowerCase()}.ui_${stem}_${suffix++}`;
          es[key] = spanish;
          zh[key] = chinese;
          edits.push({ start: node.getStart(source), end: node.end, value: `t('${key}')` });
          migrated++;
          return;
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  let output = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
  if (edits.length) fs.writeFileSync(file, output);
}
localePaths.forEach((file, index) => fs.writeFileSync(file, JSON.stringify(index ? zh : es, null, 2) + '\n'));
console.log(`Migrated ${migrated} existing bilingual literals. Calendar excluded.`);
