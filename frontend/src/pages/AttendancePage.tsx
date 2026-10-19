import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { AttendanceMatrixView } from '../components/AttendanceMatrixView';
import {
  CalendarCheck,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UtensilsCrossed,
  ShieldCheck,
  Edit3,
  Cpu,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Filter,
  XCircle,
  Coffee,
  Info,
  Calendar,
  Building2,
  Layers,
  ArrowRight
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { t, language } = useLanguage();
  const isZh = language === 'zh-CN';

  const [activeTab, setActiveTab] = useState<'daily' | 'matrix' | 'raw'>('daily');
  const [items, setItems] = useState<any[]>([]);
  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filters (Default to today's date)
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(() => getTodayDateString());
  const [endDate, setEndDate] = useState<string>(() => getTodayDateString());
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Accordion expanded row state (Set of item IDs)
  const [expandedRowIds, setExpandedRowIds] = useState<Set<number>>(new Set());

  const [loading, setLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessMsg, setReprocessMsg] = useState<string | null>(null);

  // Manual Audit Modal State
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [auditFormData, setAuditFormData] = useState({
    firstEntry: '',
    mealExit: '',
    mealReturn: '',
    lastExit: '',
    status: 'OnTime',
    modificationReason: ''
  });
  const [savingAudit, setSavingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditSuccess, setAuditSuccess] = useState<string | null>(null);

  const todayStr = getTodayDateString();
  const activeFiltersCount = [
    selectedBranch,
    selectedStatus,
    startDate && startDate !== todayStr ? startDate : null,
    endDate && endDate !== todayStr ? endDate : null
  ].filter(Boolean).length;

  const toggleRowExpansion = (id: number) => {
    setExpandedRowIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setSelectedBranch('');
    setSelectedStatus('');
    const today = getTodayDateString();
    setStartDate(today);
    setEndDate(today);
    setPage(1);
  };

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
    } else if (activeTab === 'raw') {
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
      setReprocessMsg(err.response?.data?.message || (isZh ? '重新计算失败' : 'Error al reprocesar'));
    } finally {
      setReprocessing(false);
    }
  };

  const openAuditModal = (row: any) => {
    setEditingRecord(row);
    setAuditFormData({
      firstEntry: row.firstEntry || '',
      mealExit: row.mealExit || '',
      mealReturn: row.mealReturn || '',
      lastExit: row.lastExit || '',
      status: row.status || 'OnTime',
      modificationReason: ''
    });
    setAuditError(null);
  };

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!auditFormData.modificationReason.trim()) {
      setAuditError(isZh ? '必须填写修改原因以供审计' : 'El motivo de la modificación es obligatorio para auditoría.');
      return;
    }

    setSavingAudit(true);
    setAuditError(null);
    try {
      const formatTimeOrNull = (val?: string) => (val && val.trim() ? `${val.trim()}:00` : null);

      await api.put(`/v1/attendance/${editingRecord.id}/manual-override`, {
        firstEntry: formatTimeOrNull(auditFormData.firstEntry),
        mealExit: formatTimeOrNull(auditFormData.mealExit),
        mealReturn: formatTimeOrNull(auditFormData.mealReturn),
        lastExit: formatTimeOrNull(auditFormData.lastExit),
        status: auditFormData.status,
        modificationReason: auditFormData.modificationReason.trim()
      });

      setAuditSuccess(isZh ? '打卡记录已成功人工修正并记录审计。' : 'Jornada auditada y corregida exitosamente.');
      setEditingRecord(null);
      setTimeout(() => setAuditSuccess(null), 4000);
      fetchDaily();
    } catch (err: any) {
      setAuditError(err.response?.data?.message || (isZh ? '保存错误' : 'Error al guardar la corrección.'));
    } finally {
      setSavingAudit(false);
    }
  };

  const getStatusBadge = (status: string, compact = false) => {
    const pad = compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
    switch (status) {
      case 'OnTime':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 ${pad}`}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{isZh ? '正常' : 'A Tiempo'}</span>
          </span>
        );
      case 'Late':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-300 ${pad}`}>
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span>{isZh ? '迟到' : 'Retardo'}</span>
          </span>
        );
      case 'EarlyExit':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-orange-50 text-orange-800 border border-orange-300 ${pad}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span>{isZh ? '早退' : 'Salida Anticipada'}</span>
          </span>
        );
      case 'Incomplete':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-purple-50 text-purple-800 border border-purple-300 ${pad}`}>
            <AlertTriangle className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>{isZh ? '缺卡' : 'Incompleto'}</span>
          </span>
        );
      case 'Absent':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-rose-50 text-rose-800 border border-rose-300 ${pad}`}>
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{isZh ? '旷工' : 'Falta'}</span>
          </span>
        );
      case 'RestDay':
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-300 ${pad}`}>
            <Coffee className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>{isZh ? '公休' : 'Descanso'}</span>
          </span>
        );
      default:
        return (
          <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${pad}`}>
            <span>{status}</span>
          </span>
        );
    }
  };

  const getOriginBadge = (origin?: string, isManual?: boolean) => {
    if (isManual || origin === 'MANUAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200" title={isZh ? '主管人工审核调整' : 'Corregido manualmente por supervisor'}>
          <UserCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <span>{isZh ? '人工调整' : 'Manual'}</span>
        </span>
      );
    }
    if (origin === 'DEVICE_CODE') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200" title={isZh ? '考勤机设备按键状态码' : 'Código de estado físico del reloj FA200'}>
          <Cpu className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>{isZh ? '考勤机 (HW)' : 'Reloj (HW)'}</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200" title={isZh ? '系统时间窗算法推断' : 'Clasificado por motor de ventanas y secuencia'}>
        <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <span>{isZh ? '智能推断' : 'Inferido'}</span>
      </span>
    );
  };

  // Helper to format punch real vs expected
  const renderPunchCell = (realTime?: string | null, expectedTime?: string | null, colorDefault = 'text-slate-800') => {
    const hasReal = Boolean(realTime && realTime !== '--:--');
    return (
      <div className="flex flex-col">
        <span className={`font-mono text-sm sm:text-base font-bold tracking-tight ${hasReal ? colorDefault : 'text-slate-400 font-normal'}`}>
          {realTime || '--:--'}
        </span>
        <span className="text-xs text-slate-500 font-medium tracking-tight">
          {expectedTime ? (isZh ? `预计: ${expectedTime}` : `Esp: ${expectedTime}`) : (isZh ? '未设定' : 'No fijado')}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-5 w-full max-w-full min-w-0">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-indigo-600 shrink-0" />
            <span>{isZh ? '考勤监控与打卡明细' : 'Control de Asistencia'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isZh
              ? '四次打卡（上班进、就餐出、就餐归、下班退）· FA200 实时同步'
              : 'Cuatro marcaciones por jornada: Entrada, Comida y Salida · Sincronización FA200'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Tabs switch */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => { setActiveTab('daily'); setPage(1); }}
              className={`px-3 py-2 rounded-lg font-semibold transition cursor-pointer min-h-[40px] flex items-center gap-1.5 ${
                activeTab === 'daily' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isZh ? '每日四卡' : 'Resumen'}</span>
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-2 rounded-lg font-semibold transition cursor-pointer min-h-[40px] flex items-center gap-1.5 ${
                activeTab === 'matrix' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{isZh ? '14天矩阵' : 'Calendario'}</span>
            </button>
            <button
              onClick={() => { setActiveTab('raw'); setPage(1); }}
              className={`px-3 py-2 rounded-lg font-semibold transition cursor-pointer min-h-[40px] flex items-center gap-1.5 ${
                activeTab === 'raw' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{isZh ? '原始数据' : 'Registros Reloj'}</span>
            </button>
          </div>

          {/* Reprocess Button */}
          <button
            onClick={handleReprocess}
            disabled={reprocessing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-xs transition disabled:opacity-50 min-h-[40px] cursor-pointer"
            title={isZh ? '依据现有排班重新运算' : 'Reprocesar asistencias con horario vigente'}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${reprocessing ? 'animate-spin' : ''}`} />
            <span>{isZh ? '重新计算' : t('common.reprocess')}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {reprocessMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{reprocessMsg}</span>
          </div>
          <button onClick={() => setReprocessMsg(null)} className="p-1 hover:bg-emerald-100 rounded-lg">
            <X className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      )}

      {auditSuccess && (
        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs sm:text-sm flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="font-medium">{auditSuccess}</span>
          </div>
          <button onClick={() => setAuditSuccess(null)} className="p-1 hover:bg-sky-100 rounded-lg">
            <X className="w-4 h-4 text-sky-700" />
          </button>
        </div>
      )}

      {activeTab === 'matrix' ? (
        <AttendanceMatrixView />
      ) : (
        <>
          {/* Filter Bar (Responsive for Desktop and Mobile) */}
          {activeTab === 'daily' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              {/* Mobile Filter Toggle Header */}
              <div className="flex sm:hidden items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(!showMobileFilters)}
                  className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl min-h-[42px] cursor-pointer"
                >
                  <Filter className="w-4 h-4 text-indigo-600" />
                  <span>{isZh ? '筛选条件' : 'Filtros de búsqueda'}</span>
                  {activeFiltersCount > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-indigo-600 text-white text-[11px] font-bold">
                      {activeFiltersCount}
                    </span>
                  )}
                  {showMobileFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
                </button>

                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline p-2"
                  >
                    {isZh ? '清空筛选' : 'Limpiar filtros'}
                  </button>
                )}
              </div>

              {/* Filters Form (always visible on sm+, accordion on mobile) */}
              <div className={`${showMobileFilters ? 'block' : 'hidden'} sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs`}>
                <div>
                  <label className="block text-slate-700 mb-1 font-semibold text-xs">{isZh ? '所属分店' : t('common.branch')}</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => { setSelectedBranch(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs font-medium"
                  >
                    <option value="">{isZh ? '全部门店' : t('common.allBranches')}</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 mb-1 font-semibold text-xs">{isZh ? '出勤状态' : t('common.status')}</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => { setSelectedStatus(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs font-medium"
                  >
                    <option value="">{isZh ? '全部状态' : t('common.allStatuses')}</option>
                    <option value="OnTime">{isZh ? '正常 A Tiempo' : 'A Tiempo'}</option>
                    <option value="Late">{isZh ? '迟到 Retardo' : 'Retardo'}</option>
                    <option value="Absent">{isZh ? '缺勤 Falta' : 'Falta'}</option>
                    <option value="EarlyExit">{isZh ? '早退 Salida Anticipada' : 'Salida Anticipada'}</option>
                    <option value="Incomplete">{isZh ? '缺卡/异常 Incompleto' : 'Incompleto'}</option>
                    <option value="RestDay">{isZh ? '公休 Descanso' : 'Descanso'}</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold text-xs">
                      {isZh ? '开始日期' : 'Fecha Inicio'}
                    </label>
                    <button
                      type="button"
                      onClick={() => { const today = getTodayDateString(); setStartDate(today); setPage(1); }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                      title={isZh ? '设为今天' : 'Fijar en hoy'}
                    >
                      {isZh ? '今天' : 'Hoy'}
                    </button>
                  </div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold text-xs">
                      {isZh ? '结束日期' : 'Fecha Fin'}
                    </label>
                    <button
                      type="button"
                      onClick={() => { const today = getTodayDateString(); setEndDate(today); setPage(1); }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                      title={isZh ? '设为今天' : 'Fijar en hoy'}
                    >
                      {isZh ? '今天' : 'Hoy'}
                    </button>
                  </div>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Main Content Area */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-16 text-center text-slate-400 text-sm animate-pulse flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
                <span>{isZh ? '正在载入考勤数据...' : t('common.loading')}</span>
              </div>
            ) : activeTab === 'daily' ? (
              <>
                {/* 1. DESKTOP VIEW (Visible on lg+ screens: 1024px, 1366px, 1920px) */}
                <div className="hidden lg:block overflow-x-hidden">
                  <table className="w-full text-left text-sm table-fixed">
                    <thead className="bg-slate-50/90 text-slate-700 border-b border-slate-200 font-semibold text-xs">
                      <tr>
                        <th className="py-3.5 px-4 w-[24%]">{isZh ? '员工姓名 / 门店' : 'Empleado y Sucursal'}</th>
                        <th className="py-3.5 px-3 w-[10%]">{isZh ? '日期' : 'Fecha'}</th>
                        <th className="py-3.5 px-3 w-[14%]">
                          <span className="block text-emerald-800 font-bold">{isZh ? '1. 上班进' : '1. Entrada'}</span>
                          <span className="text-xs text-slate-400 font-normal">{isZh ? '实际 / 预计' : 'Real / Esp'}</span>
                        </th>
                        <th className="py-3.5 px-3 w-[14%]">
                          <span className="block text-amber-800 font-bold">{isZh ? '2. 就餐出' : '2. Salida Comida'}</span>
                          <span className="text-xs text-slate-400 font-normal">{isZh ? '实际 / 预计' : 'Real / Esp'}</span>
                        </th>
                        <th className="py-3.5 px-3 w-[14%]">
                          <span className="block text-indigo-800 font-bold">{isZh ? '3. 就餐归' : '3. Regreso Comida'}</span>
                          <span className="text-xs text-slate-400 font-normal">{isZh ? '实际 / 预计' : 'Real / Esp'}</span>
                        </th>
                        <th className="py-3.5 px-3 w-[14%]">
                          <span className="block text-slate-900 font-bold">{isZh ? '4. 下班退' : '4. Salida Turno'}</span>
                          <span className="text-xs text-slate-400 font-normal">{isZh ? '实际 / 预计' : 'Real / Esp'}</span>
                        </th>
                        <th className="py-3.5 px-4 w-[10%] text-right">{isZh ? '状态与操作' : 'Estado / Acción'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length > 0 ? (
                        items.map((row) => {
                          const isExpanded = expandedRowIds.has(row.id);
                          return (
                            <React.Fragment key={row.id}>
                              <tr className={`transition hover:bg-slate-50/80 ${isExpanded ? 'bg-indigo-50/30' : ''}`}>
                                {/* Empleado */}
                                <td className="py-3.5 px-4 align-top">
                                  <div className="font-bold text-slate-900 text-sm leading-snug">
                                    {row.employeeName}
                                  </div>
                                  <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                    <span className="font-mono text-indigo-700 bg-indigo-50 px-1 rounded">#{row.employeeCode}</span>
                                    <span>·</span>
                                    <span className="truncate">{row.branchName}</span>
                                  </div>
                                </td>

                                {/* Fecha */}
                                <td className="py-3.5 px-3 align-top font-mono text-xs text-slate-700 font-semibold pt-4">
                                  {row.date}
                                </td>

                                {/* 1. Entrada */}
                                <td className="py-3.5 px-3 align-top">
                                  {renderPunchCell(row.firstEntry, row.expectedEntry, 'text-emerald-700')}
                                </td>

                                {/* 2. Salida Comida */}
                                <td className="py-3.5 px-3 align-top">
                                  {renderPunchCell(row.mealExit, row.expectedMealStart, 'text-amber-800')}
                                </td>

                                {/* 3. Regreso Comida */}
                                <td className="py-3.5 px-3 align-top">
                                  {renderPunchCell(row.mealReturn, row.expectedMealEnd, 'text-indigo-800')}
                                </td>

                                {/* 4. Salida Turno */}
                                <td className="py-3.5 px-3 align-top">
                                  {renderPunchCell(row.lastExit, row.expectedExit, 'text-slate-900')}
                                </td>

                                {/* Estado y Acciones */}
                                <td className="py-3.5 px-4 align-top text-right space-y-1.5">
                                  <div>{getStatusBadge(row.status, true)}</div>

                                  <div className="flex items-center justify-end gap-1.5 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleRowExpansion(row.id)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer min-h-[32px]"
                                      title={isZh ? '查看考勤完整明细' : 'Ver detalle ampliado'}
                                    >
                                      <span>{isExpanded ? (isZh ? '收起' : 'Ocultar') : (isZh ? 'Detalle' : 'Detalle')}</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => openAuditModal(row)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition cursor-pointer min-h-[32px]"
                                      title={isZh ? '人工审核修正' : 'Auditar o corregir marcación'}
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>{isZh ? '修正' : 'Auditar'}</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Accordion Expandable Row */}
                              {isExpanded && (
                                <tr className="bg-slate-50/70 border-b border-indigo-100">
                                  <td colSpan={7} className="p-4">
                                    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                                      {/* Metric Cards Grid */}
                                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                          <span className="text-slate-500 font-medium block text-xs">{isZh ? '有效工时' : 'Horas Trabajadas'}</span>
                                          <span className="text-lg font-bold font-mono text-slate-900 block mt-0.5">
                                            {Math.round((row.minutesWorked / 60) * 10) / 10} hrs
                                          </span>
                                          <span className="text-[11px] text-slate-400">
                                            {isZh ? '（扣除就餐净时长）' : 'Neto sin comida'}
                                          </span>
                                        </div>

                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                          <span className="text-slate-500 font-medium block text-xs">{isZh ? '就餐休息' : 'Duración Comida'}</span>
                                          <span className="text-lg font-bold font-mono text-slate-900 block mt-0.5">
                                            {row.mealDurationMinutes > 0 ? `${row.mealDurationMinutes} min` : '--'}
                                          </span>
                                          {row.mealMinutesLate > 0 ? (
                                            <span className="text-[11px] font-semibold text-rose-600 block">
                                              +{row.mealMinutesLate} min {isZh ? '超额' : 'exceso'}
                                            </span>
                                          ) : (
                                            <span className="text-[11px] text-slate-400">{isZh ? '规定时长内' : 'Dentro del rango'}</span>
                                          )}
                                        </div>

                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                          <span className="text-slate-500 font-medium block text-xs">{isZh ? '迟到罚时' : 'Retardo Entrada'}</span>
                                          <span className={`text-lg font-bold font-mono block mt-0.5 ${row.minutesLate > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                                            {row.minutesLate > 0 ? `${row.minutesLate} min` : '0 min'}
                                          </span>
                                          <span className="text-[11px] text-slate-400">
                                            {row.minutesLate > 0 ? (isZh ? '超出容差' : 'Fuera de tolerancia') : (isZh ? '按时到岗' : 'Puntual')}
                                          </span>
                                        </div>

                                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                                          <span className="text-slate-500 font-medium block text-xs">{isZh ? '加班时长' : 'Horas Extra'}</span>
                                          <span className={`text-lg font-bold font-mono block mt-0.5 ${row.overtimeMinutes > 0 ? 'text-indigo-700' : 'text-slate-800'}`}>
                                            {row.overtimeMinutes > 0 ? `${row.overtimeMinutes} min` : '0 min'}
                                          </span>
                                          <span className="text-[11px] text-slate-400">
                                            {row.overtimeMinutes > 0 ? (isZh ? '超出排班' : 'Autorizable') : (isZh ? '无加班' : 'Sin excedente')}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Classification, Incident Alerts & Audit Notes */}
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span className="text-slate-500 font-medium">{isZh ? '数据来源:' : 'Origen:'}</span>
                                          {getOriginBadge(row.classificationOrigin, row.isManualOverride)}

                                          {row.requiresReview && (
                                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-medium">
                                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                              <span>{row.reviewNotes || (isZh ? '打卡存在缺失或异常' : 'Revisión pendiente')}</span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {row.isManualOverride && (
                                            <span className="text-xs text-sky-800 font-medium italic">
                                              {isZh ? `由 ${row.modifiedBy} 于 ${row.modifiedAt} 修改` : `Modificado por ${row.modifiedBy} (${row.modifiedAt})`}
                                            </span>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() => openAuditModal(row)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition cursor-pointer min-h-[36px]"
                                          >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            <span>{isZh ? '人工更正打卡' : 'Corregir esta Jornada'}</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-slate-400">
                            <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-slate-600">
                              {isZh ? '未检索到考勤记录' : 'No se encontraron registros de asistencia'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {isZh ? '请尝试切换日期或分店筛选' : 'Intente ajustar las fechas o la sucursal seleccionada.'}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. MOBILE & TABLET CARDS VIEW (Visible on screens < 1024px) */}
                <div className="block lg:hidden divide-y divide-slate-100 p-3 sm:p-4 space-y-4">
                  {items.length > 0 ? (
                    items.map((row) => {
                      const isExpanded = expandedRowIds.has(row.id);
                      return (
                        <div
                          key={row.id}
                          className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3.5 hover:border-indigo-200 transition"
                        >
                          {/* Card Header: Employee + Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-bold text-slate-900 text-base leading-snug">
                                {row.employeeName}
                              </h3>
                              <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">
                                  #{row.employeeCode}
                                </span>
                                <span>·</span>
                                <span className="truncate">{row.branchName}</span>
                                <span>·</span>
                                <span className="font-mono text-slate-700 font-semibold">{row.date}</span>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {getStatusBadge(row.status)}
                            </div>
                          </div>

                          {/* 4 Punches 2x2 Grid */}
                          <div className="grid grid-cols-2 gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {/* 1. Entrada */}
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-0.5">
                              <span className="text-[11px] uppercase font-bold text-emerald-800 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                {isZh ? '1. 上班进' : '1. Entrada'}
                              </span>
                              <div className={`font-mono text-base font-bold ${row.firstEntry ? 'text-emerald-700' : 'text-slate-400 font-normal'}`}>
                                {row.firstEntry || '--:--'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {isZh ? `预计: ${row.expectedEntry || '--:--'}` : `Esp: ${row.expectedEntry || '--:--'}`}
                              </div>
                            </div>

                            {/* 2. Salida Comida */}
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-0.5">
                              <span className="text-[11px] uppercase font-bold text-amber-800 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                {isZh ? '2. 就餐出' : '2. Salida Com.'}
                              </span>
                              <div className={`font-mono text-base font-bold ${row.mealExit ? 'text-amber-800' : 'text-slate-400 font-normal'}`}>
                                {row.mealExit || '--:--'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {isZh ? `预计: ${row.expectedMealStart || '--:--'}` : `Esp: ${row.expectedMealStart || '--:--'}`}
                              </div>
                            </div>

                            {/* 3. Regreso Comida */}
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-0.5">
                              <span className="text-[11px] uppercase font-bold text-indigo-800 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                {isZh ? '3. 就餐归' : '3. Reg. Com.'}
                              </span>
                              <div className={`font-mono text-base font-bold ${row.mealReturn ? 'text-indigo-800' : 'text-slate-400 font-normal'}`}>
                                {row.mealReturn || '--:--'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {isZh ? `预计: ${row.expectedMealEnd || '--:--'}` : `Esp: ${row.expectedMealEnd || '--:--'}`}
                              </div>
                            </div>

                            {/* 4. Salida Turno */}
                            <div className="bg-white p-2.5 rounded-lg border border-slate-200/70 space-y-0.5">
                              <span className="text-[11px] uppercase font-bold text-slate-900 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-slate-700"></span>
                                {isZh ? '4. 下班退' : '4. Salida'}
                              </span>
                              <div className={`font-mono text-base font-bold ${row.lastExit ? 'text-slate-900' : 'text-slate-400 font-normal'}`}>
                                {row.lastExit || '--:--'}
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {isZh ? `预计: ${row.expectedExit || '--:--'}` : `Esp: ${row.expectedExit || '--:--'}`}
                              </div>
                            </div>
                          </div>

                          {/* Quick Incident Badges on Card */}
                          {(row.minutesLate > 0 || row.mealMinutesLate > 0 || row.requiresReview) && (
                            <div className="flex flex-wrap gap-1.5 text-xs">
                              {row.minutesLate > 0 && (
                                <span className="px-2 py-1 rounded-md font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  {isZh ? `迟到 ${row.minutesLate} 分钟` : `Retardo entrada: ${row.minutesLate} min`}
                                </span>
                              )}
                              {row.mealMinutesLate > 0 && (
                                <span className="px-2 py-1 rounded-md font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                                  <UtensilsCrossed className="w-3.5 h-3.5 text-rose-600" />
                                  {isZh ? `就餐超额 ${row.mealMinutesLate} 分钟` : `Exceso comida: ${row.mealMinutesLate} min`}
                                </span>
                              )}
                              {row.requiresReview && (
                                <span className="px-2 py-1 rounded-md font-semibold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                  <span className="truncate max-w-[200px]">{row.reviewNotes || (isZh ? '打卡待核验' : 'Revisar')}</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* Expanded Details on Mobile */}
                          {isExpanded && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs animate-fadeIn">
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white p-2 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 text-[11px] block">{isZh ? '净工时' : 'Horas Netas'}</span>
                                  <span className="font-mono font-bold text-slate-800 text-sm">
                                    {Math.round((row.minutesWorked / 60) * 10) / 10} hrs
                                  </span>
                                </div>
                                <div className="bg-white p-2 rounded-lg border border-slate-100">
                                  <span className="text-slate-500 text-[11px] block">{isZh ? '就餐时长' : 'Tiempo Comida'}</span>
                                  <span className="font-mono font-bold text-slate-800 text-sm">
                                    {row.mealDurationMinutes > 0 ? `${row.mealDurationMinutes} min` : '--'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                                <span className="text-slate-500">{isZh ? '分类来源:' : 'Origen:'}</span>
                                {getOriginBadge(row.classificationOrigin, row.isManualOverride)}
                              </div>

                              {row.isManualOverride && (
                                <div className="p-2 bg-sky-50 rounded-lg text-sky-900 border border-sky-100 text-[11px]">
                                  <span className="font-bold">{isZh ? '修改记录:' : 'Auditado por:'}</span> {row.modifiedBy} ({row.modifiedAt})
                                  <p className="italic text-slate-600 mt-0.5">"{row.modificationReason}"</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Card Action Buttons (Touch Target >= 44px) */}
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => toggleRowExpansion(row.id)}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold min-h-[44px] cursor-pointer"
                            >
                              <span>{isExpanded ? (isZh ? '收起明细' : 'Menos Detalle') : (isZh ? '查看完整明细' : 'Ver Detalle')}</span>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>

                            <button
                              type="button"
                              onClick={() => openAuditModal(row)}
                              className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold min-h-[44px] cursor-pointer shadow-xs"
                            >
                              <Edit3 className="w-4 h-4" />
                              <span>{isZh ? '人工审核' : 'Auditar'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <Info className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm font-semibold text-slate-600">
                        {isZh ? '未检索到考勤记录' : 'No se encontraron registros de asistencia'}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Raw Events Table */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-700 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-4">{t('common.time')}</th>
                      <th className="py-3 px-4">{isZh ? '考勤机设备' : 'Dispositivo'}</th>
                      <th className="py-3 px-4">{isZh ? '打卡员工' : 'Empleado'}</th>
                      <th className="py-3 px-4">{t('common.method')}</th>
                      <th className="py-3 px-4">{t('common.type')}</th>
                      <th className="py-3 px-4">{isZh ? 'FA200 硬件代码' : 'Código FA200'}</th>
                      <th className="py-3 px-4">{isZh ? 'SHA-256 防篡改存证签名' : 'Hash SHA-256 Inmutable'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rawEvents.length > 0 ? (
                      rawEvents.map((raw) => (
                        <tr key={raw.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-4 font-mono text-indigo-700 font-semibold">{raw.timestamp}</td>
                          <td className="py-3 px-4 text-slate-800 font-medium">{raw.deviceName}</td>
                          <td className="py-3 px-4 text-slate-800">
                            <span className="font-bold">{raw.employeeName}</span>
                            <span className="font-mono text-slate-400 ml-1">#{raw.employeeCode}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {raw.method}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-800 font-medium">{raw.eventType}</td>
                          <td className="py-3 px-4 font-mono text-xs text-slate-600">
                            {raw.nativePunchCode !== undefined ? `Punch #${raw.nativePunchCode}` : 'Auto (255)'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500 truncate max-w-xs" title={raw.eventHash}>
                            {raw.eventHash}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          {isZh ? '暂无原始打卡存证记录' : 'No hay registros RAW'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-slate-600">
              <span className="font-medium">
                {isZh ? (
                  <>共 <strong className="text-slate-900 font-bold">{totalRecords}</strong> 条记录 · 第 {page} / {totalPages} 页</>
                ) : (
                  <>Total: <strong className="text-slate-900 font-bold">{totalRecords}</strong> registros · Pág. {page} de {totalPages}</>
                )}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer min-h-[40px]"
                >
                  {isZh ? '上一页' : t('common.previous')}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl shadow-2xs disabled:opacity-40 hover:bg-slate-50 cursor-pointer min-h-[40px]"
                >
                  {isZh ? '下一页' : t('common.next')}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Manual Audit / Correction Modal (Fully responsive for mobile & desktop) */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] flex flex-col relative border border-slate-200 shadow-2xl overflow-hidden animate-scaleUp">
            {/* Modal Header (Sticky) */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {isZh ? '人工审核与考勤修正' : 'Auditoría y Corrección Manual'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingRecord.employeeName} · {editingRecord.date}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {/* Employee Summary Card */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{isZh ? '员工编号 / 门店:' : 'Empleado:'}</span>
                  <span className="font-semibold text-slate-800">#{editingRecord.employeeCode} · {editingRecord.branchName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">{isZh ? '考勤日期:' : 'Fecha de Jornada:'}</span>
                  <span className="font-mono font-bold text-slate-800">{editingRecord.date}</span>
                </div>
                {editingRecord.isManualOverride && (
                  <div className="pt-2 border-t border-slate-200 text-sky-900">
                    <span className="font-bold">{isZh ? '上次修改:' : 'Última modificación:'}</span> {editingRecord.modifiedBy} ({editingRecord.modifiedAt})
                    <p className="text-xs text-slate-600 mt-0.5">"{editingRecord.modificationReason}"</p>
                  </div>
                )}
              </div>

              {auditError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{auditError}</span>
                </div>
              )}

              <form id="audit-form" onSubmit={handleSaveAudit} className="space-y-4 text-xs sm:text-sm">
                {/* 4 Times Form Inputs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '1. 上班进 (Entrada)' : '1. Hora Entrada'}
                    </label>
                    <input
                      type="time"
                      value={auditFormData.firstEntry}
                      onChange={(e) => setAuditFormData({ ...auditFormData, firstEntry: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '2. 就餐出 (Comida)' : '2. Salida a Comer'}
                    </label>
                    <input
                      type="time"
                      value={auditFormData.mealExit}
                      onChange={(e) => setAuditFormData({ ...auditFormData, mealExit: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '3. 就餐归 (Regreso)' : '3. Regreso de Comer'}
                    </label>
                    <input
                      type="time"
                      value={auditFormData.mealReturn}
                      onChange={(e) => setAuditFormData({ ...auditFormData, mealReturn: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-xs">
                      {isZh ? '4. 下班退 (Salida)' : '4. Hora Salida'}
                    </label>
                    <input
                      type="time"
                      value={auditFormData.lastExit}
                      onChange={(e) => setAuditFormData({ ...auditFormData, lastExit: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    {isZh ? '指定考勤状态' : 'Estado Asignado'}
                  </label>
                  <select
                    value={auditFormData.status}
                    onChange={(e) => setAuditFormData({ ...auditFormData, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none min-h-[42px] text-xs sm:text-sm font-medium"
                  >
                    <option value="OnTime">{isZh ? '正常 A Tiempo (OnTime)' : 'A Tiempo (OnTime)'}</option>
                    <option value="Late">{isZh ? '迟到 Retardo (Late)' : 'Retardo (Late)'}</option>
                    <option value="EarlyExit">{isZh ? '早退 Salida Anticipada (EarlyExit)' : 'Salida Anticipada (EarlyExit)'}</option>
                    <option value="Incomplete">{isZh ? '缺卡 Incompleto (Incomplete)' : 'Incompleto (Incomplete)'}</option>
                    <option value="Absent">{isZh ? '旷工 Falta (Absent)' : 'Falta (Absent)'}</option>
                    <option value="RestDay">{isZh ? '公休 Descanso (RestDay)' : 'Descanso (RestDay)'}</option>
                    <option value="Permission">{isZh ? '事假/请假 Permiso (Permission)' : 'Permiso (Permission)'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-xs">
                    {isZh ? '修改原因（必填审计记录）*' : 'Motivo de la Corrección (Obligatorio para Auditoría) *'}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={auditFormData.modificationReason}
                    onChange={(e) => setAuditFormData({ ...auditFormData, modificationReason: e.target.value })}
                    placeholder={isZh ? '例如：员工因接待重要客户遗忘就餐打卡，主管核实签字补登。' : 'Ej. Empleado olvidó checar regreso de comida por atención a cliente; se valida con supervisor de área.'}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none text-xs sm:text-sm"
                  />
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {isZh
                      ? '注意：考勤机 FA200 的硬件原始打卡记录将作为法律存证保留在数据库中，不会被物理修改或覆盖。'
                      : 'Las marcaciones originales del FA200 se conservan inalteradas en la base de datos como evidencia inmutable.'}
                  </span>
                </div>
              </form>
            </div>

            {/* Modal Footer (Sticky) */}
            <div className="p-4 sm:p-5 border-t border-slate-100 flex items-center justify-end gap-2 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm min-h-[44px] cursor-pointer"
              >
                {isZh ? '取消' : t('common.cancel')}
              </button>
              <button
                type="submit"
                form="audit-form"
                disabled={savingAudit}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-xs disabled:opacity-50 min-h-[44px] cursor-pointer"
              >
                {savingAudit ? (isZh ? '保存中...' : 'Guardando...') : (isZh ? '保存并记录审计' : 'Guardar y Auditar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
