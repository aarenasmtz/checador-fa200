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
  UserCheck
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { t, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'matrix' | 'daily' | 'raw'>('daily');
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
      setReprocessMsg(err.response?.data?.message || 'Error al reprocesar');
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
      setAuditError('El motivo de la modificación es obligatorio para auditoría.');
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

      setAuditSuccess('Jornada auditada y corregida exitosamente.');
      setEditingRecord(null);
      setTimeout(() => setAuditSuccess(null), 4000);
      fetchDaily();
    } catch (err: any) {
      setAuditError(err.response?.data?.message || 'Error al guardar la corrección.');
    } finally {
      setSavingAudit(false);
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
      case 'RestDay':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">Descanso</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  const getOriginBadge = (origin?: string, isManual?: boolean) => {
    if (isManual || origin === 'MANUAL') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-200" title="Corregido manualmente por supervisor">
          <UserCheck className="w-3 h-3 text-sky-600" />
          Manual
        </span>
      );
    }
    if (origin === 'DEVICE_CODE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Código de estado original del checador FA200">
          <Cpu className="w-3 h-3 text-emerald-600" />
          Reloj (HW)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200" title="Clasificado por motor de ventanas y secuencia">
        <Clock className="w-3 h-3 text-indigo-600" />
        Inferido
      </span>
    );
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-indigo-600" />
            <span>Control de Asistencia y 4 Marcaciones</span>
          </h1>
          <p className="text-xs text-slate-500">
            Entrada, Salida a Comer, Regreso de Comer y Salida del Turno · Sincronización FA200 en Tiempo Real
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => { setActiveTab('daily'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'daily' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resumen 4 Checadas
            </button>
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'matrix' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Matriz Calendario (14 Días)
            </button>
            <button
              onClick={() => { setActiveTab('raw'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'raw' ? 'bg-white text-indigo-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Marcaciones RAW Inmutables
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
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{reprocessMsg}</span>
          </div>
          <button onClick={() => setReprocessMsg(null)}><X className="w-3.5 h-3.5 text-emerald-600" /></button>
        </div>
      )}

      {auditSuccess && (
        <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
            <span>{auditSuccess}</span>
          </div>
          <button onClick={() => setAuditSuccess(null)}><X className="w-3.5 h-3.5 text-sky-600" /></button>
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
                  <option value="RestDay">Descanso</option>
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
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200 font-semibold">
                    <tr>
                      <th className="py-3 px-3">Fecha</th>
                      <th className="py-3 px-3">Empleado</th>
                      <th className="py-3 px-3">
                        <span className="block text-emerald-700 font-bold">1. Entrada</span>
                        <span className="text-[10px] text-slate-400 font-normal">Real / Esp</span>
                      </th>
                      <th className="py-3 px-3">
                        <span className="block text-amber-700 font-bold">2. Salida Comida</span>
                        <span className="text-[10px] text-slate-400 font-normal">Real / Esp</span>
                      </th>
                      <th className="py-3 px-3">
                        <span className="block text-indigo-700 font-bold">3. Regreso Comida</span>
                        <span className="text-[10px] text-slate-400 font-normal">Real / Esp</span>
                      </th>
                      <th className="py-3 px-3">
                        <span className="block text-slate-800 font-bold">4. Salida Turno</span>
                        <span className="text-[10px] text-slate-400 font-normal">Real / Esp</span>
                      </th>
                      <th className="py-3 px-3">Retardo</th>
                      <th className="py-3 px-3">Comida</th>
                      <th className="py-3 px-3">Hrs Netas</th>
                      <th className="py-3 px-3">Origen</th>
                      <th className="py-3 px-3">Estado / Alertas</th>
                      <th className="py-3 px-3 text-center">Auditoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length > 0 ? (
                      items.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3 px-3 font-mono text-slate-600 font-medium">{row.date}</td>
                          <td className="py-3 px-3">
                            <span className="font-semibold text-slate-800 block">{row.employeeName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              #{row.employeeCode} · {row.branchName}
                            </span>
                          </td>

                          {/* 1. Entrada */}
                          <td className="py-3 px-3 font-mono">
                            <span className={`font-bold block ${row.firstEntry ? 'text-emerald-600' : 'text-rose-400'}`}>
                              {row.firstEntry || '--:--'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Esp: {row.expectedEntry || '--:--'}
                            </span>
                          </td>

                          {/* 2. Salida Comida */}
                          <td className="py-3 px-3 font-mono">
                            <span className={`font-semibold block ${row.mealExit ? 'text-amber-700' : 'text-slate-400'}`}>
                              {row.mealExit || '--:--'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Esp: {row.expectedMealStart || '--:--'}
                            </span>
                          </td>

                          {/* 3. Regreso Comida */}
                          <td className="py-3 px-3 font-mono">
                            <span className={`font-semibold block ${row.mealReturn ? 'text-indigo-700' : 'text-slate-400'}`}>
                              {row.mealReturn || '--:--'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Esp: {row.expectedMealEnd || '--:--'}
                            </span>
                          </td>

                          {/* 4. Salida Turno */}
                          <td className="py-3 px-3 font-mono">
                            <span className={`font-bold block ${row.lastExit ? 'text-slate-800' : 'text-rose-400'}`}>
                              {row.lastExit || '--:--'}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Esp: {row.expectedExit || '--:--'}
                            </span>
                          </td>

                          {/* Retardo */}
                          <td className="py-3 px-3 font-mono">
                            {row.minutesLate > 0 ? (
                              <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50 block">
                                Ent: {row.minutesLate}m
                              </span>
                            ) : null}
                            {row.mealMinutesLate > 0 ? (
                              <span className="text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200/50 block mt-0.5">
                                Com: {row.mealMinutesLate}m
                              </span>
                            ) : null}
                            {!row.minutesLate && !row.mealMinutesLate && (
                              <span className="text-slate-400">0 m</span>
                            )}
                          </td>

                          {/* Comida */}
                          <td className="py-3 px-3 font-mono">
                            {row.mealDurationMinutes > 0 ? (
                              <span className="text-slate-700 font-medium">
                                {row.mealDurationMinutes} min
                              </span>
                            ) : (
                              <span className="text-slate-400">--</span>
                            )}
                          </td>

                          {/* Horas Netas */}
                          <td className="py-3 px-3 font-mono text-slate-800 font-bold">
                            {Math.round((row.minutesWorked / 60) * 10) / 10} h
                          </td>

                          {/* Origen de Clasificación */}
                          <td className="py-3 px-3">
                            {getOriginBadge(row.classificationOrigin, row.isManualOverride)}
                          </td>

                          {/* Estado e Incidencias */}
                          <td className="py-3 px-3 space-y-1">
                            <div>{getStatusBadge(row.status)}</div>
                            {row.requiresReview && (
                              <div
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold cursor-help"
                                title={row.reviewNotes || 'Secuencia incompleta o anómala que requiere supervisión'}
                              >
                                <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                <span className="truncate max-w-[140px]">{row.reviewNotes || 'Revisar'}</span>
                              </div>
                            )}
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => openAuditModal(row)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold text-[11px] border border-slate-200 transition cursor-pointer"
                              title="Corregir marcaciones de forma auditada"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Auditar</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={12} className="py-8 text-center text-slate-400">
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
                      <th className="py-3 px-4">Código FA200</th>
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
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                            {raw.nativePunchCode !== undefined ? `Punch #${raw.nativePunchCode}` : 'Auto (255)'}
                          </td>
                          <td className="py-3 px-4 font-mono text-[10px] text-slate-500 truncate max-w-xs" title={raw.eventHash}>
                            {raw.eventHash}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
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
                Total: <strong className="text-slate-900 font-semibold">{totalRecords}</strong> registros · Pág. {page} de {totalPages}
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

      {/* Manual Audit / Correction Modal */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  Auditoría y Corrección Manual de Jornada
                </h3>
              </div>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Empleado:</span>
                <span className="font-semibold text-slate-800">{editingRecord.employeeName} (#{editingRecord.employeeCode})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fecha de Jornada:</span>
                <span className="font-mono font-medium text-slate-800">{editingRecord.date}</span>
              </div>
              {editingRecord.isManualOverride && (
                <div className="pt-1 border-t border-slate-200 text-sky-800">
                  <span className="font-semibold">Última modificación:</span> {editingRecord.modifiedBy} el {editingRecord.modifiedAt}
                  <p className="text-[11px] text-slate-600 mt-0.5">Motivo: "{editingRecord.modificationReason}"</p>
                </div>
              )}
            </div>

            {auditError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{auditError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAudit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    1. Hora Entrada
                  </label>
                  <input
                    type="time"
                    value={auditFormData.firstEntry}
                    onChange={(e) => setAuditFormData({ ...auditFormData, firstEntry: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    2. Salida a Comer
                  </label>
                  <input
                    type="time"
                    value={auditFormData.mealExit}
                    onChange={(e) => setAuditFormData({ ...auditFormData, mealExit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    3. Regreso de Comer
                  </label>
                  <input
                    type="time"
                    value={auditFormData.mealReturn}
                    onChange={(e) => setAuditFormData({ ...auditFormData, mealReturn: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    4. Hora Salida Turno
                  </label>
                  <input
                    type="time"
                    value={auditFormData.lastExit}
                    onChange={(e) => setAuditFormData({ ...auditFormData, lastExit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">
                  Estado Asignado
                </label>
                <select
                  value={auditFormData.status}
                  onChange={(e) => setAuditFormData({ ...auditFormData, status: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                >
                  <option value="OnTime">A Tiempo (OnTime)</option>
                  <option value="Late">Retardo (Late)</option>
                  <option value="EarlyExit">Salida Temprana (EarlyExit)</option>
                  <option value="Incomplete">Incompleto (Incomplete)</option>
                  <option value="Absent">Falta (Absent)</option>
                  <option value="RestDay">Descanso (RestDay)</option>
                  <option value="Permission">Permiso (Permission)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Motivo de la Corrección (Obligatorio para Auditoría) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={auditFormData.modificationReason}
                  onChange={(e) => setAuditFormData({ ...auditFormData, modificationReason: e.target.value })}
                  placeholder="Ej. Empleado olvidó checar regreso de comida por atención a cliente; se valida con supervisor de área."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200/80 text-[11px] text-amber-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Las marcaciones originales del FA200 se conservan inalteradas en la base de datos como evidencia inmutable.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingAudit}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {savingAudit ? 'Guardando...' : 'Guardar y Auditar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
