import React, { useEffect, useState, useRef } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import {
  Users,
  CheckCircle2,
  Clock,
  UserX,
  TrendingUp,
  Building2,
  ScanFace,
  Fingerprint,
  CreditCard,
  UserCheck,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Selected Day Detail Modal state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDateLabel, setSelectedDateLabel] = useState<string | null>(null);
  const [modalBranchId, setModalBranchId] = useState<string>('');
  const [dayDetail, setDayDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'OnTime' | 'Late' | 'Absent' | 'EarlyExit' | 'Incomplete'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<number | null>(null);

  const activeRequestIdRef = useRef<number>(0);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/v1/dashboard/summary');
      setData(res.data);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    // Auto-refresh every 10 seconds to catch live punches
    const interval = setInterval(fetchDashboard, 10000);
    return () => clearInterval(interval);
  }, []);

  const loadDayDetail = async (dateStr: string, branchIdVal: string) => {
    const requestId = ++activeRequestIdRef.current;
    setDetailLoading(true);
    setDetailError(null);

    try {
      const res = await api.get('/v1/dashboard/day-detail', {
        params: {
          date: dateStr,
          branchId: branchIdVal ? parseInt(branchIdVal) : undefined,
        },
      });

      // Avoid race conditions: only update if this is still the most recent request
      if (requestId === activeRequestIdRef.current) {
        setDayDetail(res.data);
      }
    } catch (err: any) {
      if (requestId === activeRequestIdRef.current) {
        console.error('Error fetching day detail:', err);
        setDetailError(err.response?.data?.message || 'Error al cargar el detalle de asistencia');
        setDayDetail(null);
      }
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const handleSelectDay = (dateFull: string, dateLabel?: string) => {
    setSelectedDate(dateFull);
    setSelectedDateLabel(dateLabel || dateFull);
    setFilterTab('ALL');
    setSearchTerm('');
    setExpandedEmployeeId(null);
    loadDayDetail(dateFull, modalBranchId);
  };

  const handleModalBranchChange = (newBranchId: string) => {
    setModalBranchId(newBranchId);
    if (selectedDate) {
      loadDayDetail(selectedDate, newBranchId);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">{t('common.loading')}</div>;
  }

  const { metrics, trend, branches, recentActivity } = data || {};

  const getMethodIcon = (method: string) => {
    switch ((method || '').toLowerCase()) {
      case 'face': return <ScanFace className="w-4 h-4 text-indigo-500" />;
      case 'fingerprint': return <Fingerprint className="w-4 h-4 text-emerald-600" />;
      case 'card': return <CreditCard className="w-4 h-4 text-amber-600" />;
      default: return <UserCheck className="w-4 h-4 text-violet-500" />;
    }
  };

  // Filter records in the detail modal
  const filteredRecords = dayDetail?.records?.filter((r: any) => {
    const matchesTab = filterTab === 'ALL' || r.status === filterTab;
    const matchesSearch = !searchTerm ||
      (r.employeeName && r.employeeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.employeeCode && r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.branchName && r.branchName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTab && matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.totalEmployees')}</span>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{metrics?.totalEmployees || 0}</p>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.presentToday')}</span>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{metrics?.presentToday || 0}</p>
          </div>
        </div>

        {/* Late Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.lateToday')}</span>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{metrics?.lateToday || 0}</p>
          </div>
        </div>

        {/* Absent Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.absentToday')}</span>
            <p className="text-2xl font-bold text-rose-600 mt-0.5">{metrics?.absentToday || 0}</p>
          </div>
        </div>
      </div>

      {/* Middle row: 7-Day Trend Chart & Branch Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-day Trend */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800">{t('dashboard.trendTitle')}</h3>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                {language === 'zh-CN' ? '点击查看明细' : 'Clic para ver detalle'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {t('status.onTime')}
              </span>
              <span className="flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium border border-amber-100">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {t('status.late')}
              </span>
              <span className="flex items-center gap-1.5 text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full font-medium border border-rose-100">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                {t('status.absent')}
              </span>
            </div>
          </div>

          <div className="h-52 flex items-end justify-between gap-3 pt-6 px-2">
            {(() => {
              const effectiveTrend = trend || [];
              const maxScale = Math.max(
                10,
                ...effectiveTrend.map((d: any) => (d.onTime || 0) + (d.late || 0) + (d.absent || 0))
              );

              return effectiveTrend.map((day: any) => {
                const total = (day.onTime || 0) + (day.late || 0) + (day.absent || 0);
                const colHeight = Math.min(100, Math.max(total > 0 ? 30 : 6, Math.round((total / maxScale) * 100)));
                const absentPct = total > 0 ? (day.absent / total) * 100 : 0;
                const latePct = total > 0 ? (day.late / total) * 100 : 0;
                const onTimePct = total > 0 ? (day.onTime / total) * 100 : 0;
                const isSelected = selectedDate === day.date;
                const displayLabel = day.label || day.dateShort || day.date;

                return (
                  <div
                    key={day.date}
                    onClick={() => handleSelectDay(day.date, displayLabel)}
                    className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative cursor-pointer select-none"
                  >
                    {/* Floating Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-1 bg-slate-900 text-white text-[11px] rounded-xl px-3 py-2 shadow-xl z-30 pointer-events-none whitespace-nowrap min-w-[140px]">
                      <span className="font-bold border-b border-slate-700 pb-1 text-slate-200">
                        {displayLabel} ({day.date}) · Total: {total}
                      </span>
                      <span className="text-emerald-400 font-medium">✓ Puntuales: {day.onTime}</span>
                      <span className="text-amber-400 font-medium">⚠ Retardos: {day.late}</span>
                      <span className="text-rose-400 font-medium">✕ Faltas: {day.absent}</span>
                      <span className="text-[10px] text-indigo-300 pt-0.5">👉 Clic para ver lista</span>
                    </div>

                    {/* Stacked Pillar */}
                    <div
                      style={{ height: `${colHeight}%` }}
                      className={`w-full max-w-[34px] rounded-t-lg overflow-hidden flex flex-col shadow-xs transition-all duration-300 group-hover:scale-105 group-hover:shadow-md ${
                        isSelected ? 'ring-2 ring-indigo-600 ring-offset-2 scale-105 shadow-md' : ''
                      } ${total === 0 ? 'bg-slate-100' : ''}`}
                    >
                      {total > 0 ? (
                        <>
                          <div style={{ height: `${absentPct}%` }} className="w-full bg-rose-400" />
                          <div style={{ height: `${latePct}%` }} className="w-full bg-amber-400" />
                          <div style={{ height: `${onTimePct}%` }} className="w-full bg-emerald-500" />
                        </>
                      ) : (
                        <div className="w-full h-full bg-slate-200/50" />
                      )}
                    </div>
                    <span className={`text-[11px] font-mono font-medium transition-colors ${
                      isSelected ? 'text-indigo-600 font-bold' : 'text-slate-500 group-hover:text-indigo-600'
                    }`}>
                      {displayLabel}
                    </span>
                  </div>
                );
              });
            })()}
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span>💡</span>
              <span>{language === 'zh-CN' ? '点击上方任意日期的柱状图，可立即展开当日迟到与按时打卡员工清单' : 'Haz clic en cualquier barra de la gráfica para ver la lista de retardos y entradas puntuales.'}</span>
            </span>
          </div>
        </div>

        {/* Branch Today Distribution */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-800">{t('dashboard.branchTitle')}</h3>
          </div>

          <div className="space-y-3.5">
            {branches && branches.map((b: any) => {
              const pct = b.totalEmployees > 0 ? Math.round((b.present / b.totalEmployees) * 100) : 0;
              return (
                <div key={b.branchId} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 font-medium truncate">{b.branchName}</span>
                    <span className="text-slate-500 font-medium">
                      {b.present} / {b.totalEmployees} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom row: Live punches real-time feed */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="font-bold text-sm text-slate-800">{t('dashboard.livePunches')}</h3>
          </div>
          <span className="text-xs text-slate-400">
            {language === 'zh-CN' ? '每10秒自动更新 · 实时同步' : 'Actualización cada 10s · Tiempo real'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/60">
                <th className="py-2.5 px-3">{language === 'zh-CN' ? '打卡时间 (日期与时间)' : 'Fecha y Hora'}</th>
                <th className="py-2.5 px-3">{t('common.name')}</th>
                <th className="py-2.5 px-3">{t('common.code')}</th>
                <th className="py-2.5 px-3">{t('common.branch')}</th>
                <th className="py-2.5 px-3">{t('common.status')}</th>
                <th className="py-2.5 px-3">{t('common.method')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentActivity && recentActivity.length > 0 ? (
                recentActivity.map((punch: any) => (
                  <tr key={punch.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-2.5 px-3 font-mono text-indigo-600 font-medium whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800">{punch.time}</span>
                        <span className="text-[11px] text-slate-400 font-sans font-normal">{punch.date || new Date().toISOString().slice(0, 10)}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-800 whitespace-nowrap">{punch.employeeName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 whitespace-nowrap">{punch.employeeCode}</td>
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">{punch.branchName}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {punch.eventType === 'Entry' ? (language === 'zh-CN' ? '上班 (Entry)' : 'Entrada (Entry)') : punch.eventType === 'Exit' ? (language === 'zh-CN' ? '下班 (Exit)' : 'Salida (Exit)') : punch.eventType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        {getMethodIcon(punch.method)}
                        <span>{punch.method}</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    {language === 'zh-CN' ? '暂无打卡数据' : 'Sin actividad reciente'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day Attendance Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-5xl p-6 relative border border-slate-200 shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {language === 'zh-CN' ? `考勤明细报告 · ${selectedDateLabel || selectedDate}` : `Detalle de Asistencia · ${selectedDateLabel || selectedDate}`}
                  </h2>
                  <span className="text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    {selectedDate}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {language === 'zh-CN'
                    ? '按时到岗员工、迟到人员与缺勤名单详细分析 · 点击员工可展开原始生物识别打卡流水'
                    : 'Desglose individual de entradas a tiempo, retardos con minutos y faltas. Clic en un empleado para ver sus checadas originales.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Branch selector in modal */}
                <select
                  value={modalBranchId}
                  onChange={(e) => handleModalBranchChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">{language === 'zh-CN' ? '全部分店 (Todas)' : 'Todas las sucursales'}</option>
                  {branches && branches.map((b: any) => (
                    <option key={b.branchId} value={b.branchId}>{b.branchName}</option>
                  ))}
                </select>

                <button
                  onClick={() => { setSelectedDate(null); setDayDetail(null); setDetailError(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title="Cerrar modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick KPI Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-3 border-b border-slate-100">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium block">Total Registros</span>
                <span className="text-lg font-bold text-slate-900 mt-0.5 block font-mono">
                  {dayDetail?.summary?.total ?? (detailLoading ? '...' : 0)}
                </span>
              </div>
              <div
                onClick={() => setFilterTab('OnTime')}
                className={`p-2.5 rounded-xl border cursor-pointer transition ${
                  filterTab === 'OnTime' ? 'bg-emerald-100/70 border-emerald-300 ring-2 ring-emerald-500' : 'bg-emerald-50/70 border-emerald-200 hover:bg-emerald-100/50'
                }`}
              >
                <span className="text-[10px] text-emerald-800 font-medium block">✓ Entradas a Tiempo</span>
                <span className="text-lg font-bold text-emerald-700 mt-0.5 block font-mono">
                  {dayDetail?.summary?.onTime ?? 0}
                </span>
              </div>
              <div
                onClick={() => setFilterTab('Late')}
                className={`p-2.5 rounded-xl border cursor-pointer transition ${
                  filterTab === 'Late' ? 'bg-amber-100/70 border-amber-300 ring-2 ring-amber-500' : 'bg-amber-50/70 border-amber-200 hover:bg-amber-100/50'
                }`}
              >
                <span className="text-[10px] text-amber-800 font-medium block">⚠ Retardos</span>
                <span className="text-lg font-bold text-amber-700 mt-0.5 block font-mono">
                  {dayDetail?.summary?.late ?? 0}
                </span>
              </div>
              <div
                onClick={() => setFilterTab('Absent')}
                className={`p-2.5 rounded-xl border cursor-pointer transition ${
                  filterTab === 'Absent' ? 'bg-rose-100/70 border-rose-300 ring-2 ring-rose-500' : 'bg-rose-50/70 border-rose-200 hover:bg-rose-100/50'
                }`}
              >
                <span className="text-[10px] text-rose-800 font-medium block">✕ Faltas</span>
                <span className="text-lg font-bold text-rose-700 mt-0.5 block font-mono">
                  {dayDetail?.summary?.absent ?? 0}
                </span>
              </div>
              <div
                onClick={() => setFilterTab('Incomplete')}
                className={`p-2.5 rounded-xl border cursor-pointer transition ${
                  filterTab === 'Incomplete' ? 'bg-purple-100/70 border-purple-300 ring-2 ring-purple-500' : 'bg-purple-50/70 border-purple-200 hover:bg-purple-100/50'
                }`}
              >
                <span className="text-[10px] text-purple-800 font-medium block">⏱ Incompletos</span>
                <span className="text-lg font-bold text-purple-700 mt-0.5 block font-mono">
                  {dayDetail?.summary?.incomplete ?? 0}
                </span>
              </div>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 pb-2">
              <div className="flex flex-wrap bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
                <button
                  onClick={() => setFilterTab('ALL')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Todos ({dayDetail?.summary?.total ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('OnTime')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'OnTime' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  A Tiempo ({dayDetail?.summary?.onTime ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('Late')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'Late' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Retardos ({dayDetail?.summary?.late ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('Absent')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'Absent' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Faltas ({dayDetail?.summary?.absent ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('Incomplete')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'Incomplete' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Incompletos ({dayDetail?.summary?.incomplete ?? 0})
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar empleado o sucursal..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Records Table */}
            <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl mt-1">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-6 h-6 text-indigo-600 animate-spin" />
                  <span>Cargando detalle de asistencias y checadas biométricas...</span>
                </div>
              ) : detailError ? (
                <div className="py-16 text-center text-xs flex flex-col items-center justify-center gap-2 text-rose-600">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <span className="font-semibold">{detailError}</span>
                  <button
                    onClick={() => selectedDate && loadDayDetail(selectedDate, modalBranchId)}
                    className="mt-2 px-3 py-1 bg-white border border-rose-300 rounded-md text-rose-700 hover:bg-rose-50"
                  >
                    Reintentar consulta
                  </button>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  {dayDetail?.records?.length === 0
                    ? `No se encontraron registros de asistencia para el ${selectedDate} en la sucursal seleccionada.`
                    : 'No se encontraron empleados que coincidan con el criterio de búsqueda o filtro.'}
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/90 sticky top-0 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-8"></th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Empleado</th>
                      <th className="py-2.5 px-3">Sucursal / Depto</th>
                      <th className="py-2.5 px-3">Entrada</th>
                      <th className="py-2.5 px-3">Salida</th>
                      <th className="py-2.5 px-3">Horas</th>
                      <th className="py-2.5 px-3">Método Biométrico</th>
                      <th className="py-2.5 px-3">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRecords.map((r: any) => {
                      const isExpanded = expandedEmployeeId === r.id;
                      const hasPunches = r.punches && r.punches.length > 0;

                      return (
                        <React.Fragment key={r.id || r.employeeCode}>
                          <tr
                            onClick={() => setExpandedEmployeeId(isExpanded ? null : r.id)}
                            className="hover:bg-slate-50/80 transition cursor-pointer"
                          >
                            <td className="py-2 px-2 text-slate-400">
                              {hasPunches ? (
                                isExpanded ? <ChevronDown className="w-4 h-4 text-indigo-600" /> : <ChevronRight className="w-4 h-4" />
                              ) : null}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-indigo-600">{r.employeeCode}</td>
                            <td className="py-2 px-3 font-semibold text-slate-800">{r.employeeName}</td>
                            <td className="py-2 px-3 text-slate-600">
                              <div>{r.branchName}</div>
                              <div className="text-[10px] text-slate-400">{r.departmentName}</div>
                            </td>

                            {/* FirstEntry is shown whenever it exists, even if Incomplete or EarlyExit */}
                            <td className="py-2 px-3 font-mono">
                              {r.firstEntry && r.firstEntry !== '-' ? (
                                r.minutesLate > 0 ? (
                                  <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/60 inline-flex items-center gap-1">
                                    <span>{r.firstEntry}</span>
                                    <span className="text-[10px] text-amber-600 font-semibold">(+{r.minutesLate}m)</span>
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60">
                                    {r.firstEntry}
                                  </span>
                                )
                              ) : (
                                <span className="text-slate-400 font-semibold">-</span>
                              )}
                            </td>

                            <td className="py-2 px-3 font-mono text-slate-600">{r.lastExit || '-'}</td>
                            <td className="py-2 px-3 font-mono text-slate-700 font-medium">{r.hoursWorked} h</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-700 font-medium">
                                {getMethodIcon(r.method)}
                                <span>{r.method || 'Sin información'}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              {r.status === 'OnTime' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  A tiempo
                                </span>
                              )}
                              {r.status === 'Late' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Retardo
                                </span>
                              )}
                              {r.status === 'Absent' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  Falta
                                </span>
                              )}
                              {r.status === 'EarlyExit' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                  Salida anticipada
                                </span>
                              )}
                              {r.status === 'Incomplete' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                                  Incompleto
                                </span>
                              )}
                              {r.status === 'RestDay' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                                  Descanso
                                </span>
                              )}
                              {r.status === 'Holiday' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                  Festivo
                                </span>
                              )}
                              {r.status === 'Permission' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
                                  Permiso
                                </span>
                              )}
                              {r.status === 'Vacation' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Vacaciones
                                </span>
                              )}
                              {r.status === 'Disability' && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                                  Incapacidad
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Original Biometric Punches Panel */}
                          {isExpanded && (
                            <tr className="bg-slate-50/70 border-b border-indigo-100">
                              <td colSpan={9} className="p-3 pl-8">
                                <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs space-y-2">
                                  <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[11px] font-bold text-slate-700">
                                    <span>Checadas Biométricas Originales de la Jornada</span>
                                    <span className="text-slate-400 font-normal">
                                      {r.punches.length} marcaciones registradas
                                    </span>
                                  </div>

                                  {hasPunches ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                                      {r.punches.map((p: any) => (
                                        <div key={p.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] space-y-1">
                                          <div className="flex items-center justify-between">
                                            <span className="font-mono font-bold text-indigo-600">{p.time}</span>
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                              {p.classifiedAs || p.type}
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-1 text-slate-600">
                                            {getMethodIcon(p.method)}
                                            <span>Método: {p.method}</span>
                                          </div>
                                          <div className="text-[10px] text-slate-500 truncate" title={`${p.deviceName} (${p.branchName})`}>
                                            📍 {p.deviceName} · {p.branchName}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-slate-400 text-xs py-2">
                                      Sin marcaciones biométricas en el checador para esta fecha.
                                    </div>
                                  )}

                                  {r.reviewNotes && (
                                    <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                      <strong>Observación del sistema:</strong> {r.reviewNotes}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Mostrando {filteredRecords.length} registros</span>
              <button
                onClick={() => { setSelectedDate(null); setDayDetail(null); setDetailError(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
