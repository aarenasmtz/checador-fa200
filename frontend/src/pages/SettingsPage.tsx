import React, { useEffect, useState } from 'react';
import { Settings, CheckSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import api from '../api/client';

const CHECKLIST_IDS = Array.from({ length: 6 }, (_, category) =>
  Array.from({ length: 5 }, (_, item) => `c${category + 1}-${item + 1}`));

export const SettingsPage: React.FC = () => {
  const { t } = useLanguage();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('fa200_checklist') || '{}'); } catch { return {}; }
  });
  const [devices, setDevices] = useState<any[] | null>(null);
  const [failed, setFailed] = useState(false);
  const loadDevices = () => {
    setFailed(false);
    api.get('/v1/devices').then(response => setDevices(response.data || [])).catch(() => setFailed(true));
  };
  useEffect(() => { loadDevices(); }, []);
  const completed = CHECKLIST_IDS.flat().filter(id => checkedItems[id]).length;
  const toggle = (id: string) => {
    const next = { ...checkedItems, [id]: !checkedItems[id] };
    setCheckedItems(next); localStorage.setItem('fa200_checklist', JSON.stringify(next));
  };
  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="flex items-center gap-3 font-bold"><Settings className="text-[#00695F]" />{t('settings.pageTitle')}</h1>
      <Link to="/devices" className="wpc-primary">{t('settings.openDevices')}</Link>
    </div>
    <section className="rounded-xl border border-[#DFE7EB] bg-white p-5">
      <h2 className="text-lg font-bold">{t('settings.currentConnection')}</h2>
      {failed ? <div className="mt-3"><p>{t('common.loadErrorDescription')}</p><button className="wpc-secondary mt-2" onClick={loadDevices}>{t('common.retry')}</button></div>
        : !devices ? <p className="mt-3 text-[#60727E]">{t('common.loading')}</p>
        : devices.length === 0 ? <p className="mt-3 text-[#60727E]">{t('common.emptyTitle')}</p>
        : <div className="mt-4 grid gap-3 sm:grid-cols-2">{devices.map(device => <div key={device.id} className="flex items-start justify-between gap-3 border-t border-[#DFE7EB] py-3"><div><strong>{device.name}</strong><p className="text-sm text-[#60727E]">{device.branchName}</p></div><span className={`wpc-status wpc-status-${device.status === 'Online' ? 'OnTime' : 'Unknown'}`}>{device.status === 'Online' ? t('settings.online') : device.status === 'Offline' || device.status === 'Error' ? t('settings.offline') : t('settings.unknown')}</span></div>)}</div>}
    </section>
    <details className="wpc-disclosure rounded-xl border border-[#DFE7EB] bg-white px-5">
      <summary>{t('settings.historicalPilot')}</summary>
      <p className="wpc-disclosure-body">{t('settings.historicalDescription')}</p>
    </details>
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold"><CheckSquare size={20} />{t('settings.protocol')}</h2><span className="text-sm text-[#60727E]">{completed} / 30 · {t('settings.localProgress')}</span></div>
      <progress className="mb-4 h-2 w-full accent-[#00695F]" value={completed} max={30} aria-label={t('settings.protocol')} />
      <div className="space-y-3">{CHECKLIST_IDS.map((ids,index) => <details key={index} className="rounded-xl border border-[#DFE7EB] bg-white p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold">{t(`settings.category${index+1}`)}<span className="float-right text-sm text-[#60727E]">{ids.filter(id => checkedItems[id]).length} / 5</span></summary><div className="divide-y divide-[#DFE7EB]">{ids.map(id => <label key={id} className="flex cursor-pointer items-start gap-3 py-4"><input type="checkbox" checked={!!checkedItems[id]} onChange={() => toggle(id)} className="h-5 w-5 shrink-0 accent-[#00695F]" /><span><strong className="text-sm">{t(`settings.checklist.${id}.title`)}</strong><span className="mt-1 block text-sm text-[#60727E]">{t(`settings.checklist.${id}.description`)}</span></span></label>)}</div></details>)}</div>
    </section>
  </div>;
};
