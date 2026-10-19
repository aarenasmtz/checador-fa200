import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { AttendanceMatrixView } from '../components/AttendanceMatrixView';
import {
  CalendarCheck,
  RefreshCw,
  X
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'matrix' | 'daily' | 'raw'>('matrix');
  const [items, setItems] = useState<any[]>([]);
  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null);

  const fetchBranches = async () => {
    try {
      const res = await api.get('/v1/branches');
      setBranches(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDaily = async () => {
    setLoading(true);
    try {
      let url = `/v1/attendance?page=${page}&pageSize=20`;
      if (selectedBranch) url += `&branchId=${selectedBranch}`;
      if (selectedStatus) url += `&status=${selectedStatus}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;

      const res = await api.get(url);
      setItems(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalRecords || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRaw = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/v1/attendance/raw-events?page=${page}&pageSize=20`);
      setRawEvents(res.data.items || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalRecords(res.data.totalRecords || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDaily();
    } else {
      fetchRaw();
    }
  }, [activeTab, page, selectedBranch, selectedStatus, startDate, endDate]);

  const handleReprocess = async () => {
    setReprocessing(true);
    setReprocessMsg(null);
    try {
      const res = await api.post('/v1/attendance/reprocess', {
        branchId: selectedBranch ? parseInt(selectedBranch) : null,
        startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString()
      });
      setReprocessMsg(res.data.message);
      fetchDaily();
    } catch (err: any) {
      setReprocessMsg(err.response?.data?.message || 'Error al reprocesar');
    } finally {
      setReprocessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OnTime':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">{t('status.onTime')}</span>;
      case 'Late':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">{t('status.late')}</span>;
      case 'Absent':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">{t('status.absent')}</span>;
      case 'EarlyExit':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">{t('status.earlyExit')}</span>;
      case 'Incomplete':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">{t('status.incomplete')}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            <span>{t('menu.attendance')}</span>
          </h1>
          <p className="text-xs text-slate-500">{t('app.subtitle')}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'matrix' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'zh-CN' ? '考勤日历矩阵 (Matrix)' : 'Matriz Calendario (14 Días)'}
            </button>
            <button
              onClick={() => { setActiveTab('daily'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'daily' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'zh-CN' ? '每日出勤汇总 (Daily)' : 'Resumen Diario'}
            </button>
            <button
              onClick={() => { setActiveTab('raw'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'raw' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'zh-CN' ? '原始打卡存证 (Raw Events)' : 'Eventos RAW (Inmutables)'}
            </button>
          </div>

          {/* Reprocess Button */}
          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${reprocessing ? 'animate-spin' : ''}`} />
            <span>{t('common.reprocess')}</span>
          </button>
        </div>
      </div>

      {reprocessMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between">
          <span>{reprocessMsg}</span>
          <button onClick={() => setReprocessMsg(null)}><X className="w-3.5 h-3.5 text-emerald-600" /></button>
        </div>
      )}

      {activeTab === 'matrix' ? (
        <AttendanceMatrixView />
      ) : (
        <>
          {/* Filter Row */}
      {activeTab === 'daily' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 mb-1 font-semibold">{t('common.branch')}</label>
            <select
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">{t('common.allBranches')}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-semibold">{t('common.status')}</label>
            <select
              value={selectedStatus}
              onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            >
              <option value="">{t('common.allStatuses')}</option>
              <option value="OnTime">{t('status.onTime')}</option>
              <option value="Late">{t('status.late')}</option>
              <option value="Absent">{t('status.absent')}</option>
              <option value="EarlyExit">{t('status.earlyExit')}</option>
              <option value="Incomplete">{t('status.incomplete')}</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-semibold">
              {language === 'zh-CN' ? '开始日期' : 'Fecha Inicio'}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-600 mb-1 font-semibold">
              {language === 'zh-CN' ? '结束日期' : 'Fecha Fin'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">{t('common.loading')}</div>
        ) : activeTab === 'daily' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">{t('common.date')}</th>
                  <th className="py-3 px-4">{t('common.code')}</th>
                  <th className="py-3 px-4">{t('common.name')}</th>
                  <th className="py-3 px-4">{t('common.branch')}</th>
                  <th className="py-3 px-4">{t('common.entry')}</th>
                  <th className="py-3 px-4">{t('common.exit')}</th>
                  <th className="py-3 px-4">{t('common.lateMinutes')}</th>
                  <th className="py-3 px-4">{t('common.workedHours')}</th>
                  <th className="py-3 px-4">{t('common.overtime')}</th>
                  <th className="py-3 px-4">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? (
                  items.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-slate-500">{row.date}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">{row.employeeCode}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{row.employeeName}</td>
                      <td className="py-3 px-4 text-slate-600">{row.branchName}</td>
                      <td className="py-3 px-4 font-mono font-medium text-emerald-600">{row.firstEntry || '-'}</td>
                      <td className="py-3 px-4 font-mono font-medium text-indigo-600">{row.lastExit || '-'}</td>
                      <td className="py-3 px-4 font-mono">
                        {row.minutesLate > 0 ? (
                          <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">{row.minutesLate} m</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 font-medium">
                        {Math.round((row.minutesWorked / 60) * 10) / 10} h
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {row.overtimeMinutes > 0 ? (
                          <span className="text-violet-700 font-bold bg-violet-50 px-2 py-0.5 rounded border border-violet-200/50">{row.overtimeMinutes} m</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(row.status)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-slate-400">
                      {language === 'zh-CN' ? '未查询到考勤记录' : 'No se encontraron registros de asistencia'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* Raw Events Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold">
                <tr>
                  <th className="py-3 px-4">{t('common.time')}</th>
                  <th className="py-3 px-4">{language === 'zh-CN' ? '考勤机设备' : 'Dispositivo'}</th>
                  <th className="py-3 px-4">{language === 'zh-CN' ? '打卡员工' : 'Empleado'}</th>
                  <th className="py-3 px-4">{t('common.method')}</th>
                  <th className="py-3 px-4">{t('common.type')}</th>
                  <th className="py-3 px-4">{language === 'zh-CN' ? 'SHA-256 防重防篡改签名 (Hash)' : 'Hash SHA-256 Inmutable'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rawEvents.length > 0 ? (
                  rawEvents.map((raw) => (
                    <tr key={raw.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono text-indigo-600 font-medium">{raw.timestamp}</td>
                      <td className="py-3 px-4 text-slate-800 font-semibold">{raw.deviceName}</td>
                      <td className="py-3 px-4 text-slate-700">
                        {raw.employeeCode} - {raw.employeeName}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          {raw.method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{raw.eventType}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500 truncate max-w-xs" title={raw.eventHash}>
                        {raw.eventHash}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      {language === 'zh-CN' ? '暂无原始打卡存证记录' : 'No hay registros RAW'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <span>
            {language === 'zh-CN' ? (
              <>共 <strong className="text-slate-900 font-semibold">{totalRecords}</strong> 条记录 · 第 {page} / {totalPages} 页</>
            ) : (
              <>Total: <strong className="text-slate-900 font-semibold">{totalRecords}</strong> registros · Pág. {page} de {totalPages}</>
            )}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 bg-white border border-slate-200 text-slate-700 font-medium rounded-md shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              {t('common.previous')}
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 bg-white border border-slate-200 text-slate-700 font-medium rounded-md shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer"
            >
              {t('common.next')}
            </button>
          </div>
        </div>
      </div>
    </>
  )}
</div>
);
};
