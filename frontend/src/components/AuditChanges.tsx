import React from 'react';
import { useLanguage } from '../context/LanguageContext';

export const AuditChanges: React.FC<{ before?: string; after?: string }> = ({ before, after }) => {
  const { t } = useLanguage();
  const parse = (value?: string): Record<string, unknown> => { try { const parsed = JSON.parse(value || '{}'); return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : { value: parsed }; } catch { return { value }; } };
  const previous = parse(before), next = parse(after);
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter(key => JSON.stringify(previous[key]) !== JSON.stringify(next[key]));
  const labels: Record<string, string> = { firstEntry: 'detail.entry', mealExit: 'detail.mealExit', mealReturn: 'detail.mealReturn', lastExit: 'detail.exit', status: 'common.status', modificationReason: 'incidents.reason', minutesWorked: 'detail.worked', minutesLate: 'detail.late', deviceIp: 'audit.deviceIp', branchName: 'common.branch', persistedCount: 'audit.newPunches', duplicateCount: 'audit.duplicates' };
  const display = (value: unknown) => value == null ? '—' : typeof value === 'object' ? JSON.stringify(value) : typeof value === 'boolean' ? t(value ? 'audit.yes' : 'audit.no') : String(value);
  return <div>
    <div className="space-y-3">{keys.map(key => <div key={key} className="rounded-xl border border-[#DFE7EB] p-4"><h4 className="mb-3 text-sm font-semibold">{labels[key[0].toLowerCase() + key.slice(1)] ? t(labels[key[0].toLowerCase()+key.slice(1)]) : key.replace(/([a-z])([A-Z])/g, '$1 $2')}</h4><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div className="break-words text-sm"><span className="mb-1 block text-xs text-[#60727E]">{t('audit.oldValue')}</span>{display(previous[key])}</div><div className="break-words text-sm text-[#00695F]"><span className="mb-1 block text-xs text-[#60727E]">{t('audit.newValue')}</span>{display(next[key])}</div></div></div>)}</div>
    {!keys.length && <p className="text-sm text-[#60727E]">{t('audit.noChanges')}</p>}
    <details className="wpc-disclosure mt-4"><summary>{t('audit.technicalJson')}</summary><div className="grid gap-3 sm:grid-cols-2"><pre className="overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(previous,null,2)}</pre><pre className="overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-50 p-3 text-xs">{JSON.stringify(next,null,2)}</pre></div></details>
  </div>;
};
