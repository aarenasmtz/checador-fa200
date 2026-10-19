import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AttendanceStatusIcon } from './AttendanceStatusIcon';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  Building2,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Coffee,
  Umbrella,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Info,
  Edit3,
  X,
  Check
} from 'lucide-react';

interface DayHeader {
  fecha: string;
  numeroDia: number;
  diaSemana: string;
  diaSemanaNombre: string;
  numeroSemana: number;
  esFinDeSemana: boolean;
  esHoy: boolean;
}

interface AttendanceItem {
  fecha: string;
  numeroDia: number;
  diaSemana: string;
  numeroSemana: number;
  estado: string; // ATIEMPO, RETARDO, FALTA, DESCANSO, PERMISO, PROGRAMADO
  displayEstado: string;
  rawStatus: string;
  entrada?: string | null;
  salida?: string | null;
  minutosRetardo: number;
  minutosTrabajados: number;
  origen: string;
  modificadoManual: boolean;
  modificadoPor?: string | null;
  fechaModificacion?: string | null;
  motivoModificacion?: string | null;
}

interface EmployeeMatrixRow {
  empleadoId: number;
  codigo: string;
  nombre: string;
  sucursalId: number;
  sucursal: string;
  departamento: string;
  asistencias: AttendanceItem[];
}

interface PeriodSummary {
  aTiempo: number;
  retardos: number;
  faltas: number;
  descansos: number;
  permisos: number;
}

interface CalendarApiResponse {
  fechaInicio: string;
  fechaFin: string;
  totalDias: number;
  sucursalId?: number | null;
  sucursalNombre?: string | null;
  dias: DayHeader[];
  resumen: PeriodSummary;
  empleados: EmployeeMatrixRow[];
}

export const AttendanceMatrixView: React.FC = () => {
  const { t, language } = useLanguage();
  const { user } = useAuth();

  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<CalendarApiResponse | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'1week' | '2weeks' | 'month'>('2weeks');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollDaysLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -220, behavior: 'smooth' });
  };

  const scrollDaysRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 220, behavior: 'smooth' });
  };

  // Anchor date for navigation (Monday of current window)
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const today = new Date();
    // Monday of current week
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Cell tooltip & modal states
  const [hoveredCell, setHoveredCell] = useState<{
    employee: EmployeeMatrixRow;
    attendance: AttendanceItem;
    x: number;
    y: number;
  } | null>(null);

  // Edit Modal State
  const [editingCell, setEditingCell] = useState<{
    employee: EmployeeMatrixRow;
    attendance: AttendanceItem;
  } | null>(null);

  const [editStatus, setEditStatus] = useState<string>('ATIEMPO');
  const [editObservation, setEditObservation] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editSuccessMsg, setEditSuccessMsg] = useState<string | null>(null);

  // Determine user permissions
  const isGeneralAdmin = useMemo(() => {
    if (!user) return false;
    return user.roles.some((r) => ['SUPERADMIN', 'ADMIN'].includes(r.toUpperCase()));
  }, [user]);

  const canEditAttendance = useMemo(() => {
    if (!user) return false;
    return (
      isGeneralAdmin ||
      user.roles.some((r) => ['RH', 'SUPERVISOR'].includes(r.toUpperCase())) ||
      user.permissions.some((p) => ['attendance.reprocess', 'attendance.manage'].includes(p))
    );
  }, [user, isGeneralAdmin]);

  // If user is restricted to a branch
  useEffect(() => {
    if (!isGeneralAdmin && user?.branchId) {
      setSelectedBranch(user.branchId.toString());
    }
  }, [isGeneralAdmin, user]);

  // Load branches
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const res = await api.get('/v1/branches');
        setBranches(res.data || []);
      } catch (err) {
        console.error('Error fetching branches:', err);
      }
    };
    fetchBranches();
  }, []);

  // Compute date range based on viewMode and anchorDate
  const dateRange = useMemo(() => {
    const start = new Date(anchorDate);
    const end = new Date(anchorDate);

    let days = 14; // Default 2 weeks
    if (viewMode === '1week') {
      days = 7;
    } else if (viewMode === 'month') {
      days = 28;
    }

    end.setDate(start.getDate() + (days - 1));

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
      daysCount: days,
    };
  }, [anchorDate, viewMode]);

  // Fetch Calendar Matrix Data
  const fetchCalendar = async () => {
    setLoading(true);
    try {
      let url = `/v1/attendance/calendar?fechaInicio=${dateRange.startDate}&fechaFin=${dateRange.endDate}&dias=${dateRange.daysCount}`;
      if (selectedBranch) {
        url += `&sucursalId=${selectedBranch}`;
      }
      const res = await api.get(url);
      setData(res.data);
    } catch (err) {
      console.error('Error fetching attendance calendar:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [dateRange, selectedBranch]);

  // Period Navigation Handlers
  const handlePrevPeriod = () => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      const step = viewMode === '1week' ? 7 : viewMode === 'month' ? 28 : 14;
      next.setDate(prev.getDate() - step);
      return next;
    });
  };

  const handleNextPeriod = () => {
    setAnchorDate((prev) => {
      const next = new Date(prev);
      const step = viewMode === '1week' ? 7 : viewMode === 'month' ? 28 : 14;
      next.setDate(prev.getDate() + step);
      return next;
    });
  };

  const handleResetToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    setAnchorDate(monday);
  };

  // Group Days Header by Week Number
  const weekGroups = useMemo(() => {
    if (!data?.dias) return [];
    const groups: { weekNumber: number; days: DayHeader[] }[] = [];

    data.dias.forEach((day) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.weekNumber === day.numeroSemana) {
        lastGroup.days.push(day);
      } else {
        groups.push({
          weekNumber: day.numeroSemana,
          days: [day],
        });
      }
    });

    return groups;
  }, [data?.dias]);

  // Filter employees by search term
  const filteredEmployees = useMemo(() => {
    if (!data?.empleados) return [];
    if (!searchTerm.trim()) return data.empleados;
    const term = searchTerm.toLowerCase().trim();
    return data.empleados.filter(
      (emp) =>
        emp.nombre.toLowerCase().includes(term) ||
        emp.codigo.toLowerCase().includes(term) ||
        emp.departamento.toLowerCase().includes(term)
    );
  }, [data?.empleados, searchTerm]);

  // Manual Edit Handlers
  const handleOpenEdit = (employee: EmployeeMatrixRow, attendance: AttendanceItem) => {
    if (!canEditAttendance) return;
    setEditingCell({ employee, attendance });
    setEditStatus(attendance.estado || 'ATIEMPO');
    setEditObservation(attendance.motivoModificacion || '');
    setHoveredCell(null);
  };

  const handleSaveEdit = async () => {
    if (!editingCell) return;
    setSavingEdit(true);
    setEditSuccessMsg(null);

    try {
      await api.put(`/v1/attendance/${editingCell.employee.empleadoId}/${editingCell.attendance.fecha}/status`, {
        estado: editStatus,
        observacion: editObservation.trim() || undefined,
      });

      setEditSuccessMsg('Estado actualizado y auditado correctamente');
      setTimeout(() => {
        setEditingCell(null);
        setEditSuccessMsg(null);
        fetchCalendar();
      }, 700);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al actualizar el estado de asistencia');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="space-y-5 w-full max-w-full min-w-0">
      {/* Top Title & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200 shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {language === 'zh-CN' ? '考勤日历控制中心' : 'Control de Asistencia'}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'zh-CN' ? '华龙商业集团考勤日历矩阵与周期多维度审计看板' : 'Matriz ejecutiva de asistencia y auditoría por periodo y sucursal'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCalendar()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 shadow-2xs transition disabled:opacity-50"
            title={language === 'zh-CN' ? '刷新矩阵' : 'Refrescar matriz'}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{language === 'zh-CN' ? '刷新' : 'Actualizar'}</span>
          </button>

          {/* Export buttons prepared */}
          <button
            onClick={() => {
              window.open(
                `${api.defaults.baseURL || ''}/v1/reports/attendance?branchId=${selectedBranch || ''}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
                '_blank'
              );
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 rounded-xl text-xs font-semibold border border-emerald-200/80 shadow-2xs transition"
            title={language === 'zh-CN' ? '导出 Excel' : 'Exportar a Excel'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden sm:inline">Excel</span>
          </button>

          <button
            onClick={() => {
              window.open(
                `${api.defaults.baseURL || ''}/v1/reports/attendance/pdf?branchId=${selectedBranch || ''}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`,
                '_blank'
              );
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100/80 text-rose-800 rounded-xl text-xs font-semibold border border-rose-200/80 shadow-2xs transition"
            title={language === 'zh-CN' ? '导出 PDF' : 'Exportar a PDF'}
          >
            <FileText className="w-3.5 h-3.5 text-rose-600" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* 9. RESUMEN DEL PERIODO (Summary Cards) - 100% visible on iPhone & Android */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3 w-full max-w-full">
        {/* On Time Card */}
        <div className="min-w-0 bg-white border border-emerald-100 rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              {language === 'zh-CN' ? '正常出勤' : 'A tiempo'}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-emerald-700 tracking-tight mt-0.5">
              {data?.resumen.aTiempo ?? 0}
            </span>
            <span className="text-[9px] sm:text-[10px] text-emerald-600 font-medium truncate">
              {language === 'zh-CN' ? '准时上下班' : 'Marcaciones normales'}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100 ml-1.5">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Late Card */}
        <div className="min-w-0 bg-white border border-amber-100 rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              {language === 'zh-CN' ? '迟到' : 'Retardos'}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-amber-700 tracking-tight mt-0.5">
              {data?.resumen.retardos ?? 0}
            </span>
            <span className="text-[9px] sm:text-[10px] text-amber-600 font-medium truncate">
              {language === 'zh-CN' ? '>10分钟容差' : '> 10 min tolerancia'}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100 ml-1.5">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Absent Card */}
        <div className="min-w-0 bg-white border border-rose-100 rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              {language === 'zh-CN' ? '缺勤' : 'Faltas'}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-rose-700 tracking-tight mt-0.5">
              {data?.resumen.faltas ?? 0}
            </span>
            <span className="text-[9px] sm:text-[10px] text-rose-600 font-medium truncate">
              {language === 'zh-CN' ? '无有效打卡' : 'Sin registro de entrada'}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 ml-1.5">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Rest Days Card */}
        <div className="min-w-0 bg-white border border-sky-100 rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              {language === 'zh-CN' ? '休息日' : 'Descansos'}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-sky-700 tracking-tight mt-0.5">
              {data?.resumen.descansos ?? 0}
            </span>
            <span className="text-[9px] sm:text-[10px] text-sky-600 font-medium truncate">
              {language === 'zh-CN' ? '公休及法定假日' : 'Días no laborables / Festivos'}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100 ml-1.5">
            <Coffee className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>

        {/* Permissions Card */}
        <div className="min-w-0 bg-white border border-purple-100 rounded-xl p-3 sm:p-3.5 shadow-2xs hover:shadow-xs transition flex items-center justify-between col-span-2 sm:col-span-1">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 uppercase tracking-wider truncate">
              {language === 'zh-CN' ? '请假/年假' : 'Permisos'}
            </span>
            <span className="text-xl sm:text-2xl font-bold text-purple-700 tracking-tight mt-0.5">
              {data?.resumen.permisos ?? 0}
            </span>
            <span className="text-[9px] sm:text-[10px] text-purple-600 font-medium truncate">
              {language === 'zh-CN' ? '假期与正当理由' : 'Vacaciones o justificados'}
            </span>
          </div>
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100 ml-1.5">
            <Umbrella className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
        </div>
      </div>

      {/* 6. BARRA DE FILTROS Y NAVEGACIÓN */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Side: Branch Selector & Employee Search */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Branch Filter */}
          <div className="flex items-center gap-2 min-w-[200px]">
            <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={!isGeneralAdmin && !!user?.branchId}
              className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition disabled:opacity-75 disabled:bg-slate-100 cursor-pointer"
            >
              {isGeneralAdmin && <option value="">{language === 'zh-CN' ? '全部分店' : 'Todas las sucursales'}</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search in Matrix */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={language === 'zh-CN' ? '搜索员工姓名或工号...' : 'Buscar empleado o código...'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Right Side: View Selector & Date Navigation */}
        <div className="flex flex-wrap items-center gap-3 justify-end">
          {/* View Selector: 1 Semana | 2 Semanas (Predeterminado) | Mes */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setViewMode('1week')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === '1week'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              {language === 'zh-CN' ? '周' : 'Semana'}
            </button>
            <button
              onClick={() => setViewMode('2weeks')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === '2weeks'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              {language === 'zh-CN' ? '2周' : '2 Semanas'}
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'month'
                  ? 'bg-white text-indigo-700 shadow-2xs font-bold'
                  : 'hover:text-slate-900'
              }`}
            >
              {language === 'zh-CN' ? '月' : 'Mes'}
            </button>
          </div>

          {/* Navigation Controls: [ ← ] [ Hoy ] [ → ] */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={handlePrevPeriod}
              title={`Retroceder ${viewMode === '1week' ? '1 semana' : viewMode === 'month' ? '4 semanas' : '2 semanas'}`}
              className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 text-slate-600 transition shadow-2xs"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleResetToToday}
              className="px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-white rounded-lg transition shadow-2xs"
            >
              {language === 'zh-CN' ? '今天' : 'Hoy'}
            </button>
            <button
              onClick={handleNextPeriod}
              title={`Avanzar ${viewMode === '1week' ? '1 semana' : viewMode === 'month' ? '4 semanas' : '2 semanas'}`}
              className="p-1.5 rounded-lg hover:bg-white hover:text-slate-900 text-slate-600 transition shadow-2xs"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Date Label */}
          <div className="text-xs font-semibold text-slate-700 bg-indigo-50/70 border border-indigo-100 px-3 py-1.5 rounded-xl whitespace-nowrap">
            {dateRange.startDate} <span className="text-indigo-400">{language === 'zh-CN' ? '至' : 'al'}</span> {dateRange.endDate}
          </div>
        </div>
      </div>

      {/* 2 & 10. TABLA VISUAL TIPO MATRIZ / CALENDARIO CON CABECERA STICKY Y COLUMNA EMPLEADO STICKY */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden w-full max-w-full">
        {/* Mobile Horizontal Navigation & Swipe Helper */}
        <div className="flex sm:hidden items-center justify-between px-3 py-2 bg-indigo-50/70 border-b border-indigo-100 text-xs">
          <button
            type="button"
            onClick={scrollDaysLeft}
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg shadow-2xs font-semibold active:bg-indigo-50 transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{language === 'zh-CN' ? '前几天' : 'Días ant.'}</span>
          </button>
          <span className="text-[11px] text-indigo-900 font-semibold flex items-center gap-1">
            <span>👈</span>
            <span>{language === 'zh-CN' ? '滑动查看日期' : 'Desliza días'}</span>
            <span>👉</span>
          </span>
          <button
            type="button"
            onClick={scrollDaysRight}
            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-indigo-200 text-indigo-700 rounded-lg shadow-2xs font-semibold active:bg-indigo-50 transition"
          >
            <span>{language === 'zh-CN' ? '后几天' : 'Días sig.'}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
            <span className="text-xs font-semibold text-slate-500">
              {language === 'zh-CN' ? `正在加载考勤矩阵 (${dateRange.daysCount} 天)...` : `Cargando matriz de asistencia (${dateRange.daysCount} días)...`}
            </span>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-xs">
            {language === 'zh-CN' ? '所选周期或筛选条件下无员工记录' : 'No se encontraron empleados para el periodo o filtro seleccionado.'}
          </div>
        ) : (
          <div ref={scrollContainerRef} className="overflow-x-auto sm:max-h-[750px] relative attendance-matrix-scroll w-full max-w-full">
            <table className="w-full min-w-[780px] sm:min-w-[880px] border-collapse text-left text-xs">
              {/* Table Header: Two Rows (Weeks Header & Days Header) */}
              <thead className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-xs select-none">
                {/* Row 1: Week Groups */}
                <tr className="border-b border-slate-200 text-slate-600 text-[11px] font-bold uppercase tracking-wider">
                  {/* Sticky Top-Left Corner for Employee Column */}
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-40 bg-slate-100/95 backdrop-blur-xs py-3 px-2 sm:px-4 min-w-[130px] max-w-[150px] sm:min-w-[220px] sm:max-w-[260px] border-r border-b border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{language === 'zh-CN' ? '员工' : 'Empleado'}</span>
                      <span className="text-[10px] font-mono text-slate-400">
                        {filteredEmployees.length} {language === 'zh-CN' ? '人' : 'activos'}
                      </span>
                    </div>
                  </th>

                  {/* Week Groups Headers */}
                  {weekGroups.map((wg, idx) => (
                    <th
                      key={`week-${wg.weekNumber}-${idx}`}
                      colSpan={wg.days.length}
                      className="py-2 px-3 text-center border-r border-slate-200 bg-indigo-50/50 text-indigo-900 font-bold whitespace-nowrap"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" />
                        <span>{language === 'zh-CN' ? `第 ${wg.weekNumber} 周` : `SEMANA ${wg.weekNumber}`}</span>
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Row 2: Days Header */}
                <tr className="border-b border-slate-200 text-slate-700 text-xs font-semibold">
                  {data?.dias.map((d) => (
                    <th
                      key={d.fecha}
                      className={`py-2 px-1 text-center min-w-[50px] sm:min-w-[56px] border-r border-slate-200 transition-colors ${
                        d.esHoy
                          ? 'bg-indigo-100/70 text-indigo-950 font-bold ring-1 ring-inset ring-indigo-400'
                          : d.esFinDeSemana
                          ? 'bg-slate-100/70 text-slate-500'
                          : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col items-center justify-center py-0.5">
                        <span
                          className={`text-[10px] font-bold ${
                            d.esHoy ? 'text-indigo-600' : d.esFinDeSemana ? 'text-slate-400' : 'text-slate-500'
                          }`}
                        >
                          {d.diaSemana}
                        </span>
                        <span
                          className={`text-xs font-mono font-bold ${
                            d.esHoy ? 'text-indigo-900 underline decoration-indigo-500 decoration-2' : ''
                          }`}
                        >
                          {d.numeroDia}
                        </span>
                        {d.esHoy && (
                          <span className="text-[8px] uppercase tracking-tighter text-indigo-700 font-extrabold mt-0.5">
                            {language === 'zh-CN' ? '今日' : 'Hoy'}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* Table Body: Employees Rows */}
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.map((emp) => (
                  <tr key={emp.empleadoId} className="hover:bg-slate-50/70 transition-colors group">
                    {/* Fixed First Column: Employee Info */}
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50/90 py-2.5 px-2 sm:px-4 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.03)] min-w-[130px] max-w-[150px] sm:min-w-[220px] sm:max-w-[260px] truncate">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800 truncate text-xs" title={emp.nombre}>
                            {emp.nombre}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-indigo-600 font-bold shrink-0">
                            {emp.codigo}
                          </span>
                          <span className="text-[10px] text-slate-400 hidden sm:inline">·</span>
                          <span className="text-[10px] text-slate-500 truncate hidden sm:inline" title={emp.departamento}>
                            {emp.departamento}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Attendance Days Columns */}
                    {emp.asistencias.map((att) => {
                      const isWeekend = att.diaSemana === 'S' || att.diaSemana === 'D';
                      const isToday = att.fecha === new Date().toISOString().split('T')[0];

                      return (
                        <td
                          key={att.fecha}
                          className={`py-2 px-1 text-center border-r border-slate-100 relative transition-all ${
                            isToday
                              ? 'bg-indigo-50/30'
                              : isWeekend
                              ? 'bg-slate-50/40'
                              : ''
                          } ${canEditAttendance ? 'cursor-pointer hover:bg-indigo-50/60' : ''}`}
                          onClick={() => handleOpenEdit(emp, att)}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              employee: emp,
                              attendance: att,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <div className="flex items-center justify-center">
                            <AttendanceStatusIcon
                              status={att.estado}
                              displayStatus={att.displayEstado}
                              isManualOverride={att.modificadoManual}
                              size="md"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer with Legends */}
        <div className="p-3.5 bg-slate-50/90 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-600 font-medium">
            <span className="font-semibold text-slate-700">
              {language === 'zh-CN' ? '考勤状态图例:' : 'Estados:'}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>{language === 'zh-CN' ? '正常 (A tiempo)' : 'A tiempo'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>{language === 'zh-CN' ? '迟到 (Retardo)' : 'Retardo'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>{language === 'zh-CN' ? '缺勤 (Falta)' : 'Falta'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
              <span>{language === 'zh-CN' ? '休息日 (Descanso)' : 'Descanso'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>{language === 'zh-CN' ? '请假/年假 (Permiso)' : 'Permiso / Vacaciones'}</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-[11px] font-semibold">
                {language === 'zh-CN' ? '(右上黄标 = 人工修改存证)' : '(Punto ámbar = Modificado administrativamente)'}
              </span>
            </div>
          </div>

          {canEditAttendance && (
            <div className="text-[11px] text-indigo-700 font-medium flex items-center gap-1">
              <Edit3 className="w-3 h-3" />
              <span>
                {language === 'zh-CN'
                  ? '点击任意单元格可进行人工状态修改与审计留痕'
                  : 'Haz clic en cualquier celda para corregir el estado administrativamente.'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 8. HOVER TOOLTIP / POPOVER FLOTANTE */}
      {hoveredCell && !editingCell && (
        <div
          className="fixed z-50 pointer-events-none transition-all duration-150 transform -translate-x-1/2 -translate-y-full mb-2"
          style={{
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 8}px`,
          }}
        >
          <div className="bg-slate-900/95 backdrop-blur-md text-white text-xs rounded-xl p-3.5 shadow-xl border border-slate-700 max-w-xs w-64 space-y-2 pointer-events-none">
            {/* Header */}
            <div className="border-b border-slate-700/80 pb-2 flex items-center justify-between">
              <div>
                <p className="font-bold text-slate-100 truncate">{hoveredCell.employee.nombre}</p>
                <p className="text-[10px] text-slate-400 font-mono">
                  {hoveredCell.employee.codigo} · {hoveredCell.attendance.fecha}
                </p>
              </div>
              <AttendanceStatusIcon
                status={hoveredCell.attendance.estado}
                size="xs"
                showOverrideBadge={false}
              />
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-y-1 text-[11px]">
              <div>
                <span className="text-slate-400">{language === 'zh-CN' ? '上班:' : 'Entrada:'}</span>
                <p className="font-mono font-bold text-emerald-400">
                  {hoveredCell.attendance.entrada || (language === 'zh-CN' ? '无打卡' : 'Sin checada')}
                </p>
              </div>
              <div>
                <span className="text-slate-400">{language === 'zh-CN' ? '下班:' : 'Salida:'}</span>
                <p className="font-mono font-bold text-indigo-300">
                  {hoveredCell.attendance.salida || (language === 'zh-CN' ? '无打卡' : 'Sin checada')}
                </p>
              </div>

              {hoveredCell.attendance.minutosRetardo > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-400">{language === 'zh-CN' ? '迟到时长:' : 'Retardo:'}</span>
                  <p className="font-bold text-amber-400">
                    {hoveredCell.attendance.minutosRetardo} {language === 'zh-CN' ? '分钟' : 'minutos'}
                  </p>
                </div>
              )}

              <div>
                <span className="text-slate-400">{language === 'zh-CN' ? '状态:' : 'Estado:'}</span>
                <p className="font-semibold text-slate-200">
                  {(() => {
                    const st = (hoveredCell.attendance.estado || '').toUpperCase();
                    if (language === 'zh-CN') {
                      if (st === 'ONTIME' || st === 'ATIEMPO') return '正常 (OnTime)';
                      if (st === 'LATE' || st === 'RETARDO') return '迟到 (Late)';
                      if (st === 'EARLYDEPARTURE' || st === 'SALIDAANTICIPADA') return '早退 (EarlyDeparture)';
                      if (st === 'ABSENT' || st === 'FALTA') return '缺勤 (Absent)';
                      if (st === 'RESTDAY' || st === 'DESCANSO') return '休息日 (RestDay)';
                      if (st === 'LEAVE' || st === 'PERMISO') return '请假/年假 (Leave)';
                      return hoveredCell.attendance.displayEstado || hoveredCell.attendance.estado;
                    }
                    return hoveredCell.attendance.displayEstado || hoveredCell.attendance.estado;
                  })()}
                </p>
              </div>
              <div>
                <span className="text-slate-400">{language === 'zh-CN' ? '来源:' : 'Origen:'}</span>
                <p className="font-mono text-slate-300">
                  {hoveredCell.attendance.origen?.toUpperCase() === 'MANUAL'
                    ? (language === 'zh-CN' ? '人工修正 (Manual)' : 'Manual')
                    : (language === 'zh-CN' ? '系统计算 (System)' : 'Sistema')}
                </p>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">{language === 'zh-CN' ? '分店:' : 'Sucursal:'}</span>
                <p className="text-slate-300 truncate">{hoveredCell.employee.sucursal}</p>
              </div>
            </div>

            {/* Manual Override Audit Info */}
            {hoveredCell.attendance.modificadoManual && (
              <div className="mt-2 pt-2 border-t border-amber-500/30 text-[10px] text-amber-300/90 space-y-0.5 bg-amber-500/10 p-2 rounded-lg">
                <p className="font-bold flex items-center gap-1">
                  <Edit3 className="w-2.5 h-2.5" />
                  {language === 'zh-CN' ? '人工修正记录' : 'Modificado manualmente'}
                </p>
                {hoveredCell.attendance.modificadoPor && (
                  <p>{language === 'zh-CN' ? '修改人:' : 'Por:'} {hoveredCell.attendance.modificadoPor}</p>
                )}
                {hoveredCell.attendance.fechaModificacion && (
                  <p>{language === 'zh-CN' ? '修改时间:' : 'Fecha:'} {hoveredCell.attendance.fechaModificacion}</p>
                )}
                {hoveredCell.attendance.motivoModificacion && (
                  <p className="italic">{language === 'zh-CN' ? '原因:' : 'Motivo:'} "{hoveredCell.attendance.motivoModificacion}"</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. MODAL / MENÚ DE EDICIÓN MANUAL */}
      {editingCell && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-indigo-600" />
                  <span>{language === 'zh-CN' ? '考勤状态行政变更与补正' : 'Modificación Administrativa de Asistencia'}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingCell.employee.nombre} · {editingCell.attendance.fecha}
                </p>
              </div>
              <button
                onClick={() => setEditingCell(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              {editSuccessMsg ? (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>{editSuccessMsg}</span>
                </div>
              ) : (
                <>
                  {/* Status Options Selector */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-2">
                      {language === 'zh-CN' ? '选择新出勤状态:' : 'Seleccionar Nuevo Estado:'}
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { code: 'ATIEMPO', label: language === 'zh-CN' ? '✓ 正常出勤 (OnTime)' : '✓ A tiempo (Presente)', desc: language === 'zh-CN' ? '符合正常工作排班时间' : 'Cumplió horario laboral normal' },
                        { code: 'RETARDO', label: language === 'zh-CN' ? '⏱ 迟到 (Late)' : '⏱ Retardo', desc: language === 'zh-CN' ? '打卡时间超过10分钟容差' : 'Llegada posterior a tolerancia' },
                        { code: 'FALTA', label: language === 'zh-CN' ? '✕ 缺勤 (Absent)' : '✕ Falta', desc: language === 'zh-CN' ? '无打卡记录且未批假' : 'Inasistencia sin justificar' },
                        { code: 'DESCANSO', label: language === 'zh-CN' ? '☕ 休息日 (RestDay)' : '☕ Descanso', desc: language === 'zh-CN' ? '轮休或法定公休节假日' : 'Día de descanso programado o festivo' },
                        { code: 'PERMISO', label: language === 'zh-CN' ? '🏖 请假/年假 (Leave)' : '🏖 Permiso / Vacaciones', desc: language === 'zh-CN' ? '事先获批的事假、年假或病假' : 'Ausencia autorizada previamente' },
                      ].map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={() => setEditStatus(opt.code)}
                          className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition ${
                            editStatus === opt.code
                              ? 'bg-indigo-50/80 border-indigo-500 text-indigo-900 font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <span className="block font-semibold">{opt.label}</span>
                            <span className="text-[10px] text-slate-500 font-normal">{opt.desc}</span>
                          </div>
                          <AttendanceStatusIcon status={opt.code} size="xs" showOverrideBadge={false} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Observation Input */}
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">
                      {language === 'zh-CN' ? '变更原因 / 审批备注 (可选):' : 'Observación / Motivo del cambio (Opcional):'}
                    </label>
                    <textarea
                      rows={2}
                      value={editObservation}
                      onChange={(e) => setEditObservation(e.target.value)}
                      placeholder={language === 'zh-CN' ? '例如: 交通堵塞 / 主管批准 / 医院就医证明...' : 'Ej: Tráfico / autorización del encargado / cita médica...'}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Audit Notice */}
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/70 text-[11px] text-amber-800 flex items-start gap-2">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      {language === 'zh-CN' ? (
                        <>
                          本次变更将完整记入<strong>系统审计日志</strong>，附带您的操作账号 ({user?.username})、时间戳与原状态。底层原始物理打卡存证不受破坏。
                        </>
                      ) : (
                        <>
                          Esta modificación quedará registrada en la <strong>auditoría del sistema</strong> con su usuario ({user?.username}), fecha/hora y estado anterior. El registro original de checadas se preserva intacto.
                        </>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            {!editSuccessMsg && (
              <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  disabled={savingEdit}
                  className="px-4 py-2 border border-slate-200 bg-white text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{language === 'zh-CN' ? '保存中...' : 'Guardando...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{language === 'zh-CN' ? '确认保存变更' : 'Guardar Modificación'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceMatrixView;
