import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, FileText, Filter, RefreshCw, Users } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface ReportStats {
  startDate: string;
  endDate: string;
  totalRecords: number;
  uniqueEmployees: number;
  totalLateMinutes: number;
  totalHoursWorked: number;
  totalWorkedMinutes: number;
  totalOvertimeHours: number;
  totalOvertimeMinutes: number;
  data: any[];
}

interface Branch {
  id: number;
  name: string;
}

export const ReportsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [branchId, setBranchId] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [includeEmptyDays, setIncludeEmptyDays] = useState<boolean>(false);
  const [branches, setBranches] = useState<Branch[]>([]);

  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await api.get('/v1/branches');
        setBranches(res.data || []);
      } catch (err) {
        console.error('Failed to load branches:', err);
      }
    };
    loadBranches();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/reports/attendance', {
        params: {
          startDate,
          endDate,
          branchId: branchId || undefined,
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
  }, [startDate, endDate, branchId, status, includeEmptyDays]);

  const renderStatusBadge = (statusStr: string, bilingualStatus?: string) => {
    const s = (bilingualStatus || statusStr || '').toLowerCase();
    if (s.includes('ontime') || s.includes('tiempo') || s.includes('准时')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {bilingualStatus || (language === 'zh-CN' ? '准时' : 'A tiempo')}
        </span>
      );
    }
    if (s.includes('late') || s.includes('retardo') || s.includes('迟到')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {bilingualStatus || (language === 'zh-CN' ? '迟到' : 'Retardo')}
        </span>
      );
    }
    if (s.includes('absent') || s.includes('falta') || s.includes('缺勤')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {bilingualStatus || (language === 'zh-CN' ? '缺勤' : 'Falta')}
        </span>
      );
    }
    if (s.includes('early') || s.includes('anticipada') || s.includes('早退')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          {bilingualStatus || (language === 'zh-CN' ? '早退' : 'Salida anticipada')}
        </span>
      );
    }
    if (s.includes('incomplete') || s.includes('incompleto') || s.includes('不全')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {bilingualStatus || (language === 'zh-CN' ? '打卡不全' : 'Incompleto')}
        </span>
      );
    }
    if (s.includes('rest') || s.includes('descanso') || s.includes('休息日')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap inline-flex items-center gap-1">
          {bilingualStatus || (language === 'zh-CN' ? '休息日' : 'Descanso')}
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 whitespace-nowrap inline-flex items-center">
        {bilingualStatus || statusStr}
      </span>
    );
  };

  const buildExportParams = () => ({
    startDate,
    endDate,
    branchId: branchId || undefined,
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            {t('reports.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? '支持中西双语的 Excel (.xlsx)、PDF 和 CSV 报表导出引擎，支持全打卡记录与自动工时统计'
              : 'Reportes bilingües (Español / Chino) en Excel (.xlsx), PDF y CSV con 4 checadas, horas efectivas y filtros'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition disabled:opacity-50"
            title="Descargar CSV con UTF-8 BOM"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>{t('reports.downloadCsv')}</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-600 hover:text-white transition shadow-2xs disabled:opacity-50"
            title="Descargar PDF con tipografía CJK bilingüe"
          >
            <Download className="w-4 h-4" />
            <span>{t('reports.downloadPdf')}</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition shadow-xs disabled:opacity-50"
            title="Descargar Excel con estilos ClosedXML"
          >
            <Download className="w-4 h-4" />
            <span>{t('reports.downloadXlsx')}</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-semibold">{t('reports.startDate')}:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-semibold">{t('reports.endDate')}:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        {/* Branch Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-semibold">{t('common.branch')}:</span>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">{language === 'zh-CN' ? '全部分店 (Todas)' : 'Todas las sucursales'}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-semibold">{t('common.status')}:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">{language === 'zh-CN' ? '全部状态 (Todos)' : 'Todos los estados'}</option>
            <option value="OnTime">{language === 'zh-CN' ? '准时 (A tiempo)' : 'A tiempo'}</option>
            <option value="Late">{language === 'zh-CN' ? '迟到 (Retardo)' : 'Retardo'}</option>
            <option value="Absent">{language === 'zh-CN' ? '缺勤 (Falta)' : 'Falta'}</option>
            <option value="EarlyExit">{language === 'zh-CN' ? '早退 (Salida anticipada)' : 'Salida anticipada'}</option>
            <option value="Incomplete">{language === 'zh-CN' ? '打卡不全 (Incompleto)' : 'Incompleto'}</option>
            <option value="Permission">{language === 'zh-CN' ? '请假 (Permiso)' : 'Permiso'}</option>
            <option value="Vacation">{language === 'zh-CN' ? '年假 (Vacaciones)' : 'Vacaciones'}</option>
            <option value="Disability">{language === 'zh-CN' ? '病假 (Incapacidad)' : 'Incapacidad'}</option>
          </select>
        </div>

        {/* Include Empty Days Checkbox */}
        <label className="flex items-center gap-2 text-xs text-slate-600 font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeEmptyDays}
            onChange={(e) => setIncludeEmptyDays(e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
          />
          <span>{language === 'zh-CN' ? '包含无打卡考勤 (Descansos/Inasistencias)' : 'Incluir días sin actividad'}</span>
        </label>

        <button
          onClick={fetchReportData}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          title="Actualizar datos"
        >
          <RefreshCw className="w-4 h-4 text-indigo-600" />
        </button>
      </div>

      {/* Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium block">
              {language === 'zh-CN' ? '员工人数 (Empleados)' : 'Empleados Únicos'}
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
              {stats.uniqueEmployees || 0}
            </span>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium block">
              {language === 'zh-CN' ? '考勤班次 (Jornadas)' : 'Jornadas Totales'}
            </span>
            <span className="text-xl font-bold text-slate-900 mt-1 block font-mono">
              {stats.totalRecords}
            </span>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium block">
              {language === 'zh-CN' ? '出勤工时 (Horas Trab)' : 'Horas Totales'}
            </span>
            <span className="text-xl font-bold text-indigo-600 mt-1 block font-mono">
              {stats.totalHoursWorked.toFixed(1)} h
            </span>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium block">
              {language === 'zh-CN' ? '迟到分钟 (Retardo)' : 'Retardo Total'}
            </span>
            <span className="text-xl font-bold text-amber-600 mt-1 block font-mono">
              {stats.totalLateMinutes} m
            </span>
          </div>
          <div className="bg-white border border-slate-200 p-3.5 rounded-xl shadow-xs">
            <span className="text-[11px] text-slate-500 font-medium block">
              {language === 'zh-CN' ? '加班工时 (Horas Extra)' : 'Horas Extra'}
            </span>
            <span className="text-xl font-bold text-emerald-600 mt-1 block font-mono">
              {stats.totalOvertimeHours.toFixed(1)} h
            </span>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {language === 'zh-CN' ? '数据抽样预览 (前 25 条记录)' : 'Vista Previa de Jornadas (Primeras 25)'}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {language === 'zh-CN' ? '中西双语导出 · QuestPDF + ClosedXML' : 'Reportes Bilingües · QuestPDF + ClosedXML'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/60 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '工号 (Código)' : 'Código'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '姓名 (Nombre)' : 'Empleado'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '门店 (Sucursal)' : 'Sucursal'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '部门 (Depto)' : 'Depto'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '日期 (Fecha)' : 'Fecha'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '上班 (Entrada)' : 'Entrada'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '午休出 (Sal. Com)' : 'Sal. Comida'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '午休入 (Reg. Com)' : 'Reg. Comida'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '下班 (Salida)' : 'Salida'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '迟到 (Retardo)' : 'Retardo'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '工时 (Horas)' : 'Horas'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '加班 (Extra)' : 'Extra'}</th>
                <th className="px-3 py-2.5">{language === 'zh-CN' ? '状态 (Estado)' : 'Estado'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : !stats || stats.data.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-slate-400">
                    {language === 'zh-CN' ? '当前筛选范围内无考勤数据' : 'Sin datos en este rango'}
                  </td>
                </tr>
              ) : (
                stats.data.slice(0, 25).map((row: any, idx: number) => (
                  <tr key={`${row.employeeCode}-${row.date}-${idx}`} className="hover:bg-slate-50/70 transition">
                    <td className="px-3 py-2 font-mono font-bold text-indigo-600">{row.employeeCode}</td>
                    <td className="px-3 py-2 text-slate-900 font-semibold">{row.employeeName}</td>
                    <td className="px-3 py-2 text-slate-600">{row.branchName}</td>
                    <td className="px-3 py-2 text-slate-600">{row.departmentName}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{row.date}</td>
                    <td className="px-3 py-2 font-mono font-medium text-emerald-600">{row.firstEntry || '-'}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{row.mealExit || '-'}</td>
                    <td className="px-3 py-2 font-mono text-slate-500">{row.mealReturn || '-'}</td>
                    <td className="px-3 py-2 font-mono font-medium text-indigo-600">{row.lastExit || '-'}</td>
                    <td className="px-3 py-2 font-mono">
                      {row.minutesLate > 0 ? (
                        <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                          {row.minutesLate} m
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-800 font-medium">
                      {row.hoursWorkedFormatted || `${row.hoursWorked} h`}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {row.overtimeMinutes > 0 ? (
                        <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/50">
                          {row.overtimeFormatted || `${row.overtimeHours} h`}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {renderStatusBadge(row.status, row.bilingualStatus)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
