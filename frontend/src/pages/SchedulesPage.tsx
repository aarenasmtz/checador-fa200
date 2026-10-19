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
  CheckCircle2
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
  mealStartTime?: string | null;
  mealEndTime?: string | null;
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    startTime: '08:00',
    endTime: '18:00',
    toleranceMinutes: 10,
    mealStartTime: '13:00',
    mealEndTime: '14:00',
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
    setFormData({
      name: '',
      startTime: '08:00',
      endTime: '18:00',
      toleranceMinutes: 10,
      mealStartTime: '13:00',
      mealEndTime: '14:00',
      expectedHours: 9.0,
      workingDays: [1, 2, 3, 4, 5, 6],
      status: 'Active'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: Schedule) => {
    setEditingSchedule(s);
    const activeDays = (s.workDays || [])
      .filter((w) => w.isWorkingDay)
      .map((w) => w.dayOfWeek);

    setFormData({
      name: s.name,
      startTime: s.startTime?.substring(0, 5) || '08:00',
      endTime: s.endTime?.substring(0, 5) || '18:00',
      toleranceMinutes: s.toleranceMinutes || 10,
      mealStartTime: s.mealStartTime ? s.mealStartTime.substring(0, 5) : '',
      mealEndTime: s.mealEndTime ? s.mealEndTime.substring(0, 5) : '',
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
      const payload = {
        name: formData.name.trim(),
        startTime: `${formData.startTime}:00`,
        endTime: `${formData.endTime}:00`,
        toleranceMinutes: Number(formData.toleranceMinutes),
        mealStartTime: formData.mealStartTime ? `${formData.mealStartTime}:00` : null,
        mealEndTime: formData.mealEndTime ? `${formData.mealEndTime}:00` : null,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <CalendarClock className="w-6 h-6 text-indigo-600" />
            {t('schedules.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? 'ABC 班次日程：添加、修改及配置上班、下班时间、迟到容差与就餐时间'
              : 'ABC de Horarios: Alta, Baja y Cambio de turnos, tolerancias de retardo y tiempos de comida'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchSchedules}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className="w-4 h-4 text-indigo-600" />
            <span>{language === 'zh-CN' ? '刷新' : 'Actualizar'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '添加新班次' : 'Nuevo Horario'}</span>
          </button>
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

      {/* Grid of Schedules */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse text-xs">
          {t('common.loading')}
        </div>
      ) : schedules.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
            <CalendarClock className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {language === 'zh-CN' ? '未配置工作班次' : 'No hay horarios configurados'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {language === 'zh-CN'
                ? '点击上方“添加新班次”创建你的第一个工作作息时间表。'
                : 'Haga clic en "+ Nuevo Horario" para crear turnos con horarios de entrada, salida y tolerancia de retardo.'}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '立即添加班次' : 'Crear Horario Ahora'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((s) => {
            const isWorkingDay = (dayNum: number) => {
              const wd = s.workDays?.find((w) => w.dayOfWeek === dayNum);
              return wd?.isWorkingDay ?? false;
            };

            return (
              <div
                key={s.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition shadow-xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="pr-2">
                    <h3 className="font-bold text-slate-900 text-base">{s.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">
                      {s.assignedEmployeesCount || 0} {language === 'zh-CN' ? '名员工使用' : 'empleados vinculados'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(s)}
                      title="Editar horario"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingSchedule(s)}
                      title="Eliminar horario"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Time Block */}
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <div className="text-center flex-1">
                    <span className="text-[11px] text-slate-500 uppercase block font-semibold">{t('common.entry')}</span>
                    <span className="text-lg font-bold text-indigo-600 font-mono">
                      {s.startTime ? s.startTime.substring(0, 5) : '08:00'}
                    </span>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-200" />
                  <div className="text-center flex-1">
                    <span className="text-[11px] text-slate-500 uppercase block font-semibold">{t('common.exit')}</span>
                    <span className="text-lg font-bold text-slate-800 font-mono">
                      {s.endTime ? s.endTime.substring(0, 5) : '18:00'}
                    </span>
                  </div>
                </div>

                {/* Rules */}
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      {t('schedules.tolerance')}
                    </span>
                    <span className="font-bold text-amber-700 font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200/50">
                      {s.toleranceMinutes || 10} min
                    </span>
                  </div>

                  {s.mealStartTime && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <UtensilsCrossed className="w-3.5 h-3.5 text-indigo-500" />
                        {language === 'zh-CN' ? '就餐时间' : 'Horario de Comida'}
                      </span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {s.mealStartTime.substring(0, 5)} - {s.mealEndTime ? s.mealEndTime.substring(0, 5) : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Work days badge list */}
                <div className="pt-3 border-t border-slate-100">
                  <span className="text-[11px] text-slate-500 block mb-2 font-medium">{t('schedules.workDays')}:</span>
                  <div className="flex flex-wrap gap-1">
                    {daysList.map((day) => {
                      const active = isWorkingDay(day.num);
                      return (
                        <span
                          key={day.num}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            active
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
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
      )}

      {/* Add / Edit Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <CalendarClock className="w-5 h-5 text-indigo-600" />
                <span>
                  {editingSchedule
                    ? (language === 'zh-CN' ? '修改班次时间 (Cambios)' : 'Editar Horario')
                    : (language === 'zh-CN' ? '创建新班次 (Altas)' : 'Nuevo Horario')}
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
                  {language === 'zh-CN' ? '班次名称 *' : 'Nombre del Turno / Horario *'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Turno Matutino Estándar (08:00 - 18:00)"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '上班时间 (Entry) *' : 'Hora de Entrada *'}
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '下班时间 (Exit) *' : 'Hora de Salida *'}
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '迟到容差 (分钟)' : 'Tolerancia Retardo (min)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    value={formData.toleranceMinutes}
                    onChange={(e) => setFormData({ ...formData, toleranceMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '预计工时 (小时)' : 'Horas Esperadas'}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min={1}
                    max={24}
                    value={formData.expectedHours}
                    onChange={(e) => setFormData({ ...formData, expectedHours: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '就餐开始' : 'Inicio de Comida'}
                  </label>
                  <input
                    type="time"
                    value={formData.mealStartTime}
                    onChange={(e) => setFormData({ ...formData, mealStartTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '就餐结束' : 'Fin de Comida'}
                  </label>
                  <input
                    type="time"
                    value={formData.mealEndTime}
                    onChange={(e) => setFormData({ ...formData, mealEndTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

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
