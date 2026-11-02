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
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Mosaico / Lista mode with localStorage persistence
  const [viewMode, setViewMode] = useState<'grid' | 'table'>(() => {
    return (localStorage.getItem('schedules_view_mode') as 'grid' | 'table') || 'grid';
  });
  const [searchTerm, setSearchTerm] = useState('');

  const handleSetViewMode = (mode: 'grid' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('schedules_view_mode', mode);
  };

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
      const res = await api.get('/v1/schedules');
      setSchedules(res.data || []);
    } catch (err: any) {
      console.error('Failed to load schedules:', err);
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
    { num: 1, label: language === 'zh-CN' ? '周一' : 'Lun' },
    { num: 2, label: language === 'zh-CN' ? '周二' : 'Mar' },
    { num: 3, label: language === 'zh-CN' ? '周三' : 'Mié' },
    { num: 4, label: language === 'zh-CN' ? '周四' : 'Jue' },
    { num: 5, label: language === 'zh-CN' ? '周五' : 'Vie' },
    { num: 6, label: language === 'zh-CN' ? '周六' : 'Sáb' },
    { num: 0, label: language === 'zh-CN' ? '周日' : 'Dom' }
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
      setFormError(language === 'zh-CN' ? '请输入班次名称' : 'El nombre del horario es obligatorio.');
      return;
    }
    if (formData.workingDays.length === 0) {
      setFormError(language === 'zh-CN' ? '请至少选择一个工作日' : 'Debe seleccionar al menos un día laborable.');
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
        showNotification(language === 'zh-CN' ? '班次已更新' : 'Horario actualizado exitosamente.');
      } else {
        await api.post('/v1/schedules', payload);
        showNotification(language === 'zh-CN' ? '新班次已添加' : 'Nuevo horario creado exitosamente.');
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
      showNotification(language === 'zh-CN' ? '班次已删除' : 'Horario eliminado exitosamente.');
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
            {language === 'zh-CN'
              ? 'ABC 班次日程：配置4次打卡逻辑、固定/灵活就餐、跨午夜夜班及容差窗口'
              : 'Configuración de Turnos y 4 Marcaciones: Entrada, Comida (Fija o Flexible), Tolerancias, Jornadas Nocturnas y Ventanas'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Mosaico / Lista Selector */}
          <div className="flex items-center bg-white p-1 rounded-xl border border-[#DFE7EB] shadow-2xs">
            <button
              type="button"
              onClick={() => handleSetViewMode('grid')}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'grid'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={language === 'zh-CN' ? '网格卡片视图' : 'Vista en cuadrícula de tarjetas (Mosaico)'}
              aria-label="Mosaico"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode('table')}
              className={`p-2 rounded-lg transition cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center ${
                viewMode === 'table'
                  ? 'bg-[#00695F] text-white shadow-2xs'
                  : 'text-[#60727E] hover:text-[#203441] hover:bg-slate-50'
              }`}
              title={language === 'zh-CN' ? '列表表格视图' : 'Vista en tabla compacta (Lista)'}
              aria-label="Lista"
            >
              <TableIcon className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={fetchSchedules}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-[#DFE7EB] text-xs font-semibold text-[#203441] hover:bg-slate-50 shadow-2xs transition min-h-[40px]"
          >
            <RefreshCw className="w-4 h-4 text-[#00695F]" />
            <span>{language === 'zh-CN' ? '刷新' : 'Actualizar'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '添加新班次' : 'Nuevo Horario'}</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs">
        <div className="relative w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-[#60727E]" />
          <input
            type="text"
            placeholder={language === 'zh-CN' ? '搜索班次名称...' : 'Buscar turno u horario por nombre...'}
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
        <div className="text-center py-12 text-[#60727E] animate-pulse text-xs">
          {t('common.loading')}
        </div>
      ) : filteredSchedules.length === 0 ? (
        <div className="bg-white border border-dashed border-[#DFE7EB] rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[#E6F2F0] border border-[#00695F]/20 flex items-center justify-center text-[#00695F] mx-auto">
            <CalendarClock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#203441]">
              {language === 'zh-CN' ? '未找到符合条件的班次' : 'No se encontraron horarios'}
            </h3>
            <p className="text-xs text-[#60727E] mt-1 max-w-md mx-auto">
              {language === 'zh-CN'
                ? '点击上方“添加新班次”创建你的第一个工作作息时间表。'
                : 'Haga clic en "+ Nuevo Horario" para crear turnos con horarios de entrada, salida, comida y tolerancias.'}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '立即添加班次' : 'Crear Horario Ahora'}</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* ==================== 1. GRID (MOSAICO) ==================== */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSchedules.map((s) => {
            const isWorkingDay = (dayNum: number) => {
              const wd = s.workDays?.find((w) => w.dayOfWeek === dayNum);
              return wd?.isWorkingDay ?? false;
            };

            return (
              <div
                key={s.id}
                className="bg-white border border-[#DFE7EB] rounded-2xl p-5 hover:border-[#00695F]/40 hover:shadow-md transition shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="pr-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[#203441] text-base">{s.name}</h3>
                      {s.isOvernight && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00695F] text-white" title="Cruza medianoche">
                          <Moon className="w-3 h-3 text-emerald-200" />
                          Nocturno
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[#60727E] font-mono">
                      {s.assignedEmployeesCount || 0} {language === 'zh-CN' ? '名员工使用' : 'empleados vinculados'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(s)}
                      title="Editar horario"
                      className="p-1.5 rounded-lg text-[#60727E] hover:text-[#00695F] hover:bg-[#E6F2F0] transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingSchedule(s)}
                      title="Eliminar horario"
                      className="p-1.5 rounded-lg text-[#60727E] hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Time Block */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-[#DFE7EB] flex items-center justify-between">
                  <div className="text-center flex-1">
                    <span className="text-[11px] text-[#60727E] uppercase block font-semibold flex items-center justify-center gap-1">
                      <Sun className="w-3 h-3 text-amber-500" /> {t('common.entry')}
                    </span>
                    <span className="text-lg font-bold text-[#00695F] font-mono">
                      {s.startTime ? s.startTime.substring(0, 5) : '08:00'}
                    </span>
                  </div>
                  <div className="h-8 w-[1px] bg-[#DFE7EB]" />
                  <div className="text-center flex-1">
                    <span className="text-[11px] text-[#60727E] uppercase block font-semibold flex items-center justify-center gap-1">
                      {s.isOvernight ? <Moon className="w-3 h-3 text-emerald-600" /> : <Sun className="w-3 h-3 text-amber-500" />} {t('common.exit')}
                    </span>
                    <span className="text-lg font-bold text-[#203441] font-mono">
                      {s.endTime ? s.endTime.substring(0, 5) : '18:00'}
                    </span>
                  </div>
                </div>

                {/* Rules & Food Breakdown */}
                <div className="space-y-2 text-xs text-[#60727E]">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      {t('schedules.tolerance')}
                    </span>
                    <span className="font-bold text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                      {s.toleranceMinutes || 10} min
                    </span>
                  </div>

                  {s.hasMealBreak ? (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-[#DFE7EB] space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-semibold text-[#203441]">
                          <UtensilsCrossed className="w-3.5 h-3.5 text-[#00695F]" />
                          {s.mealBreakMode === 'Flexible' ? 'Comida Flexible' : 'Comida Programada'}
                        </span>
                        <span className="font-bold text-[#00695F] font-mono">
                          {s.mealBreakMode === 'Flexible'
                            ? `${s.mealDurationMinutes || 60} min máx`
                            : `${s.mealStartTime ? s.mealStartTime.substring(0, 5) : '13:00'} - ${s.mealEndTime ? s.mealEndTime.substring(0, 5) : '14:00'}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#60727E] flex justify-between">
                        <span>Tolerancia regreso:</span>
                        <span className="font-mono font-medium text-[#203441]">+{s.mealToleranceMinutes ?? 5} min</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[#60727E] italic bg-slate-50 px-2.5 py-1.5 rounded-lg border border-[#DFE7EB]">
                      <span className="flex items-center gap-1 text-[11px]">
                        <UtensilsCrossed className="w-3 h-3 text-[#60727E]" />
                        Jornada Continua (Sin Salida a Comer)
                      </span>
                      <span className="text-[10px] font-mono font-semibold text-[#203441]">2 Checadas</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[#60727E] font-medium">Jornada esperada:</span>
                    <span className="font-mono font-bold text-[#203441]">{s.expectedHours} hrs</span>
                  </div>
                </div>

                {/* Work days badge list */}
                <div className="pt-3 border-t border-[#DFE7EB]/60">
                  <span className="text-[11px] text-[#60727E] block mb-2 font-medium">{t('schedules.workDays')}:</span>
                  <div className="flex flex-wrap gap-1">
                    {daysList.map((day) => {
                      const active = isWorkingDay(day.num);
                      return (
                        <span
                          key={day.num}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            active
                              ? 'bg-[#E6F2F0] text-[#00695F] border border-[#00695F]/20'
                              : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {day.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ==================== 2. TABLE / LIST (LISTA) ==================== */
        <div className="space-y-3">
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-3">
            {filteredSchedules.map((s) => (
              <div key={s.id} className="bg-white border border-[#DFE7EB] rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-bold text-[#203441] text-sm">{s.name}</h4>
                    <span className="text-xs text-[#00695F] font-mono font-bold">
                      {s.startTime?.substring(0, 5)} - {s.endTime?.substring(0, 5)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(s)}
                      className="p-1.5 rounded-lg text-[#00695F] bg-[#E6F2F0]"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingSchedule(s)}
                      className="p-1.5 rounded-lg text-rose-600 bg-rose-50"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-[#60727E] space-y-1">
                  <p>🍽️ {s.hasMealBreak ? (s.mealBreakMode === 'Flexible' ? `${s.mealDurationMinutes}m flex.` : `${s.mealStartTime?.substring(0, 5)}-${s.mealEndTime?.substring(0, 5)}`) : 'Jornada continua'}</p>
                  <p>⏱️ Tolerancia: {s.toleranceMinutes} min · Esperado: {s.expectedHours} hrs</p>
                  <p>👥 {s.assignedEmployeesCount || 0} empleados asignados</p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white border border-[#DFE7EB] rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 text-[#60727E] font-semibold border-b border-[#DFE7EB]">
                <tr>
                  <th className="py-3 px-4">Nombre Turno</th>
                  <th className="py-3 px-4">Horario Entrada - Salida</th>
                  <th className="py-3 px-4">Modalidad Comida</th>
                  <th className="py-3 px-4 text-center">Tolerancia</th>
                  <th className="py-3 px-4 text-center">Jornada</th>
                  <th className="py-3 px-4 text-center">Empleados</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DFE7EB]/60">
                {filteredSchedules.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-semibold text-[#203441]">{s.name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#00695F]">
                      {s.startTime?.substring(0, 5)} - {s.endTime?.substring(0, 5)}
                      {s.isOvernight && <span className="ml-1 text-[10px] bg-slate-900 text-white px-1.5 py-0.5 rounded">Nocturno</span>}
                    </td>
                    <td className="py-3 px-4 text-[#60727E]">
                      {s.hasMealBreak
                        ? s.mealBreakMode === 'Flexible'
                          ? `Flexible (${s.mealDurationMinutes} min)`
                          : `Fija (${s.mealStartTime?.substring(0, 5)} - ${s.mealEndTime?.substring(0, 5)})`
                        : 'Continua (Sin comida)'}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-amber-700 font-bold">
                      +{s.toleranceMinutes} min
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium text-[#203441]">
                      {s.expectedHours} hrs
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-[#203441]">
                      {s.assignedEmployeesCount || 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(s)}
                          className="p-1.5 rounded-lg text-[#60727E] hover:text-[#00695F] hover:bg-[#E6F2F0] transition"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingSchedule(s)}
                          className="p-1.5 rounded-lg text-[#60727E] hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
                    ? (language === 'zh-CN' ? '修改班次设置' : 'Editar Turno / Horario')
                    : (language === 'zh-CN' ? '创建新班次' : 'Nuevo Turno / Horario')}
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
                  {language === 'zh-CN' ? '班次名称 *' : 'Nombre del Turno *'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej. Matutino con Comida (08:00 - 18:00)"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Entry & Exit + Overnight */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">Horario de Jornada</span>
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
                      <label className="block text-slate-700 font-medium mb-1">Modalidad de Comida</label>
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
                          <label className="block text-slate-700 font-medium mb-1">Inicio de Comida *</label>
                          <input
                            type="time"
                            value={formData.mealStartTime}
                            onChange={(e) => setFormData({ ...formData, mealStartTime: e.target.value })}
                            required={formData.hasMealBreak && formData.mealBreakMode === 'Fixed'}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-700 font-medium mb-1">Fin de Comida *</label>
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
                        <label className="block text-slate-600 text-[11px] font-medium mb-1">Ventana Entrada (Desde / Hasta)</label>
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
                        <label className="block text-slate-600 text-[11px] font-medium mb-1">Ventana Salida Turno (Desde / Hasta)</label>
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
                          <label className="block text-slate-600 text-[11px] font-medium mb-1">Ventana Salida a Comer</label>
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
                          <label className="block text-slate-600 text-[11px] font-medium mb-1">Ventana Regreso de Comer</label>
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
                  {language === 'zh-CN' ? '工作日适用设置 *' : 'Días Laborables Aplicables *'}
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
                  {language === 'zh-CN' ? '确认删除此班次？' : '¿Eliminar Horario?'}
                </h3>
                <p className="text-xs text-slate-500">
                  {deletingSchedule.name}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {language === 'zh-CN'
                ? '若有员工正在使用此班次，系统将阻止删除以防止计算冲突。'
                : 'Aviso: No se puede eliminar si hay empleados activos asignados a este turno.'}
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
