import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, Clock, RefreshCw, Check, X } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface Incident {
  id: number;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  branchName: string;
  date: string;
  type: string;
  description: string;
  minutes: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  approvedBy?: string;
  approvedAt?: string;
}

export const IncidentsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchIncidents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/incidents', {
        params: {
          status: statusFilter || undefined,
        },
      });
      setIncidents(res.data.items || []);
    } catch (err) {
      console.error('Failed to load incidents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, [statusFilter]);

  const handleApprove = async (id: number) => {
    try {
      await api.put(`/v1/incidents/${id}/approve`);
      setActionMsg(language === 'zh-CN' ? '已批准并重新核算该日考勤' : 'Incidencia aprobada y asistencia recalculada');
      fetchIncidents();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleReject = async (id: number) => {
    try {
      await api.put(`/v1/incidents/${id}/reject`);
      setActionMsg(language === 'zh-CN' ? '已驳回该异常申请' : 'Incidencia rechazada');
      fetchIncidents();
      setTimeout(() => setActionMsg(null), 4000);
    } catch (err) {
      console.error('Reject failed:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            {t('incidents.approved')}
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            {t('incidents.rejected')}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            {t('incidents.pending')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            {t('incidents.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? '审批请假、补签、公休以及迟到正当理由申请，批准后自动触发工时复算'
              : 'Aprobación de incidencias, permisos, retardos justificados y recálculo automático'}
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-medium text-slate-800 shadow-2xs focus:outline-none focus:border-indigo-500"
          >
            <option value="">{language === 'zh-CN' ? '全部审批状态' : 'Todos los estados'}</option>
            <option value="Pending">{t('incidents.pending')}</option>
            <option value="Approved">{t('incidents.approved')}</option>
            <option value="Rejected">{t('incidents.rejected')}</option>
          </select>
          <button
            onClick={fetchIncidents}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className="w-4 h-4 text-indigo-600" />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-2xs">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionMsg}</span>
        </div>
      )}

      {/* Incidents Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 uppercase text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t('common.date')}</th>
                <th className="px-4 py-3">{t('common.name')}</th>
                <th className="px-4 py-3">{t('common.branch')}</th>
                <th className="px-4 py-3">{t('incidents.type')}</th>
                <th className="px-4 py-3">{t('incidents.reason')}</th>
                <th className="px-4 py-3">{t('incidents.status')}</th>
                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    {language === 'zh-CN' ? '暂无异常待处理记录' : 'No hay incidencias registradas'}
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 font-mono text-slate-500">{inc.date}</td>
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{inc.employeeName}</div>
                      <div className="text-[11px] text-indigo-600 font-mono font-medium">{inc.employeeCode}</div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-600">{inc.branchName}</td>
                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                        {inc.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-xs truncate text-slate-600" title={inc.description}>
                      {inc.description}
                    </td>
                    <td className="px-4 py-3.5">{getStatusBadge(inc.status)}</td>
                    <td className="px-4 py-3.5 text-right">
                      {inc.status === 'Pending' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleApprove(inc.id)}
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white transition border border-emerald-200 shadow-2xs"
                            title={t('incidents.approve')}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleReject(inc.id)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white transition border border-rose-200 shadow-2xs"
                            title={t('incidents.reject')}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">
                          {inc.approvedBy || '-'}
                        </span>
                      )}
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
