import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Download, 
  FileText, 
  RefreshCw, 
  Users, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  ChevronLeft, 
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  Fingerprint
} from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface RawPunch {
  time: string;
  method: string;
  nativePunchCode: number;
  deviceName?: string;
}

interface ReportItem {
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  departmentName: string;
  date: string;
  firstEntry?: string;
  mealExit?: string;
  mealReturn?: string;
  lastExit?: string;
  minutesLate: number;
  minutesWorked: number;
  hoursWorked?: number;
  hoursWorkedFormatted: string;
  overtimeMinutes: number;
  overtimeHours: number;
  status: string;
  bilingualStatus: string;
  requiresReview: boolean;
  reviewNotes?: string;
  isConfirmed: boolean;
  isFuture: boolean;
  justificationInfo?: string;
  rawPunches?: RawPunch[];
}

interface ReportStats {
  companyName: string;
  startDate: string;
  endDate: string;
  totalRecords: number;
  uniqueEmployees: number;
  totalConfirmedHours: number;
  totalConfirmedMinutes: number;
  totalConfirmedFormatted: string;
  totalLateMinutes: number;
  pendingReviewCount: number;
  excludedFromHoursCount: number;
  data: ReportItem[];
}

interface Branch {
  id: number;
  name: string;
}

interface EmployeeOption {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  branchId: number;
  branchName?: string;
  departmentName?: string;
}

// Helper: Calculate Monday to Sunday dates
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay(); // 0 is Sunday, 1 is Monday
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getSunday(monday: Date): Date {
  const date = new Date(monday);
  date.setDate(date.getDate() + 6);
  date.setHours(23, 59, 59, 999);
  return date;
}

function toIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const ReportsPage: React.FC = () => {
  const { t, language } = useLanguage();

  // Initialize with current week Monday to Sunday
  const [currentMonday, setCurrentMonday] = useState<Date>(() => getMonday(new Date()));
  const [startDate, setStartDate] = useState<string>(() => toIsoDate(getMonday(new Date())));
  const [endDate, setEndDate] = useState<string>(() => toIsoDate(getSunday(getMonday(new Date()))));

  const [branchId, setBranchId] = useState<string>('');
  const [employeeId, setEmployeeId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [includeEmptyDays, setIncludeEmptyDays] = useState<boolean>(false);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Expanded row IDs for viewing punch audit and justification details
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // 1. Load branches & employees list for filters
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [branchRes, empRes] = await Promise.all([
          api.get('/v1/branches'),
          api.get('/v1/employees?pageSize=300')
        ]);
        setBranches(branchRes.data || []);
        const empItems = empRes.data?.items || empRes.data || [];
        setEmployees(empItems);
      } catch (err) {
        console.error('Failed to load branches/employees metadata:', err);
      }
    };
    loadMetadata();
  }, []);

  // 2. Fetch Report Data
  const fetchReportData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/reports/attendance', {
        params: {
          startDate,
          endDate,
          branchId: branchId || undefined,
          employeeId: employeeId || undefined,
          status: status || undefined,
          includeEmptyDays,
        },
      });
      setStats(res.data);
    } catch (err) {
      console.error('Failed to load report data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate, branchId, employeeId, status, includeEmptyDays]);

  // 3. Weekly Navigation Handlers
  const handleSelectPreviousWeek = () => {
    const prevMon = new Date(currentMonday);
    prevMon.setDate(prevMon.getDate() - 7);
    const prevSun = getSunday(prevMon);
    setCurrentMonday(prevMon);
    setStartDate(toIsoDate(prevMon));
    setEndDate(toIsoDate(prevSun));
  };

  const handleSelectCurrentWeek = () => {
    const thisMon = getMonday(new Date());
    const thisSun = getSunday(thisMon);
    setCurrentMonday(thisMon);
    setStartDate(toIsoDate(thisMon));
    setEndDate(toIsoDate(thisSun));
  };

  const handleSelectNextWeek = () => {
    const nextMon = new Date(currentMonday);
    nextMon.setDate(nextMon.getDate() + 7);
    const nextSun = getSunday(nextMon);
    setCurrentMonday(nextMon);
    setStartDate(toIsoDate(nextMon));
    setEndDate(toIsoDate(nextSun));
  };

  const toggleRowExpansion = (key: string) => {
    setExpandedRows(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const buildExportParams = () => ({
    startDate,
    endDate,
    branchId: branchId || undefined,
    employeeId: employeeId || undefined,
    status: status || undefined,
    includeEmptyDays,
  });

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const res = await api.get('/v1/reports/export/excel', {
        params: buildExportParams(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte_Asistencia_${startDate}_${endDate}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Excel download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      const res = await api.get('/v1/reports/export/pdf', {
        params: buildExportParams(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte_Asistencia_${startDate}_${endDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadCsv = async () => {
    try {
      setDownloading(true);
      const res = await api.get('/v1/reports/export/csv', {
        params: buildExportParams(),
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte_Asistencia_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('CSV download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const renderStatusBadge = (bilingualStatus: string) => {
    const s = bilingualStatus.toLowerCase();
    if (s.includes('completo') || s.includes('完整') || s.includes('a tiempo') || s.includes('准时')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
          {bilingualStatus}
        </span>
      );
    }
    if (s.includes('retardo') || s.includes('迟到')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-900 border border-amber-300 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
          {bilingualStatus}
        </span>
      );
    }
    if (s.includes('salida justificada') || s.includes('提前下班')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-300 whitespace-nowrap inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3 text-sky-600" />
          {bilingualStatus}
        </span>
      );
    }
    if (s.includes('incompleto') || s.includes('不全') || s.includes('pendiente') || s.includes('待核查')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-900 border border-purple-300 whitespace-nowrap inline-flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 text-purple-600" />
          {bilingualStatus}
        </span>
      );
    }
    if (s.includes('programado') || s.includes('待出勤') || s.includes('en curso') || s.includes('进行中')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200 whitespace-nowrap inline-flex items-center gap-1">
          <Clock className="w-3 h-3 text-blue-500" />
          {bilingualStatus}
        </span>
      );
    }
    if (s.includes('falta') || s.includes('缺勤') || s.includes('sin checadas') || s.includes('无打卡')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-300 whitespace-nowrap inline-flex items-center gap-1">
          <ShieldAlert className="w-3 h-3 text-rose-600" />
          {bilingualStatus}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300 whitespace-nowrap inline-flex items-center">
        {bilingualStatus}
      </span>
    );
  };

  // Filter employees by branch when branch is selected
  const filteredEmployees = branchId
    ? employees.filter(e => e.branchId === parseInt(branchId, 10))
    : employees;

  const selectedEmployeeObj = employeeId 
    ? employees.find(e => e.id === parseInt(employeeId, 10))
    : null;

  return (
    <div className="space-y-5 bg-white text-slate-800 p-2 sm:p-4 rounded-xl">
      {/* 1. Header Block with Bai Fen Bai Branding */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-emerald-800 text-white text-xs font-bold tracking-wide">
              {stats?.companyName || 'Bai Fen Bai (百分百)'}
            </span>
            <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {language === 'zh-CN' ? '周薪结算报表' : 'Revisión Semanal de Nómina'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-700" />
            <span>Reporte de Asistencia / 员工考勤报表</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? '为 Bai Fen Bai 百分百 餐厅提供清晰的每周考勤与打卡明细汇总，专供周一发薪核算使用'
              : 'Resumen semanal unificado de 4 checadas, horas efectivas y justificaciones para la revisión de pago de los lunes de David Guan'}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white shadow-xs transition disabled:opacity-50"
            title="Descargar Excel oficial con 9 columnas y formato ClosedXML"
          >
            <Download className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '导出 Excel (.xlsx)' : 'Exportar Excel'}</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-rose-300 text-xs font-semibold text-rose-700 hover:bg-rose-50 shadow-2xs transition disabled:opacity-50"
            title="Descargar reporte PDF horizontal con tipografía CJK bilingüe"
          >
            <FileText className="w-4 h-4 text-rose-600" />
            <span>{language === 'zh-CN' ? '导出 PDF' : 'Exportar PDF'}</span>
          </button>

          <button
            onClick={handleDownloadCsv}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50"
            title="Descargar CSV con UTF-8 BOM"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Weekly Navigation Toolbar (Monday to Sunday) */}
      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
          {/* Quick Week Select Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 mr-1">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>{language === 'zh-CN' ? '周快捷选择:' : 'Periodo Semanal:'}</span>
            </span>

            {/* Previous Week: Prominent 1-click button for Monday payroll review */}
            <button
              type="button"
              onClick={handleSelectPreviousWeek}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              title="Semana anterior de Lunes a Domingo (Revisión de pago del lunes)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>{language === 'zh-CN' ? '◀ 上周 (周一发薪核算)' : '◀ Semana anterior (Pago Lunes)'}</span>
            </button>

            <button
              type="button"
              onClick={handleSelectCurrentWeek}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              title="Semana actual en curso de Lunes a Domingo"
            >
              <span>{language === 'zh-CN' ? '本周 (当前周期)' : 'Semana actual'}</span>
            </button>

            <button
              type="button"
              onClick={handleSelectNextWeek}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition"
              title="Semana siguiente"
            >
              <span>{language === 'zh-CN' ? '下周 ▶' : 'Semana siguiente ▶'}</span>
            </button>
          </div>

          {/* Active Period Full Dates Indicator */}
          <div className="text-xs font-mono font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 px-3 py-1.5 rounded-lg">
            <span>📅 {startDate} ({language === 'zh-CN' ? '周一' : 'Lunes'})</span>
            <span className="mx-2 text-emerald-500">➜</span>
            <span>{endDate} ({language === 'zh-CN' ? '周日' : 'Domingo'})</span>
          </div>
        </div>

        {/* Detailed Filters Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          {/* Custom Date Pickers */}
          <div>
            <label className="text-[11px] text-slate-600 font-semibold block mb-1">
              {language === 'zh-CN' ? '起始日期 (Inicio)' : 'Fecha de inicio:'}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-600 font-semibold block mb-1">
              {language === 'zh-CN' ? '结束日期 (Fin)' : 'Fecha de fin:'}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* Branch Filter */}
          <div>
            <label className="text-[11px] text-slate-600 font-semibold block mb-1">
              {language === 'zh-CN' ? '分店 (Sucursal)' : 'Sucursal:'}
            </label>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                setEmployeeId(''); // reset employee when branch changes
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">{language === 'zh-CN' ? '全部分店 (Todas)' : 'Todas las sucursales'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* Employee Filter */}
          <div>
            <label className="text-[11px] text-slate-600 font-semibold block mb-1">
              {language === 'zh-CN' ? '员工 (Empleado)' : 'Empleado:'}
            </label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">{language === 'zh-CN' ? '全部员工 (Todos)' : 'Todos los empleados'}</option>
              {filteredEmployees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  [{emp.employeeCode}] {emp.firstName} {emp.lastName}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[11px] text-slate-600 font-semibold block mb-1">
              {language === 'zh-CN' ? '考勤状态 (Estado)' : 'Estado:'}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-600 focus:outline-none"
            >
              <option value="">{language === 'zh-CN' ? '全部状态 (Todos)' : 'Todos los estados'}</option>
              <option value="OnTime">{language === 'zh-CN' ? '完整 / 准时 (Completo)' : 'Completo (A tiempo)'}</option>
              <option value="Late">{language === 'zh-CN' ? '迟到 (Retardo)' : 'Retardo'}</option>
              <option value="Incomplete">{language === 'zh-CN' ? '打卡不全 (Incompleto)' : 'Incompleto'}</option>
              <option value="EarlyExit">{language === 'zh-CN' ? '早退 / 批准提前下班' : 'Salida anticipada'}</option>
              <option value="Absent">{language === 'zh-CN' ? '无打卡 / 缺勤 (Falta)' : 'Sin checadas / Falta'}</option>
              <option value="Permission">{language === 'zh-CN' ? '请假 (Permiso)' : 'Permiso'}</option>
              <option value="Vacation">{language === 'zh-CN' ? '年假 (Vacaciones)' : 'Vacaciones'}</option>
              <option value="Disability">{language === 'zh-CN' ? '病假 (Incapacidad)' : 'Incapacidad'}</option>
            </select>
          </div>
        </div>

        {/* Checkbox & Refresh Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeEmptyDays}
              onChange={(e) => setIncludeEmptyDays(e.target.checked)}
              className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600 w-4 h-4"
            />
            <span>{language === 'zh-CN' ? '包含未打卡排班 (休息日、未来排班与未打卡记录)' : 'Incluir días sin actividad (Descansos / Programados)'}</span>
          </label>

          <button
            onClick={fetchReportData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-800" />
            <span>{language === 'zh-CN' ? '刷新数据' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* 3. Single Employee Profile Header (when filtered by employee) */}
      {selectedEmployeeObj && stats && (
        <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-800 text-white font-bold flex items-center justify-center text-sm">
              {selectedEmployeeObj.firstName.charAt(0)}{selectedEmployeeObj.lastName.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs bg-emerald-800 text-white px-2 py-0.5 rounded">
                  {selectedEmployeeObj.employeeCode}
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {selectedEmployeeObj.firstName} {selectedEmployeeObj.lastName}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {selectedEmployeeObj.branchName || 'Sucursal'} {selectedEmployeeObj.departmentName ? `• ${selectedEmployeeObj.departmentName}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="text-right">
              <span className="text-slate-500 block text-[11px]">{language === 'zh-CN' ? '本周确认工时' : 'Horas confirmadas:'}</span>
              <span className="font-bold text-emerald-800 text-sm font-mono">{stats.totalConfirmedFormatted}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[11px]">{language === 'zh-CN' ? '累计迟到' : 'Retardo total:'}</span>
              <span className="font-bold text-amber-700 text-sm font-mono">{stats.totalLateMinutes} min</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block text-[11px]">{language === 'zh-CN' ? '待核查班次' : 'Jornadas pendientes:'}</span>
              <span className="font-bold text-purple-700 text-sm font-mono">{stats.pendingReviewCount}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. KPI Summary Cards (5 Cards) */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
            <span className="text-[11px] text-slate-500 font-semibold block">
              {language === 'zh-CN' ? '员工人数 (Empleados)' : 'Empleados Únicos'}
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
              {stats.uniqueEmployees || 0}
            </span>
          </div>

          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-2xs">
            <span className="text-[11px] text-slate-500 font-semibold block">
              {language === 'zh-CN' ? '考勤班次 (Jornadas)' : 'Jornadas Totales'}
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
              {stats.totalRecords}
            </span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl shadow-2xs">
            <span className="text-[11px] text-emerald-800 font-semibold block">
              {language === 'zh-CN' ? '确认总工时 (Horas Confirmadas)' : 'Total Horas Confirmadas'}
            </span>
            <span className="text-xl font-bold text-emerald-800 mt-1 block font-mono">
              {stats.totalConfirmedFormatted}
            </span>
            <span className="text-[10px] text-emerald-600 block mt-0.5">
              ({stats.totalConfirmedHours.toFixed(1)} h decimales)
            </span>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl shadow-2xs">
            <span className="text-[11px] text-amber-800 font-semibold block">
              {language === 'zh-CN' ? '迟到总计 (Retardo Total)' : 'Total Minutos Retardo'}
            </span>
            <span className="text-xl font-bold text-amber-800 mt-1 block font-mono">
              {stats.totalLateMinutes} m
            </span>
          </div>

          <div className="bg-purple-50 border border-purple-200 p-3.5 rounded-xl shadow-2xs">
            <span className="text-[11px] text-purple-800 font-semibold block">
              {language === 'zh-CN' ? '待核查班次 (Pendientes)' : 'Jornadas Pendientes'}
            </span>
            <span className="text-xl font-bold text-purple-800 mt-1 block font-mono">
              {stats.pendingReviewCount}
            </span>
            <span className="text-[10px] text-purple-600 block mt-0.5">
              *Excluidas del total de horas
            </span>
          </div>
        </div>
      )}

      {/* 5. Main Attendance Table (Exactly 9 Columns in Specified Order) */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-4 py-3 bg-emerald-900 text-white flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-300" />
            <span className="text-xs font-bold uppercase tracking-wider">
              {language === 'zh-CN' ? '考勤明细列表 (9列标准核算视图)' : 'Detalle de Asistencia por Jornada (9 Columnas Oficiales)'}
            </span>
          </div>
          <span className="text-[11px] text-emerald-200">
            {language === 'zh-CN' ? '点击行可展开原始打卡与考勤说明' : 'Clic en cualquier fila para ver checadas biométricas y justificaciones'}
          </span>
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Dark Green 2-Line Header */}
            <thead className="bg-[#166534] text-white border-b border-emerald-900">
              <tr>
                <th className="px-3 py-2.5 w-[22%]">
                  <div className="font-bold">1. Empleado</div>
                  <div className="text-[10px] text-emerald-200 font-normal">员工 (ID / 姓名)</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[10%]">
                  <div className="font-bold">2. Fecha</div>
                  <div className="text-[10px] text-emerald-200 font-normal">日期 (YYYY-MM-DD)</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[8%]">
                  <div className="font-bold">3. Entrada</div>
                  <div className="text-[10px] text-emerald-200 font-normal">上班</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[9%]">
                  <div className="font-bold">4. Sal. comer</div>
                  <div className="text-[10px] text-emerald-200 font-normal">午休开始</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[9%]">
                  <div className="font-bold">5. Reg. comer</div>
                  <div className="text-[10px] text-emerald-200 font-normal">午休结束</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[8%]">
                  <div className="font-bold">6. Salida</div>
                  <div className="text-[10px] text-emerald-200 font-normal">下班</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[12%]">
                  <div className="font-bold">7. Horas trabajadas</div>
                  <div className="text-[10px] text-emerald-200 font-normal">实际工时</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[8%]">
                  <div className="font-bold">8. Retardo (min)</div>
                  <div className="text-[10px] text-emerald-200 font-normal">迟到分钟</div>
                </th>
                <th className="px-3 py-2.5 text-center w-[14%]">
                  <div className="font-bold">9. Estado</div>
                  <div className="text-[10px] text-emerald-200 font-normal">状态</div>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
                      <span>{t('common.loading')}</span>
                    </div>
                  </td>
                </tr>
              ) : !stats || stats.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    {language === 'zh-CN' ? '所选周期范围内暂无考勤数据' : 'No hay registros de asistencia en el periodo seleccionado'}
                  </td>
                </tr>
              ) : (
                stats.data.map((row: ReportItem, idx: number) => {
                  const rowKey = `${row.employeeCode}-${row.date}-${idx}`;
                  const isExpanded = !!expandedRows[rowKey];
                  const isEven = idx % 2 === 0;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        onClick={() => toggleRowExpansion(rowKey)}
                        className={`cursor-pointer transition select-none ${
                          isEven ? 'bg-white hover:bg-emerald-50/40' : 'bg-slate-50/60 hover:bg-emerald-50/40'
                        } ${isExpanded ? 'bg-emerald-50/60 border-l-4 border-l-emerald-700' : ''}`}
                      >
                        {/* 1. Empleado / 员工 (Identified by ID + Name) */}
                        <td className="px-3 py-2.5 align-middle">
                          <div className="flex items-center gap-2">
                            <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-100 text-slate-800 border border-slate-300">
                              {row.employeeCode}
                            </span>
                            <span className="font-semibold text-slate-900 leading-snug">
                              {row.employeeName}
                            </span>
                          </div>
                          {row.branchName && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {row.branchName}
                            </div>
                          )}
                        </td>

                        {/* 2. Fecha / 日期 */}
                        <td className="px-3 py-2.5 font-mono text-center text-slate-700 font-medium align-middle">
                          {row.date}
                        </td>

                        {/* 3. Entrada / 上班 */}
                        <td className="px-3 py-2.5 font-mono text-center align-middle font-bold text-slate-900">
                          {row.firstEntry || <span className="text-slate-400 font-normal">-</span>}
                        </td>

                        {/* 4. Salida a comer / 午休开始 */}
                        <td className="px-3 py-2.5 font-mono text-center align-middle text-slate-600">
                          {row.mealExit || <span className="text-slate-400">-</span>}
                        </td>

                        {/* 5. Regreso de comer / 午休结束 */}
                        <td className="px-3 py-2.5 font-mono text-center align-middle text-slate-600">
                          {row.mealReturn || <span className="text-slate-400">-</span>}
                        </td>

                        {/* 6. Salida / 下班 */}
                        <td className="px-3 py-2.5 font-mono text-center align-middle font-bold text-slate-900">
                          {row.lastExit || <span className="text-slate-400 font-normal">-</span>}
                        </td>

                        {/* 7. Horas trabajadas / 实际工时 */}
                        <td className="px-3 py-2.5 text-center align-middle">
                          {row.isConfirmed ? (
                            <span className="font-mono font-bold text-emerald-800 text-xs">
                              {row.hoursWorkedFormatted}
                            </span>
                          ) : (
                            <span className="text-[11px] italic font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {row.hoursWorkedFormatted}
                            </span>
                          )}
                        </td>

                        {/* 8. Retardo en minutos / 迟到分钟 */}
                        <td className="px-3 py-2.5 text-center font-mono align-middle">
                          {row.minutesLate > 0 ? (
                            <span className="font-bold text-amber-800 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded">
                              {row.minutesLate} m
                            </span>
                          ) : (
                            <span className="text-slate-400">0</span>
                          )}
                        </td>

                        {/* 9. Estado / 状态 + Expand Toggle */}
                        <td className="px-3 py-2.5 text-center align-middle">
                          <div className="flex items-center justify-center gap-1.5">
                            {renderStatusBadge(row.bilingualStatus)}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowExpansion(rowKey);
                              }}
                              className="p-1 rounded hover:bg-slate-200 text-slate-500 transition"
                              title="Ver checadas originales y justificaciones"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable Detail Row */}
                      {isExpanded && (
                        <tr className="bg-emerald-50/30 border-b border-emerald-100">
                          <td colSpan={9} className="px-4 py-3">
                            <div className="space-y-2 text-xs">
                              {/* Justification or Missing Punch Alert */}
                              {row.justificationInfo && (
                                <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold block">Autorización de Permiso / 批准说明:</span>
                                    <span>{row.justificationInfo}</span>
                                  </div>
                                </div>
                              )}

                              {row.reviewNotes && (
                                <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 flex items-start gap-2">
                                  <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold block">Observación de Jornada / 异常说明:</span>
                                    <span>{row.reviewNotes}</span>
                                  </div>
                                </div>
                              )}

                              {/* Raw Biometric Punches Sub-table */}
                              <div className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2 font-semibold text-slate-700">
                                  <Fingerprint className="w-4 h-4 text-emerald-700" />
                                  <span>Checadas Biométricas Originales FA200 (原始打卡明细)</span>
                                </div>

                                {row.rawPunches && row.rawPunches.length > 0 ? (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                    {row.rawPunches.map((punch, pIdx) => (
                                      <div key={pIdx} className="p-2 rounded bg-slate-50 border border-slate-200 text-[11px] font-mono">
                                        <div className="font-bold text-slate-900">{punch.time}</div>
                                        <div className="text-slate-500">
                                          Método: <span className="font-semibold text-slate-700">{punch.method}</span>
                                        </div>
                                        <div className="text-slate-500">
                                          Código: <span className="font-semibold text-slate-700">{punch.nativePunchCode}</span>
                                        </div>
                                        <div className="text-slate-400 text-[10px] truncate">{punch.deviceName}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 italic">
                                    No se registraron eventos biométricos físicos en esta fecha.
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View: Responsive Cards per Shift */}
        <div className="block md:hidden p-3 space-y-3">
          {loading ? (
            <div className="text-center py-8 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-700 mb-2" />
              <span>{t('common.loading')}</span>
            </div>
          ) : !stats || stats.data.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs">
              {language === 'zh-CN' ? '暂无数据' : 'Sin datos'}
            </div>
          ) : (
            stats.data.map((row: ReportItem, idx: number) => {
              const rowKey = `mob-${row.employeeCode}-${row.date}-${idx}`;
              const isExpanded = !!expandedRows[rowKey];

              return (
                <div key={rowKey} className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-2">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-xs bg-slate-100 px-1.5 py-0.5 rounded border border-slate-300">
                          {row.employeeCode}
                        </span>
                        <span className="font-bold text-slate-900 text-xs">{row.employeeName}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5">{row.date}</div>
                    </div>
                    <div>{renderStatusBadge(row.bilingualStatus)}</div>
                  </div>

                  {/* 2x2 Punches Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2 rounded-lg font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block">3. Entrada (上班):</span>
                      <span className="font-bold text-slate-900">{row.firstEntry || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">4. Sal. comer (午休开始):</span>
                      <span className="text-slate-700">{row.mealExit || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">5. Reg. comer (午休结束):</span>
                      <span className="text-slate-700">{row.mealReturn || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">6. Salida (下班):</span>
                      <span className="font-bold text-slate-900">{row.lastExit || '-'}</span>
                    </div>
                  </div>

                  {/* Worked Hours & Late */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="text-slate-500 text-[11px]">7. Horas trabajadas: </span>
                      {row.isConfirmed ? (
                        <span className="font-bold text-emerald-800 font-mono">{row.hoursWorkedFormatted}</span>
                      ) : (
                        <span className="text-purple-700 italic font-semibold">{row.hoursWorkedFormatted}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 text-[11px]">8. Retardo: </span>
                      <span className="font-bold text-amber-800 font-mono">{row.minutesLate} m</span>
                    </div>
                  </div>

                  {/* Toggle Details Button */}
                  <button
                    type="button"
                    onClick={() => toggleRowExpansion(rowKey)}
                    className="w-full text-center py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded hover:bg-emerald-100 transition"
                  >
                    {isExpanded ? 'Ocultar detalles ▲' : 'Ver checadas y justificaciones ▼'}
                  </button>

                  {/* Expanded Mobile Detail */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 text-[11px] space-y-1.5">
                      {row.justificationInfo && (
                        <div className="p-2 bg-sky-50 rounded border border-sky-200 text-sky-900">
                          {row.justificationInfo}
                        </div>
                      )}
                      {row.reviewNotes && (
                        <div className="p-2 bg-purple-50 rounded border border-purple-200 text-purple-900">
                          {row.reviewNotes}
                        </div>
                      )}
                      {row.rawPunches && row.rawPunches.length > 0 && (
                        <div className="space-y-1 font-mono text-[10px] bg-slate-50 p-2 rounded">
                          <div className="font-bold text-slate-700">Checadas registradas:</div>
                          {row.rawPunches.map((p, i) => (
                            <div key={i} className="flex justify-between text-slate-600">
                              <span>{p.time} ({p.method})</span>
                              <span>Cod: {p.nativePunchCode}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
