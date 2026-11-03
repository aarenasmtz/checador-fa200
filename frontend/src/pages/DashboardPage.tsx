import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { ClearAttendanceDetailModal as DailyAttendanceDetailModal } from '../components/ClearAttendanceDetailModal';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { useAuth } from '../context/AuthContext';
import { AttendanceSummary } from '../components/AttendanceSummary';
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
  AlertCircle,
  Link2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const canManageEmployees = user?.permissions?.includes('employees.manage') || user?.roles?.some(role => ['SUPERADMIN', 'ADMIN', 'ADMIN_SUCURSAL'].includes(role));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live Punches Sorting and Branch Filter state
  const [punchSortField, setPunchSortField] = useState<'dateTime' | 'name' | 'code' | 'branch' | 'status'>('dateTime');
  const [punchSortOrder, setPunchSortOrder] = useState<'asc' | 'desc'>('desc');
  const [punchBranchFilter, setPunchBranchFilter] = useState<string>('');

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
  const [selectedDailyRecord, setSelectedDailyRecord] = useState<any | null>(null);
  const navigate = useNavigate();

  const handlePunchSort = (field: 'dateTime' | 'name' | 'code' | 'branch' | 'status') => {
    if (punchSortField === field) {
      setPunchSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setPunchSortField(field);
      setPunchSortOrder(field === 'dateTime' ? 'desc' : 'asc');
    }
  };

  const renderSortIcon = (field: 'dateTime' | 'name' | 'code' | 'branch' | 'status') => {
    if (punchSortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50 group-hover:opacity-100 ml-1 inline-block" />;
    }
    return punchSortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#00695F] ml-1 inline-block" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#00695F] ml-1 inline-block" />
    );
  };

  const activeRequestIdRef = useRef<number>(0);

  const fetchDashboard = async () => {
    try {
      setLoadError(null);
      const res = await api.get('/v1/dashboard/summary');
      setData(res.data);
    } catch (err: any) {
      console.error('Error fetching dashboard:', err);
      setLoadError(err.response?.data?.message || t('common.loadErrorDescription'));
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
        setDetailError(err.response?.data?.message || t('dashboard.detailLoadError'));
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
    return <LoadingState />;
  }

  if (loadError && !data) {
    return <ErrorState message={loadError} onRetry={() => { setLoading(true); fetchDashboard(); }} />;
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

  const getMethodLabel = (method?: string) => {
    switch ((method || '').toLowerCase()) {
      case 'face': return t('dashboard.methodFace');
      case 'fingerprint': return t('dashboard.methodFingerprint');
      case 'card': return t('dashboard.methodCard');
      case 'pin': return t('dashboard.methodPin');
      default: return method || t('common.notAvailable');
    }
  };

  // Process live punches with branch filtering and column sorting
  const rawPunches = recentActivity || [];

  const uniquePunchBranches = Array.from(
    new Set(
      rawPunches
        .map((p: any) => p.branchName)
        .filter((b: any) => Boolean(b))
    )
  ) as string[];

  const processedPunches = [...rawPunches]
    .filter((punch: any) => {
      if (punchBranchFilter && punch.branchName !== punchBranchFilter) {
        return false;
      }
      return true;
    })
    .sort((a: any, b: any) => {
      let comparison = 0;
      if (punchSortField === 'dateTime') {
        const timeA = `${a.date || ''} ${a.time || ''}`;
        const timeB = `${b.date || ''} ${b.time || ''}`;
        comparison = timeA.localeCompare(timeB);
      } else if (punchSortField === 'name') {
        const nameA = a.employeeName || (a.userClockId ? `ID ${a.userClockId}` : '');
        const nameB = b.employeeName || (b.userClockId ? `ID ${b.userClockId}` : '');
        comparison = nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
      } else if (punchSortField === 'code') {
        const codeA = parseInt(a.employeeCode || a.userClockId || '0', 10);
        const codeB = parseInt(b.employeeCode || b.userClockId || '0', 10);
        if (!isNaN(codeA) && !isNaN(codeB) && codeA !== codeB) {
          comparison = codeA - codeB;
        } else {
          comparison = String(a.employeeCode || '').localeCompare(String(b.employeeCode || ''));
        }
      } else if (punchSortField === 'branch') {
        const branchA = a.branchName || '';
        const branchB = b.branchName || '';
        comparison = branchA.localeCompare(branchB);
      } else if (punchSortField === 'status') {
        const statusA = a.eventType || '';
        const statusB = b.eventType || '';
        comparison = statusA.localeCompare(statusB);
      }

      return punchSortOrder === 'asc' ? comparison : -comparison;
    });

  // Filter records in the detail modal
  const filteredRecords = dayDetail?.records?.filter((r: any) => {
    const isLate = r.status === 'Late' || (r.minutesLate && r.minutesLate > 0);
    const isAbsent = r.status === 'Absent' && (!r.firstEntry || r.firstEntry === '-');
    const isOnTime = !isLate && !isAbsent && (r.status === 'OnTime' || (r.firstEntry && r.firstEntry !== '-') || r.status === 'EarlyExit' || r.status === 'Incomplete');

    const matchesTab = filterTab === 'ALL'
      ? true
      : filterTab === 'OnTime'
      ? isOnTime
      : filterTab === 'Late'
      ? isLate
      : filterTab === 'Absent'
      ? isAbsent
      : filterTab === 'Incomplete'
      ? (r.status === 'Incomplete' || r.status === 'EarlyExit')
      : r.status === filterTab;

    const matchesSearch = !searchTerm ||
      (r.employeeName && r.employeeName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.employeeCode && r.employeeCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (r.branchName && r.branchName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesTab && matchesSearch;
  }) || [];

  return (
    <div className="space-y-6">
      <h1 className="font-bold">{t('menu.home')}</h1>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Employees */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.totalEmployees')}</span>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">{metrics?.totalEmployees ?? '—'}</p>
          </div>
        </div>

        {/* Present Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.presentToday')}</span>
            <p className="text-2xl font-bold text-emerald-600 mt-0.5">{metrics?.presentToday ?? '—'}</p>
          </div>
        </div>

        {/* Late Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.lateToday')}</span>
            <p className="text-2xl font-bold text-amber-600 mt-0.5">{metrics?.lateToday ?? '—'}</p>
          </div>
        </div>

        {/* Absent Today */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
            <UserX className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">{t('dashboard.absentToday')}</span>
            <p className="text-2xl font-bold text-rose-600 mt-0.5">{metrics?.absentToday ?? '—'}</p>
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
                {t('dashboard.clickForDetail')}
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

          <div className="h-52 flex items-end justify-between gap-1 sm:gap-3 pt-6 px-2">
            {(() => {
              const effectiveTrend = trend || [];
              const maxScale = Math.max(
                1,
                ...effectiveTrend.map((d: any) => (d.onTime || 0) + (d.late || 0) + (d.absent || 0))
              );

              if (effectiveTrend.length === 0) {
                return <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">{t('dashboard.noTrendData')}</div>;
              }

              return effectiveTrend.map((day: any) => {
                const total = (day.onTime || 0) + (day.late || 0) + (day.absent || 0);
                const colHeight = total > 0 ? Math.max(1, Math.round((total / maxScale) * 88)) : 3;
                const absentPct = total > 0 ? (day.absent / total) * 100 : 0;
                const latePct = total > 0 ? (day.late / total) * 100 : 0;
                const onTimePct = total > 0 ? (day.onTime / total) * 100 : 0;
                const isSelected = selectedDate === day.date;
                const displayLabel = day.label || day.dateShort || day.date;

                return (
                  <div
                    key={day.date}
                    role="button"
                    tabIndex={0}
                    aria-label={`${t('dashboard.detail')}: ${day.date}`}
                    onClick={() => handleSelectDay(day.date, displayLabel)}
                    onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleSelectDay(day.date, displayLabel); } }}
                    className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative cursor-pointer select-none"
                  >
                    {/* Floating Tooltip */}
                    <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col gap-1 bg-slate-900 text-white text-[11px] rounded-xl px-3 py-2 shadow-xl z-30 pointer-events-none whitespace-nowrap min-w-[140px]">
                      <span className="font-bold border-b border-slate-700 pb-1 text-slate-200">
                        {displayLabel} ({day.date}) · {t('dashboard.totalRecords')}: {total}
                      </span>
                      <span className="text-emerald-400 font-medium">✓ {t('dashboard.onTimeEntries')}: {day.onTime}</span>
                      <span className="text-amber-400 font-medium">⚠ {t('dashboard.lateEntries')}: {day.late}</span>
                      <span className="text-rose-400 font-medium">✕ {t('dashboard.absentEntries')}: {day.absent}</span>
                      <span className="text-[10px] text-indigo-300 pt-0.5">👉 {t('dashboard.clickForList')}</span>
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
                    <span className={`whitespace-nowrap text-[11px] font-mono font-medium transition-colors ${
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
              <span>{t('dashboard.trendHint')}</span>
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
            {branches?.length ? branches.map((b: any) => {
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
            }) : <p className="py-10 text-center text-sm text-slate-400">{t('dashboard.noBranchData')}</p>}
          </div>
        </div>
      </div>

      {/* Bottom row: Live punches real-time feed with sorting and branch filter */}
      <div className="bg-white border border-[#DFE7EB] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="font-bold text-sm text-[#203441]">{t('dashboard.livePunches')}</h3>
            <span className="text-[11px] font-mono font-semibold text-[#00695F] bg-[#E6F2F0] px-2 py-0.5 rounded-full">
              {processedPunches.length} {t('dashboard.records')}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter by Branch */}
            <div className="wpc-punch-filter flex items-center gap-1.5 bg-[#F4F7F8] border border-[#DFE7EB] rounded-lg px-2.5 py-1 text-xs">
              <Filter className="w-3.5 h-3.5 text-[#00695F]" />
              <label className="text-[11px] font-medium text-[#60727E]">
                {t('common.branch')}:
              </label>
              <select
                value={punchBranchFilter}
                onChange={(e) => setPunchBranchFilter(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#203441] focus:outline-none cursor-pointer"
              >
                <option value="">{t('common.allBranches')}</option>
                {uniquePunchBranches.map((bName) => (
                  <option key={bName} value={bName}>
                    {bName}
                  </option>
                ))}
              </select>
              {punchBranchFilter && (
                <button
                  type="button"
                  onClick={() => setPunchBranchFilter('')}
                  className="text-slate-400 hover:text-slate-600 ml-1"
                  title={t('common.clearFilter')}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <span className="text-xs text-[#60727E] hidden md:inline">
              {t('dashboard.autoRefresh')}
            </span>
          </div>
        </div>

        <div className="wpc-mobile-list">
          {processedPunches.map((punch: any) => <article key={punch.id} className="wpc-list-card">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3>{punch.employeeName || `${t('dashboard.unlinkedEmployee')} #${punch.userClockId || punch.employeeCode || '—'}`}</h3><p className="wpc-card-meta">{punch.branchName || '—'}</p></div><strong className="font-mono text-lg text-[#00695F]">{punch.time || '—'}</strong></div>
            <p className="wpc-card-meta">{punch.date || '—'} · {punch.eventType === 'Entry' ? t('detail.entry') : punch.eventType === 'Exit' ? t('detail.exit') : t('dashboard.biometricPunch')} · {getMethodLabel(punch.method)}</p>
            <div className="wpc-card-footer"><span className="text-sm text-[#60727E]">#{punch.employeeCode || punch.userClockId || '—'}</span>{punch.employeeId ? <button className="wpc-secondary" onClick={() => { handleSelectDay(punch.date); setSearchTerm(punch.employeeName || ''); }}><Eye size={18} />{t('dashboard.detail')}</button> : canManageEmployees && <button className="wpc-secondary" onClick={() => navigate('/employees')}><Link2 size={18} />{t('dashboard.linkEmployee')}</button>}</div>
          </article>)}
          {!processedPunches.length && <p className="py-8 text-center text-sm text-[#60727E]">{t('dashboard.noPunches')}</p>}
        </div>
        <div className="wpc-desktop-list overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#DFE7EB] text-[#60727E] bg-slate-50/60">
                <th
                  onClick={() => handlePunchSort('dateTime')}
                  className="py-2.5 px-3 cursor-pointer select-none hover:bg-slate-100 transition group"
                  title={t('dashboard.sortDateTime')}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('dashboard.dateTime')}</span>
                    {renderSortIcon('dateTime')}
                  </div>
                </th>
                <th
                  onClick={() => handlePunchSort('name')}
                  className="py-2.5 px-3 cursor-pointer select-none hover:bg-slate-100 transition group"
                  title={t('dashboard.sortName')}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('common.name')}</span>
                    {renderSortIcon('name')}
                  </div>
                </th>
                <th
                  onClick={() => handlePunchSort('code')}
                  className="py-2.5 px-3 cursor-pointer select-none hover:bg-slate-100 transition group"
                  title={t('dashboard.sortCode')}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('common.code')}</span>
                    {renderSortIcon('code')}
                  </div>
                </th>
                <th
                  onClick={() => handlePunchSort('branch')}
                  className="py-2.5 px-3 cursor-pointer select-none hover:bg-slate-100 transition group"
                  title={t('dashboard.sortBranch')}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('dashboard.deviceBranch')}</span>
                    {renderSortIcon('branch')}
                  </div>
                </th>
                <th
                  onClick={() => handlePunchSort('status')}
                  className="py-2.5 px-3 cursor-pointer select-none hover:bg-slate-100 transition group"
                  title={t('dashboard.sortStatus')}
                >
                  <div className="flex items-center gap-1">
                    <span>{t('common.status')}</span>
                    {renderSortIcon('status')}
                  </div>
                </th>
                <th className="py-2.5 px-3">{t('common.method')}</th>
                <th className="py-2.5 px-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE7EB]/60">
              {processedPunches && processedPunches.length > 0 ? (
                processedPunches.map((punch: any) => {
                  const isUnlinked = !punch.employeeId || punch.employeeId === 0 || !punch.employeeName;
                  return (
                    <tr key={punch.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 font-mono text-[#00695F] font-semibold whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#203441]">{punch.time}</span>
                          <span className="text-[11px] text-[#60727E] font-sans font-normal">{punch.date || '—'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {isUnlinked ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-amber-200">
                            {t('dashboard.unlinkedEmployee')} ({punch.userClockId ? `#${punch.userClockId}` : (punch.employeeCode ? `#${punch.employeeCode}` : 'ID ?')})
                          </span>
                        ) : (
                          <span className="font-semibold text-[#203441]">{punch.employeeName}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#60727E] whitespace-nowrap">
                        {punch.employeeCode || (punch.userClockId ? `#${punch.userClockId}` : '-')}
                      </td>
                      <td className="py-2.5 px-3 text-[#203441] whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-emerald-600">📍</span>
                          <span className="font-medium">{punch.branchName || 'Sucursal FA200'}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {punch.eventType === 'Entry' ? (t('dashboard.ui_entrada_entry')) : punch.eventType === 'Exit' ? (t('dashboard.ui_salida_exit')) : punch.eventType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-[#60727E]">
                          {getMethodIcon(punch.method)}
                          <span>{getMethodLabel(punch.method)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap text-right">
                        {isUnlinked && canManageEmployees ? (
                          <button
                            onClick={() => navigate('/employees')}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00695F] hover:text-[#005149] bg-[#E6F2F0] hover:bg-[#d6e9e6] px-2.5 py-1 rounded-lg border border-[#00695F]/20 transition"
                            title={t('dashboard.linkEmployeeTitle')}
                          >
                            <Link2 className="w-3 h-3" />
                            {t('dashboard.linkEmployee')}
                          </button>
                        ) : (
                          !isUnlinked && <button type="button" className="wpc-icon-button" aria-label={`${t('dashboard.detail')}: ${punch.employeeName}`} onClick={() => { handleSelectDay(punch.date); setSearchTerm(punch.employeeName || ''); }}><Eye size={19} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#60727E]">
                    {t('dashboard.noPunches')}
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
          <div role="dialog" aria-modal="true" aria-label={t('dashboard.detailTitle')} className="bg-white rounded-2xl w-full max-w-5xl p-4 sm:p-6 relative border border-slate-200 shadow-2xl flex flex-col max-h-[92dvh]">
            
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    {t('dashboard.detailTitle')} · {selectedDateLabel || selectedDate}
                  </h2>
                  <span className="text-[11px] font-mono font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                    {selectedDate}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {t('dashboard.detailDescription')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Branch selector in modal */}
                <select
                  value={modalBranchId}
                  onChange={(e) => handleModalBranchChange(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">{t('common.allBranches')}</option>
                  {branches && branches.map((b: any) => (
                    <option key={b.branchId} value={b.branchId}>{b.branchName}</option>
                  ))}
                </select>

                <button
                  onClick={() => { setSelectedDate(null); setDayDetail(null); setDetailError(null); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                  title={t('common.close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick KPI Summary Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-3 border-b border-slate-100">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium block">{t('dashboard.totalRecords')}</span>
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
                <span className="text-[10px] text-emerald-800 font-medium block">✓ {t('dashboard.onTimeEntries')}</span>
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
                <span className="text-[10px] text-amber-800 font-medium block">⚠ {t('dashboard.lateEntries')}</span>
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
                <span className="text-[10px] text-rose-800 font-medium block">✕ {t('dashboard.absentEntries')}</span>
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
                <span className="text-[10px] text-purple-800 font-medium block">⏱ {t('dashboard.incompleteEntries')}</span>
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
                  {t('dashboard.allRecords')} ({dayDetail?.summary?.total ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('OnTime')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'OnTime' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('status.onTime')} ({dayDetail?.summary?.onTime ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('Late')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'Late' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('dashboard.lateEntries')} ({dayDetail?.summary?.late ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('Absent')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'Absent' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('dashboard.absentEntries')} ({dayDetail?.summary?.absent ?? 0})
                </button>
                <button
                  onClick={() => setFilterTab('Incomplete')}
                  className={`px-3 py-1 rounded-md font-semibold transition ${
                    filterTab === 'Incomplete' ? 'bg-white text-purple-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t('dashboard.incompleteEntries')} ({dayDetail?.summary?.incomplete ?? 0})
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('dashboard.searchEmployeeBranch')}
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
                  <span>{t('dashboard.loadingDetail')}</span>
                </div>
              ) : detailError ? (
                <div className="py-16 text-center text-xs flex flex-col items-center justify-center gap-2 text-rose-600">
                  <AlertCircle className="w-8 h-8 text-rose-500" />
                  <span className="font-semibold">{detailError}</span>
                  <button
                    onClick={() => selectedDate && loadDayDetail(selectedDate, modalBranchId)}
                    className="mt-2 px-3 py-1 bg-white border border-rose-300 rounded-md text-rose-700 hover:bg-rose-50"
                  >
                    {t('common.retry')}
                  </button>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  {dayDetail?.records?.length === 0
                    ? `${t('dashboard.noAttendanceForDate')} ${selectedDate}.`
                    : t('dashboard.noMatchingEmployees')}
                </div>
              ) : (
                <AttendanceSummary items={filteredRecords.map((record: any) => ({ ...record, date: selectedDate }))} onDetail={record => setSelectedDailyRecord(record)} />
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>{t('dashboard.showing')} {filteredRecords.length} {t('dashboard.records')}</span>
              <button
                onClick={() => { setSelectedDate(null); setDayDetail(null); setDetailError(null); }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Attendance 4-Punch Modal ("Tarjetas claras") */}
      {selectedDailyRecord && (
        <DailyAttendanceDetailModal
          record={selectedDailyRecord}
          onClose={() => setSelectedDailyRecord(null)}
          onRefresh={() => {
            if (selectedDate) {
              loadDayDetail(selectedDate, modalBranchId);
            }
          }}
        />
      )}
    </div>
  );
};
