import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Eye, X, Shield } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface AuditItem {
  id: number;
  username: string;
  timestamp: string;
  ipAddress?: string;
  module: string;
  action: string;
  entity: string;
  recordId?: string;
  oldValues?: string;
  newValues?: string;
}

export const AuditPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/audit', {
        params: {
          module: moduleFilter || undefined,
          action: actionFilter || undefined,
        },
      });
      setLogs(res.data.items || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [moduleFilter, actionFilter]);

  const formatJson = (val?: string) => {
    if (!val) return null;
    try {
      const parsed = JSON.parse(val);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return val;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            {t('audit.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? '全方位记录系统操作员行为、敏感考勤复算、排班修改及权限变更轨迹'
              : 'Trazabilidad de modificaciones de horarios, recálculos y cambios administrativos'}
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder={language === 'zh-CN' ? '按模块筛选 (如: Attendance)...' : 'Filtrar módulo...'}
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
          />
          <button
            onClick={fetchLogs}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className="w-4 h-4 text-indigo-600" />
          </button>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 uppercase text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">{t('common.time')}</th>
                <th className="px-4 py-3">{language === 'zh-CN' ? '操作账号' : 'Usuario'}</th>
                <th className="px-4 py-3">{t('audit.module')}</th>
                <th className="px-4 py-3">{t('audit.action')}</th>
                <th className="px-4 py-3">{language === 'zh-CN' ? '变更实体' : 'Entidad'}</th>
                <th className="px-4 py-3">{language === 'zh-CN' ? 'IP 地址' : 'Dirección IP'}</th>
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
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    {language === 'zh-CN' ? '暂无审计日志记录' : 'No hay registros de auditoría'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-mono text-slate-500">{log.timestamp}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-indigo-600" />
                        <span>{log.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-mono">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-emerald-700">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">
                      {log.entity} {log.recordId ? `[#${log.recordId}]` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500">{log.ipAddress || '127.0.0.1'}</td>
                    <td className="px-4 py-3 text-right">
                      {(log.oldValues || log.newValues) ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-indigo-50 text-indigo-700 text-xs font-semibold transition border border-indigo-200 shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{language === 'zh-CN' ? '查看差分' : 'Ver Diff'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Diff Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {language === 'zh-CN' ? '数据变更前后对比' : 'Detalle de Auditoría - Valores Anteriores y Nuevos'}
                </h3>
                <span className="text-xs text-indigo-600 font-mono font-medium">
                  {selectedLog.module} · {selectedLog.action} · {selectedLog.timestamp}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              <div>
                <span className="text-xs font-bold text-rose-700 block mb-2">
                  {t('audit.oldValue')} (Before)
                </span>
                <pre className="bg-rose-50/70 border border-rose-200 p-3 rounded-lg text-xs font-mono text-rose-900 overflow-x-auto max-h-72">
                  {formatJson(selectedLog.oldValues) || (language === 'zh-CN' ? '(无变更前数据)' : '(Sin valores previos)')}
                </pre>
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-700 block mb-2">
                  {t('audit.newValue')} (After)
                </span>
                <pre className="bg-emerald-50/70 border border-emerald-200 p-3 rounded-lg text-xs font-mono text-emerald-900 overflow-x-auto max-h-72">
                  {formatJson(selectedLog.newValues) || (language === 'zh-CN' ? '(无变更后数据)' : '(Sin valores nuevos)')}
                </pre>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 shadow-2xs"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
