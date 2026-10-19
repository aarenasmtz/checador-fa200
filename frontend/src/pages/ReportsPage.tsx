import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Download, FileText } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface ReportStats {
  startDate: string;
  endDate: string;
  totalRecords: number;
  totalLateMinutes: number;
  totalHoursWorked: number;
  totalOvertimeHours: number;
  data: any[];
}

export const ReportsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('');
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/reports/attendance', {
        params: {
          startDate,
          endDate,
          status: status || undefined,
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
  }, [startDate, endDate, status]);

  const renderStatusBadge = (statusStr: string) => {
    const s = (statusStr || '').toLowerCase();
    if (s.includes('ontime') || s.includes('presente') || s.includes('present')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {language === 'zh-CN' ? '正常 (OnTime)' : 'A tiempo (OnTime)'}
        </span>
      );
    }
    if (s.includes('late') || s.includes('retardo')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {language === 'zh-CN' ? '迟到 (Late)' : 'Retardo (Late)'}
        </span>
      );
    }
    if (s.includes('absent') || s.includes('falta')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {language === 'zh-CN' ? '缺勤 (Absent)' : 'Falta (Absent)'}
        </span>
      );
    }
    if (s.includes('early') || s.includes('salidatemprana')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
          {language === 'zh-CN' ? '早退 (Early)' : 'Salida Temprana (Early)'}
        </span>
      );
    }
    if (s.includes('incomplete') || s.includes('incompleto')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 whitespace-nowrap inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          {language === 'zh-CN' ? '打卡不全 (Incomplete)' : 'Incompleto (Incomplete)'}
        </span>
      );
    }
    if (s.includes('rest') || s.includes('descanso')) {
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200 whitespace-nowrap inline-flex items-center gap-1">
          {language === 'zh-CN' ? '休息日 (Rest)' : 'Descanso (Rest)'}
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 whitespace-nowrap inline-flex items-center">
        {statusStr}
      </span>
    );
  };

  const handleDownloadExcel = async () => {
    try {
      setDownloading(true);
      const res = await api.get('/v1/reports/export/excel', {
        params: { startDate, endDate, status: status || undefined },
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
        params: { startDate, endDate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Reporte_Asistencia_${startDate}.csv`);
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
        params: { startDate, endDate, status: status || undefined },
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
            {t('reports.subtitle')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadCsv}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <FileText className="w-4 h-4 text-indigo-600" />
            <span>{t('reports.downloadCsv')}</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-600 hover:text-white transition shadow-2xs"
          >
            <Download className="w-4 h-4" />
            <span>{t('reports.downloadPdf')}</span>
          </button>
          <button
            onClick={handleDownloadExcel}
            disabled={downloading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white transition shadow-xs"
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

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 font-semibold">{t('common.status')}:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="">{language === 'zh-CN' ? '全部状态' : 'Todos'}</option>
            <option value="OnTime">{t('status.onTime')}</option>
            <option value="Late">{t('status.late')}</option>
            <option value="Absent">{t('status.absent')}</option>
            <option value="Incomplete">{t('status.incomplete')}</option>
          </select>
        </div>
      </div>

      {/* Metric Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'zh-CN' ? '区间总记录数' : 'Registros Totales'}
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block font-mono">
              {stats.totalRecords}
            </span>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'zh-CN' ? '累计出勤工时' : 'Horas Totales'}
            </span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block font-mono">
              {stats.totalHoursWorked.toFixed(1)} h
            </span>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'zh-CN' ? '累计迟到分钟' : 'Minutos de Retardo'}
            </span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block font-mono">
              {stats.totalLateMinutes} m
            </span>
          </div>
          <div className="bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <span className="text-xs text-slate-500 font-medium block">
              {language === 'zh-CN' ? '累计加班工时' : 'Horas Extra'}
            </span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block font-mono">
              {stats.totalOvertimeHours.toFixed(1)} h
            </span>
          </div>
        </div>
      )}

      {/* Preview Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            {language === 'zh-CN' ? '数据抽样预览 (前 20 条记录)' : 'Vista Previa de Datos (Primeros 20)'}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {language === 'zh-CN' ? 'QuestPDF + ClosedXML 报表引擎' : 'Motor QuestPDF + ClosedXML'}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50/60 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5">{t('common.date')}</th>
                <th className="px-3 py-2.5">{t('common.code')}</th>
                <th className="px-3 py-2.5">{t('common.name')}</th>
                <th className="px-3 py-2.5">{t('common.branch')}</th>
                <th className="px-3 py-2.5">{t('common.entry')}</th>
                <th className="px-3 py-2.5">{t('common.exit')}</th>
                <th className="px-3 py-2.5">{t('common.workedHours')}</th>
                <th className="px-3 py-2.5">{t('common.lateMinutes')}</th>
                <th className="px-3 py-2.5">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : !stats || stats.data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-slate-400">
                    {language === 'zh-CN' ? '当前筛选范围内无考勤数据' : 'Sin datos en este rango'}
                  </td>
                </tr>
              ) : (
                stats.data.slice(0, 20).map((row: any) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-3 py-2 font-mono text-slate-500">{row.date}</td>
                    <td className="px-3 py-2 font-mono font-bold text-indigo-600">{row.employeeCode}</td>
                    <td className="px-3 py-2 text-slate-900 font-semibold">{row.employeeName}</td>
                    <td className="px-3 py-2 text-slate-600">{row.branchName}</td>
                    <td className="px-3 py-2 font-mono font-medium text-emerald-600">{row.firstEntry || '-'}</td>
                    <td className="px-3 py-2 font-mono font-medium text-indigo-600">{row.lastExit || '-'}</td>
                    <td className="px-3 py-2 font-mono text-slate-800 font-medium">{row.hoursWorked} h</td>
                    <td className="px-3 py-2 font-mono">
                      {row.minutesLate > 0 ? (
                        <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">{row.minutesLate}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {renderStatusBadge(row.status)}
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
