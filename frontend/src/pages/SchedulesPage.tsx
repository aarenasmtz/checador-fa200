import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Clock,
  UtensilsCrossed,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Moon,
  Sun,
  Sliders,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  Table as TableIcon,
  Search
} from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { useCatalogView } from '../hooks/useCatalogView';
import { CatalogCollection } from '../components/CatalogCollection';

interface WorkDay {
  id: number;
  dayOfWeek: number;
  dayName: string;
  isWorkingDay: boolean;
}

interface Schedule {
  id: number;
  companyId: number;
  name: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  hasMealBreak: boolean;
  mealBreakMode: 'Fixed' | 'Flexible' | string;
  mealStartTime?: string | null;
  mealEndTime?: string | null;
  mealDurationMinutes: number;
  mealToleranceMinutes: number;
  isOvernight: boolean;
  entryWindowStart?: string | null;
  entryWindowEnd?: string | null;
  mealExitWindowStart?: string | null;
  mealExitWindowEnd?: string | null;
  mealReturnWindowStart?: string | null;
  mealReturnWindowEnd?: string | null;
  exitWindowStart?: string | null;
  exitWindowEnd?: string | null;
  expectedHours: number;
  status: string;
  workDays: WorkDay[];
  assignedEmployeesCount: number;
}

export const SchedulesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mosaico / Lista mode with localStorage persistence
  const { viewMode, handleSetViewMode } = useCatalogView('schedules');
  const [searchTerm, setSearchTerm] = useState('');


  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showAdvancedWindows, setShowAdvancedWindows] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    startTime: '08:00',
    endTime: '18:00',
    toleranceMinutes: 10,
    hasMealBreak: true,
    mealBreakMode: 'Fixed',
    mealStartTime: '13:00',
    mealEndTime: '14:00',
    mealDurationMinutes: 60,
    mealToleranceMinutes: 5,
    isOvernight: false,
    entryWindowStart: '',
    entryWindowEnd: '',
    mealExitWindowStart: '',
    mealExitWindowEnd: '',
    mealReturnWindowStart: '',
    mealReturnWindowEnd: '',
    exitWindowStart: '',
    exitWindowEnd: '',
    expectedHours: 9.0,
    workingDays: [1, 2, 3, 4, 5, 6], // Mon - Sat
    status: 'Active'
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete modal state
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get('/v1/schedules');
      setSchedules(res.data || []);
    } catch (err: any) {
      console.error('Failed to load schedules:', err);
      setLoadError(err.response?.data?.message || t('common.loadErrorDescription'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const daysList = [
    { num: 1, label: t('schedules.ui_lun') },
    { num: 2, label: t('schedules.ui_mar') },
    { num: 3, label: t('schedules.ui_mie') },
    { num: 4, label: t('schedules.ui_jue') },
    { num: 5, label: t('schedules.ui_vie') },
    { num: 6, label: t('schedules.ui_sab') },
    { num: 0, label: t('schedules.ui_dom') }
  ];

  const handleOpenAddModal = () => {
    setEditingSchedule(null);
    setShowAdvancedWindows(false);
    setFormData({
      name: '',
      startTime: '08:00',
      endTime: '18:00',
      toleranceMinutes: 10,
      hasMealBreak: true,
      mealBreakMode: 'Fixed',
      mealStartTime: '13:00',
      mealEndTime: '14:00',
      mealDurationMinutes: 60,
      mealToleranceMinutes: 5,
      isOvernight: false,
      entryWindowStart: '',
      entryWindowEnd: '',
      mealExitWindowStart: '',
      mealExitWindowEnd: '',
      mealReturnWindowStart: '',
      mealReturnWindowEnd: '',
      exitWindowStart: '',
      exitWindowEnd: '',
      expectedHours: 9.0,
      workingDays: [1, 2, 3, 4, 5, 6],
      status: 'Active'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: Schedule) => {
    setEditingSchedule(s);
    setShowAdvancedWindows(
      Boolean(s.entryWindowStart || s.entryWindowEnd || s.exitWindowStart || s.exitWindowEnd)
    );
    const activeDays = (s.workDays || [])
      .filter((w) => w.isWorkingDay)
      .map((w) => w.dayOfWeek);

    setFormData({
      name: s.name,
      startTime: s.startTime?.substring(0, 5) || '08:00',
      endTime: s.endTime?.substring(0, 5) || '18:00',
      toleranceMinutes: s.toleranceMinutes ?? 10,
      hasMealBreak: s.hasMealBreak ?? true,
      mealBreakMode: s.mealBreakMode === 'Flexible' ? 'Flexible' : 'Fixed',
      mealStartTime: s.mealStartTime ? s.mealStartTime.substring(0, 5) : '13:00',
      mealEndTime: s.mealEndTime ? s.mealEndTime.substring(0, 5) : '14:00',
      mealDurationMinutes: s.mealDurationMinutes ?? 60,
      mealToleranceMinutes: s.mealToleranceMinutes ?? 5,
      isOvernight: s.isOvernight ?? false,
      entryWindowStart: s.entryWindowStart ? s.entryWindowStart.substring(0, 5) : '',
      entryWindowEnd: s.entryWindowEnd ? s.entryWindowEnd.substring(0, 5) : '',
      mealExitWindowStart: s.mealExitWindowStart ? s.mealExitWindowStart.substring(0, 5) : '',
      mealExitWindowEnd: s.mealExitWindowEnd ? s.mealExitWindowEnd.substring(0, 5) : '',
      mealReturnWindowStart: s.mealReturnWindowStart ? s.mealReturnWindowStart.substring(0, 5) : '',
      mealReturnWindowEnd: s.mealReturnWindowEnd ? s.mealReturnWindowEnd.substring(0, 5) : '',
      exitWindowStart: s.exitWindowStart ? s.exitWindowStart.substring(0, 5) : '',
      exitWindowEnd: s.exitWindowEnd ? s.exitWindowEnd.substring(0, 5) : '',
      expectedHours: Number(s.expectedHours) || 9.0,
      workingDays: activeDays.length > 0 ? activeDays : [1, 2, 3, 4, 5, 6],
      status: s.status === 'Active' ? 'Active' : 'Inactive'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const toggleDay = (dayNum: number) => {
    setFormData((prev) => {
      const exists = prev.workingDays.includes(dayNum);
      const updated = exists
        ? prev.workingDays.filter((d) => d !== dayNum)
        : [...prev.workingDays, dayNum];
      return { ...prev, workingDays: updated };
    });
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(t('schedules.ui_el_nombre_del_horario_es_obligatorio'));
      return;
    }
    if (formData.workingDays.length === 0) {
      setFormError(t('schedules.ui_debe_seleccionar_al_menos_un_dia'));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const formatTimeOrNull = (val?: string) => (val && val.trim() ? `${val.trim()}:00` : null);

      const payload = {
        name: formData.name.trim(),
        startTime: `${formData.startTime}:00`,
        endTime: `${formData.endTime}:00`,
        toleranceMinutes: Number(formData.toleranceMinutes),
        hasMealBreak: Boolean(formData.hasMealBreak),
        mealBreakMode: formData.mealBreakMode,
        mealStartTime: formData.hasMealBreak && formData.mealBreakMode === 'Fixed' ? formatTimeOrNull(formData.mealStartTime) : null,
        mealEndTime: formData.hasMealBreak && formData.mealBreakMode === 'Fixed' ? formatTimeOrNull(formData.mealEndTime) : null,
        mealDurationMinutes: formData.hasMealBreak ? Number(formData.mealDurationMinutes) : 0,
        mealToleranceMinutes: formData.hasMealBreak ? Number(formData.mealToleranceMinutes) : 0,
        isOvernight: Boolean(formData.isOvernight),
        entryWindowStart: formatTimeOrNull(formData.entryWindowStart),
        entryWindowEnd: formatTimeOrNull(formData.entryWindowEnd),
        mealExitWindowStart: formatTimeOrNull(formData.mealExitWindowStart),
        mealExitWindowEnd: formatTimeOrNull(formData.mealExitWindowEnd),
        mealReturnWindowStart: formatTimeOrNull(formData.mealReturnWindowStart),
        mealReturnWindowEnd: formatTimeOrNull(formData.mealReturnWindowEnd),
        exitWindowStart: formatTimeOrNull(formData.exitWindowStart),
        exitWindowEnd: formatTimeOrNull(formData.exitWindowEnd),
        expectedHours: Number(formData.expectedHours),
        workingDays: formData.workingDays,
        status: formData.status
      };

      if (editingSchedule) {
        await api.put(`/v1/schedules/${editingSchedule.id}`, payload);
        showNotification(t('schedules.ui_horario_actualizado_exitosamente'));
      } else {
        await api.post('/v1/schedules', payload);
        showNotification(t('schedules.ui_nuevo_horario_creado_exitosamente'));
      }
      setIsModalOpen(false);
      fetchSchedules();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar el horario.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deletingSchedule) return;
    setDeleting(true);
    try {
      await api.delete(`/v1/schedules/${deletingSchedule.id}`);
      showNotification(t('schedules.ui_horario_eliminado_exitosamente'));
      setDeletingSchedule(null);
      fetchSchedules();
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Error al eliminar el horario.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredSchedules = schedules.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return s.name.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#203441] tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-[#00695F]" />
            {t('schedules.title')}
          </h1>
          <p className="text-xs text-[#60727E] mt-1">
            {t('schedules.ui_configuracion_de_turnos_y_4_marcaciones')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Mosaico / Lista Selector */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#DFE7EB] shadow-2xs">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              aria-pressed={viewMode === 'grid'}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={t('schedules.ui_vista_en_cuadricula_de_tarjetas_mosaico')}
              aria-label={t('common.gridView')}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={t('schedules.ui_vista_en_tabla_compacta_lista')}
              aria-label={t('common.listView')}
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchSchedules}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#DFE7EB] text-xs font-semibold text-[#203441] hover:bg-slate-50 shadow-2xs transition min-h-[40px]"
          >
            <RefreshCw className="w-4 h-4 text-[#00695F]" />
            <span>{t('schedules.ui_actualizar')}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>{t('schedules.ui_nuevo_horario')}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#60727E]" />
          <input
            type="text"
            placeholder={t('schedules.ui_buscar_turno_u_horario_por_nombre')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-[#DFE7EB] rounded-xl text-xs text-[#203441] placeholder-[#60727E] focus:bg-white focus:border-[#00695F] focus:outline-none min-h-[42px]"
          />
        </div>
      </div>

      {/* Notification Toast */}
      {actionMessage && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center gap-2 shadow-2xs ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {actionMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{actionMessage.text}</span>
        </div>
      )}

      {/* Main Content: Loading / Empty / Grid / Table */}
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={fetchSchedules} />
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white border border-dashed border-[#DFE7EB] rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F2F0] border border-[#00695F]/20 flex items-center justify-center text-[#00695F] mx-auto">
            <CalendarClock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#203441]">
              {t('schedules.ui_no_se_encontraron_horarios')}
            </h3>
            <p className="text-xs text-[#60727E] mt-1 max-w-md mx-auto">
              {t('schedules.ui_haga_clic_en_nuevo_horario_para')}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('schedules.ui_crear_horario_ahora')}</span>
          </button>
        </div>
      ) : (
        <CatalogCollection mode={viewMode} permission="attendance.reprocess" onEdit={handleOpenEditModal} onDelete={setDeletingSchedule}
          rows={filteredSchedules.map(schedule => ({ id: schedule.id, name: schedule.name, code: String(schedule.id), status: schedule.status, source: schedule,
            fields: [{ label: t('schedules.entryExit'), value: `${schedule.startTime?.slice(0,5)} – ${schedule.endTime?.slice(0,5)}` }, { label: t('schedules.tolerance'), value: schedule.toleranceMinutes }, { label: t('schedules.workday'), value: schedule.expectedHours == null ? '—' : `${schedule.expectedHours} ${t('detail.hourUnit')}` }],
            secondary: [{ label: t('schedules.mealMode'), value: !schedule.hasMealBreak ? t('catalog.noMeal') : schedule.mealBreakMode === 'Flexible' ? `${t('catalog.flexibleMeal')} · ${schedule.mealDurationMinutes} ${t('detail.minuteUnit')}` : `${schedule.mealStartTime?.slice(0,5) || '—'} – ${schedule.mealEndTime?.slice(0,5) || '—'}` }, { label: t('schedules.workDays'), value: schedule.workDays?.filter(day => day.isWorkingDay).map(day => daysList.find(item => item.num === day.dayOfWeek)?.label).filter(Boolean).join(' · ') }, { label: t('branches.employees'), value: schedule.assignedEmployeesCount }]
          }))} />
      )}

      {/* Add / Edit Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl p-6 relative border border-slate-200 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-600" />
                <span>
                  {editingSchedule
                    ? (t('schedules.ui_editar_turno_horario'))
                    : (t('schedules.ui_nuevo_turno_horario'))}
                </span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSchedule} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {t('schedules.ui_nombre_del_turno')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('schedules.namePlaceholder')}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Entry & Exit + Overnight */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{t('schedules.workdaySchedule')}</span>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isOvernight}
                      onChange={(e) => setFormData({ ...formData, isOvernight: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-300"
                    />
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-600" />
                      ¿Turno Nocturno? (Cruza medianoche)
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Hora de Entrada *
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Hora de Salida *
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Tolerancia Retardo Entrada (min)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={formData.toleranceMinutes}
                      onChange={(e) => setFormData({ ...formData, toleranceMinutes: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Horas Netas Esperadas
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min={1}
                      max={24}
                      value={formData.expectedHours}
                      onChange={(e) => setFormData({ ...formData, expectedHours: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Meal configuration */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <UtensilsCrossed className="w-4 h-4 text-indigo-600" />
                    Configuración de Comida / Almuerzo
                  </span>
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasMealBreak}
                      onChange={(e) => setFormData({ ...formData, hasMealBreak: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 border-slate-300"
                    />
                    <span className="text-xs font-semibold text-slate-700">
                      Incluye salida a comer (4 marcaciones)
                    </span>
                  </label>
                </div>

                {formData.hasMealBreak ? (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-slate-700 font-medium mb-1">{t('schedules.mealMode')}</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, mealBreakMode: 'Fixed' })}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition ${
                            formData.mealBreakMode === 'Fixed'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Horario Fijo Programado
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, mealBreakMode: 'Flexible' })}
                          className={`py-2 px-3 rounded-lg border text-xs font-semibold text-center transition ${
                            formData.mealBreakMode === 'Flexible'
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Flexible por Duración
                        </button>
                      </div>
                    </div>

                    {formData.mealBreakMode === 'Fixed' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-slate-700 font-medium mb-1">{t('schedules.mealStart')} *</label>
                          <input
                            type="time"
                            value={formData.mealStartTime}
                            onChange={(e) => setFormData({ ...formData, mealStartTime: e.target.value })}
                            required={formData.hasMealBreak && formData.mealBreakMode === 'Fixed'}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-medium mb-1">{t('schedules.mealEnd')} *</label>
                          <input
                            type="time"
                            value={formData.mealEndTime}
                            onChange={(e) => setFormData({ ...formData, mealEndTime: e.target.value })}
                            required={formData.hasMealBreak && formData.mealBreakMode === 'Fixed'}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-slate-700 font-medium mb-1">
                          Duración Máxima Permitida de Comida (minutos)
                        </label>
                        <input
                          type="number"
                          min={15}
                          max={180}
                          value={formData.mealDurationMinutes}
                          onChange={(e) => setFormData({ ...formData, mealDurationMinutes: Number(e.target.value) })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-700 font-medium mb-1">
                        Tolerancia Regreso de Comida (minutos de gracia)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={formData.mealToleranceMinutes}
                        onChange={(e) => setFormData({ ...formData, mealToleranceMinutes: Number(e.target.value) })}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 text-[11px] italic">
                    Este turno no contempla pausa de comida. El sistema evaluará 2 marcaciones (Entrada y Salida).
                  </p>
                )}
              </div>

              {/* Advanced Windows Collapsible */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvancedWindows(!showAdvancedWindows)}
                  className="w-full p-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-slate-700 font-semibold"
                >
                  <span className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-indigo-600" />
                    Ventanas Horarias para Clasificación de Marcaciones (Opcional)
                  </span>
                  {showAdvancedWindows ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showAdvancedWindows && (
                  <div className="p-3 bg-white space-y-3 border-t border-slate-200">
                    <p className="text-[11px] text-slate-500">
                      Si las dejas vacías, el motor de asistencia calcula automáticamente los márgenes en base al horario y tolerancias.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-600 text-[11px] font-medium mb-1">{t('schedules.entryWindow')}</label>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={formData.entryWindowStart}
                            onChange={(e) => setFormData({ ...formData, entryWindowStart: e.target.value })}
                            className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                          />
                          <input
                            type="time"
                            value={formData.entryWindowEnd}
                            onChange={(e) => setFormData({ ...formData, entryWindowEnd: e.target.value })}
                            className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-600 text-[11px] font-medium mb-1">{t('schedules.exitWindow')}</label>
                        <div className="flex gap-2">
                          <input
                            type="time"
                            value={formData.exitWindowStart}
                            onChange={(e) => setFormData({ ...formData, exitWindowStart: e.target.value })}
                            className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                          />
                          <input
                            type="time"
                            value={formData.exitWindowEnd}
                            onChange={(e) => setFormData({ ...formData, exitWindowEnd: e.target.value })}
                            className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                          />
                        </div>
                      </div>
                    </div>

                    {formData.hasMealBreak && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-slate-600 text-[11px] font-medium mb-1">{t('schedules.mealExitWindow')}</label>
                          <div className="flex gap-2">
                            <input
                              type="time"
                              value={formData.mealExitWindowStart}
                              onChange={(e) => setFormData({ ...formData, mealExitWindowStart: e.target.value })}
                              className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                            />
                            <input
                              type="time"
                              value={formData.mealExitWindowEnd}
                              onChange={(e) => setFormData({ ...formData, mealExitWindowEnd: e.target.value })}
                              className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-slate-600 text-[11px] font-medium mb-1">{t('schedules.mealReturnWindow')}</label>
                          <div className="flex gap-2">
                            <input
                              type="time"
                              value={formData.mealReturnWindowStart}
                              onChange={(e) => setFormData({ ...formData, mealReturnWindowStart: e.target.value })}
                              className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                            />
                            <input
                              type="time"
                              value={formData.mealReturnWindowEnd}
                              onChange={(e) => setFormData({ ...formData, mealReturnWindowEnd: e.target.value })}
                              className="w-1/2 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Working days */}
              <div>
                <label className="block text-slate-700 font-semibold mb-2">
                  {t('schedules.ui_dias_laborables_aplicables')}
                </label>
                <div className="grid grid-cols-7 gap-1">
                  {daysList.map((d) => {
                    const selected = formData.workingDays.includes(d.num);
                    return (
                      <button
                        key={d.num}
                        type="button"
                        onClick={() => toggleDay(d.num)}
                        className={`py-2 text-center rounded-lg font-semibold text-xs border transition ${
                          selected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {t('schedules.ui_eliminar_horario')}
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingSchedule.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {t('schedules.ui_aviso_no_se_puede_eliminar_si')}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSchedule(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteSchedule}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {deleting ? 'Eliminando...' : 'Confirmar Eliminación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
