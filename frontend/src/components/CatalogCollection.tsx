import React from 'react';
import { Edit3, Eye, MoreHorizontal, Trash2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

export interface CatalogRow {
  id: number;
  name: string;
  code: string;
  status?: string;
  fields: { label: string; value: React.ReactNode }[];
  secondary?: { label: string; value: React.ReactNode }[];
  source: any;
}

export const CatalogCollection: React.FC<{
  rows: CatalogRow[];
  mode: 'grid' | 'table';
  permission?: string;
  onView?: (row: any) => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onToggle?: (row: any) => void;
}> = ({ rows, mode, permission, onView, onEdit, onDelete, onToggle }) => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const canManage = !permission || user?.roles?.some(role => ['SUPERADMIN','ADMIN','ADMIN_SUCURSAL'].includes(role)) || user?.permissions?.includes(permission);
  const status = (row: CatalogRow) => row.status ? <span className={`wpc-status wpc-status-${row.status === 'Active' ? 'OnTime' : 'Unknown'}`}>{row.status === 'Active' ? t('common.active') : row.status === 'Inactive' ? t('common.inactive') : row.status}</span> : null;
  const actions = (row: CatalogRow) => <div className="flex flex-wrap items-center gap-1">
    {onView && <button className="wpc-icon-button" type="button" onClick={() => onView(row.source)} aria-label={`${t('dashboard.detail')}: ${row.name}`} title={t('dashboard.detail')}><Eye size={19} /></button>}
    {canManage && onEdit && <button className="wpc-icon-button" type="button" onClick={() => onEdit(row.source)} aria-label={`${t('common.edit')}: ${row.name}`} title={t('common.edit')}><Edit3 size={18} /></button>}
    {canManage && onDelete && <button className="wpc-icon-button" type="button" onClick={() => onDelete(row.source)} aria-label={`${t('common.delete')}: ${row.name}`} title={t('common.delete')}><Trash2 size={18} /></button>}
    {canManage && onToggle && <details className="relative"><summary className="wpc-icon-button list-none" aria-label={`${t('catalog.more')}: ${row.name}`}><MoreHorizontal size={20} /></summary><button type="button" className="absolute bottom-full right-0 z-20 w-44 rounded-lg border border-[#DFE7EB] bg-white p-3 text-left text-sm shadow-lg" onClick={() => onToggle(row.source)}>{row.status === 'Active' ? t('catalog.deactivate') : t('catalog.activate')}</button></details>}
  </div>;
  const cards = <div className={mode === 'grid' ? 'grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3' : 'wpc-mobile-list'}>
    {rows.map(row => <article key={row.id} className="wpc-list-card">
      <div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E6F2F0] font-semibold text-[#00695F]" aria-hidden="true">{row.name.split(/\s+/).map(word => word[0]).slice(0,2).join('')}</span><div className="min-w-0 flex-1"><h3>{row.name}</h3><p className="wpc-card-meta font-mono">{row.code}</p></div></div>
      <dl className="mt-4 space-y-2">{row.fields.map(field => <div key={field.label} className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm"><dt className="text-[#60727E]">{field.label}</dt><dd className="min-w-0 break-words font-medium text-[#203441]">{field.value ?? '—'}</dd></div>)}</dl>
      {!!row.secondary?.length && <details className="wpc-disclosure mt-3"><summary>{t('catalog.moreInformation')}</summary><dl className="wpc-disclosure-body space-y-2">{row.secondary.map(field => <div key={field.label}><dt>{field.label}</dt><dd className="font-medium text-[#203441]">{field.value ?? '—'}</dd></div>)}</dl></details>}
      <div className="wpc-card-footer">{status(row)}{actions(row)}</div>
    </article>)}
  </div>;
  if (mode === 'grid') return cards;
  return <>{cards}<div className="wpc-desktop-list overflow-x-auto rounded-xl border border-[#DFE7EB] bg-white"><table className="w-full text-left"><thead className="bg-[#F4F7F8] text-[#60727E]"><tr><th className="p-4">{t('common.name')}</th>{rows[0]?.fields.map(field => <th key={field.label} className="p-4">{field.label}</th>)}<th className="p-4">{t('common.status')}</th><th className="p-4"><span className="sr-only">{t('common.actions')}</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.id} className="border-t border-[#DFE7EB] hover:bg-slate-50"><td className="p-4"><strong className="block">{row.name}</strong><span className="text-xs text-[#60727E]">{row.code}</span>{!!row.secondary?.length && <details className="mt-2"><summary className="cursor-pointer text-xs text-[#00695F]">{t('catalog.moreInformation')}</summary>{row.secondary.map(field => <p key={field.label} className="mt-2 text-sm">{field.label}: {field.value ?? '—'}</p>)}</details>}</td>{row.fields.map(field => <td className="p-4" key={field.label}>{field.value ?? '—'}</td>)}<td className="p-4">{status(row)}</td><td className="p-2">{actions(row)}</td></tr>)}</tbody></table></div></>;
};
