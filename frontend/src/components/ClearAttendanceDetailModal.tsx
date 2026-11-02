import React, { useEffect, useRef, useState } from 'react';
import { Building2, Calendar, Coffee, LogIn, LogOut, UtensilsCrossed, X, Edit3 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import '../styles/clear-cards.css';

export const ClearAttendanceDetailModal: React.FC<{
  record: any;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenAudit?: (record: any) => void;
}> = ({ record, onClose, onOpenAudit }) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const panel = useRef<HTMLDivElement>(null);
  const [evidence, setEvidence] = useState<any[] | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceFailed, setEvidenceFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const recordDate = (record?.date || record?.attendanceDate || '').split('T')[0];
  useEffect(() => {
    setEvidence(null);
    setEvidenceFailed(false);
    setEvidenceLoading(false);
    if (Array.isArray(record?.punches) || !record?.id || !recordDate) return;
    let cancelled = false;
    setEvidenceLoading(true);
    // This endpoint supplies the existing backend shift window, including overnight shifts.
    // Only enrich evidence: never replace the daily totals or classification being reviewed.
    api.get('/v1/dashboard/day-detail', { params: { date: recordDate } })
      .then(response => {
        const detail = response.data?.records?.find((item: any) => item.id === record.id);
        if (!cancelled) setEvidence(Array.isArray(detail?.punches) ? detail.punches : []);
      })
      .catch(() => { if (!cancelled) setEvidenceFailed(true); })
      .finally(() => { if (!cancelled) setEvidenceLoading(false); });
    return () => { cancelled = true; };
  }, [record?.id, record?.punches, recordDate, attempt]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>('button, summary, a[href], input, select, textarea, [tabindex="0"]');
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [onClose]);
  if (!record) return null;
  const time = (value?: string | null) => !value || ['-', '--:--'].includes(value) ? '—' : (value.includes('T') ? value.split('T')[1] : value).slice(0, 5);
  const duration = (value: number | null | undefined) => {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
    const minutes = Math.round(Number(value));
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return hours ? `${hours} ${t('detail.hourUnit')}${remainder ? ` ${remainder} ${t('detail.minuteUnit')}` : ''}` : `${minutes} ${t('detail.minuteUnit')}`;
  };
  const statusKeys: Record<string, string> = { OnTime: 'onTime', Late: 'late', Absent: 'absent', Incomplete: 'incomplete', EarlyExit: 'earlyExit', RestDay: 'restDay', Holiday: 'holiday', Vacation: 'vacation', Permission: 'permission', Disability: 'disability' };
  const status = statusKeys[record.status] ? t(`status.${statusKeys[record.status]}`) : record.status || t('common.notAvailable');
  const punches = Array.isArray(record.punches) ? record.punches : evidence || [];
  const methodValues = punches.map((p: any) => p.method).filter(Boolean);
  const methods = Array.from(new Set(methodValues.length ? methodValues : record.method ? [record.method] : []));
  const origins: Record<string, string> = { INFERRED: 'detail.inferredOrigin', INFERRED_WINDOW: 'detail.inferredOrigin', DEVICE_CODE: 'detail.deviceOrigin', MANUAL: 'detail.manualOrigin' };
  const date = (record.date || record.attendanceDate || '').split('T')[0];
  const canEdit = user?.roles?.some(role => ['SUPERADMIN', 'ADMIN', 'ADMIN_SUCURSAL', 'RH'].includes(role)) || user?.permissions?.includes('incidents.manage');
  const slots = [
    { key: 'entry', value: record.firstEntry, icon: LogIn },
    { key: 'mealExit', value: record.mealExit, icon: UtensilsCrossed },
    { key: 'mealReturn', value: record.mealReturn, icon: Coffee },
    { key: 'exit', value: record.lastExit, icon: LogOut },
  ];
  return (
    <div className="wpc-modal-backdrop wpc-design" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={panel} className="wpc-detail" role="dialog" aria-modal="true" aria-labelledby="daily-detail-title" tabIndex={-1}>
        <header className="wpc-detail-header">
          <div className="min-w-0">
            <p className="wpc-eyebrow">#{record.employeeCode || '—'}</p>
            <h2 id="daily-detail-title">{record.employeeName || t('dashboard.employee')}</h2>
            <div className="wpc-detail-meta"><span><Calendar size={16} />{date || '—'}</span><span><Building2 size={16} />{record.branchName || t('common.notAvailable')}</span></div>
            <span className={`wpc-status wpc-status-${record.status || 'Unknown'}`}>{status}</span>
          </div>
          <button type="button" onClick={onClose} aria-label={t('common.close')} className="wpc-icon-button"><X size={22} /></button>
        </header>
        <div className="wpc-detail-body">
          <div className="wpc-punch-grid">
            {slots.map(({ key, value, icon: Icon }) => <div className="wpc-punch" key={key}><span><Icon size={18} />{t(`detail.${key}`)}</span><strong>{time(value)}</strong></div>)}
          </div>
          <div className="wpc-results">
            <div><span>{t('detail.worked')}</span><strong>{duration(record.minutesWorked)}</strong></div>
            <div><span>{t('detail.late')}</span><strong>{record.minutesLate === null || record.minutesLate === undefined ? '—' : `${record.minutesLate} ${t('detail.minuteUnit')}`}</strong></div>
          </div>
          {record.requiresReview && <p className="wpc-review-note">{record.reviewNotes || t('detail.reviewPending')}</p>}
          {evidenceLoading && <p role="status" className="mb-3 text-sm text-[#60727E]">{t('common.loading')}</p>}
          {evidenceFailed && <div role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800"><p>{t('detail.evidenceError')}</p><button type="button" className="wpc-secondary mt-2" onClick={() => setAttempt(value => value + 1)}>{t('common.retry')}</button></div>}
          <details className="wpc-disclosure"><summary>{t('detail.punchOrigin')}</summary><div className="wpc-disclosure-body">
            {!!punches.length && <p className="mb-2">{t('detail.evidenceWindow')}</p>}
            {punches.length ? punches.map((p: any, index: number) => <div className="wpc-origin-row" key={p.id || index}><strong>{p.timestamp || p.time || '—'}</strong><span>{p.deviceName || p.deviceCode || t('common.notAvailable')}</span><span>{p.branchName || '—'}</span></div>) : <p>{origins[record.classificationOrigin || record.origin] ? t(origins[record.classificationOrigin || record.origin]) : record.classificationOrigin || record.origin || t('detail.noOrigin')}</p>}
          </div></details>
          <details className="wpc-disclosure"><summary>{t('detail.methods')}</summary><div className="wpc-disclosure-body">
            {methods.map((method: any) => <p key={method}>{['Face', 'Fingerprint', 'Card', 'Pin', 'PIN'].includes(method) ? t(`dashboard.method${method === 'PIN' ? 'Pin' : method}`) : method === 'Sin información' ? t('common.notAvailable') : method === 'Varios' ? t('detail.multipleMethods') : method}</p>)}
            {!methods.length && <p>{t('common.notAvailable')}</p>}
          </div></details>
          <details className="wpc-disclosure"><summary>{t('detail.changeHistory')}</summary><div className="wpc-disclosure-body">
            {record.isManualOverride ? <><p>{record.modifiedBy || t('common.notAvailable')} · {record.modifiedAt ? new Date(record.modifiedAt).toLocaleString(language) : '—'}</p><p>{record.modificationReason || record.manualOverrideReason || t('common.notAvailable')}</p></> : <p>{t('detail.noChanges')}</p>}
          </div></details>
          <details className="wpc-disclosure"><summary>{t('detail.technical')}</summary><div className="wpc-disclosure-body"><p>{t('detail.recordId')}: {record.id ?? '—'}</p><p>{t('detail.mealDeduction')}: {record.mealDurationMinutes === null || record.mealDurationMinutes === undefined ? t('common.notAvailable') : `${record.mealDurationMinutes} ${t('detail.minuteUnit')}`}</p></div></details>
        </div>
        <footer className="wpc-detail-footer">
          {canEdit && onOpenAudit && <button type="button" className="wpc-secondary" onClick={() => { onClose(); onOpenAudit(record); }}><Edit3 size={18} />{t('detail.justify')}</button>}
          <button type="button" className="wpc-primary" onClick={onClose}>{t('common.close')}</button>
        </footer>
      </div>
    </div>
  );
};
