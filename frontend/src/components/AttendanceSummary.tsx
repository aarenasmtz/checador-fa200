import React from 'react';
import { Eye } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { EmptyState } from './AsyncState';

export const AttendanceSummary: React.FC<{ items: any[]; onDetail: (record: any) => void }> = ({ items, onDetail }) => {
  const { t } = useLanguage();
  const slots = ['entry', 'mealExit', 'mealReturn', 'exit'];
  const fields = ['firstEntry', 'mealExit', 'mealReturn', 'lastExit'];
  const time = (value?: string) => !value || value === '-' || value === '--:--' ? '—' : (value.includes('T') ? value.split('T')[1] : value).slice(0, 5);
  const worked = (row: any) => row.minutesWorked == null ? '—' : `${Math.floor(row.minutesWorked / 60)} ${t('detail.hourUnit')} ${row.minutesWorked % 60} ${t('detail.minuteUnit')}`;
  const status = (value: string) => {
    const names: Record<string, string> = { OnTime: 'onTime', Late: 'late', Absent: 'absent', Incomplete: 'incomplete', EarlyExit: 'earlyExit', RestDay: 'restDay', Holiday: 'holiday', Vacation: 'vacation', Permission: 'permission', Disability: 'disability' };
    return <span className={`wpc-status wpc-status-${value}`}>{names[value] ? t(`status.${names[value]}`) : value || '—'}</span>;
  };
  const detail = (row: any) => <button type="button" className="wpc-icon-button" title={t('dashboard.viewDailyCard')} aria-label={`${t('dashboard.detail')}: ${row.employeeName}`} onClick={() => onDetail(row)}><Eye size={20} /></button>;
  if (!items.length) return <EmptyState />;
  return <div className="wpc-design wpc-summary-list">
    <div className="wpc-summary-desktop overflow-x-auto">
      <table className="w-full text-left"><thead><tr><th>{t('dashboard.employee')}</th>{slots.map(slot => <th key={slot}>{t(`detail.${slot}`)}</th>)}<th>{t('detail.worked')}</th><th>{t('detail.late')}</th><th>{t('common.status')}</th><th><span className="sr-only">{t('common.actions')}</span></th></tr></thead>
        <tbody>{items.map(row => <tr key={row.id}><td><strong>{row.employeeName}</strong><small>#{row.employeeCode} · {row.branchName}<br />{row.date?.split('T')[0]}</small></td>{fields.map(field => <td className="font-mono" key={field}>{time(row[field])}</td>)}<td>{worked(row)}</td><td>{row.minutesLate == null ? '—' : `${row.minutesLate} ${t('detail.minuteUnit')}`}</td><td>{status(row.status)}{row.isManualOverride && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-500" title={t('detail.changeHistory')} />}</td><td>{detail(row)}</td></tr>)}</tbody>
      </table>
    </div>
    <div className="wpc-summary-mobile">{items.map(row => <article key={row.id} className="wpc-list-card">
      <div className="flex items-start justify-between gap-2"><div><h3>{row.employeeName}</h3><p className="wpc-card-meta">#{row.employeeCode} · {row.date?.split('T')[0]}<br />{row.branchName}</p></div>{detail(row)}</div>
      <div className="wpc-punch-grid mt-4">{fields.map((field,index) => <div key={field} className="wpc-summary-time"><span>{t(`detail.${slots[index]}`)}</span><strong>{time(row[field])}</strong></div>)}</div>
      <div className="wpc-card-footer"><span>{worked(row)}<br /><small>{t('detail.late')}: {row.minutesLate == null ? '—' : `${row.minutesLate} ${t('detail.minuteUnit')}`}</small></span>{status(row.status)}</div>
    </article>)}</div>
  </div>;
};
