import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Eye, X, Shield, Cpu, Globe, Search } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { ErrorState, LoadingState } from '../components/AsyncState';
import { AuditChanges } from '../components/AuditChanges';

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditItem | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get('/v1/audit', {
        params: {
          module: moduleFilter || undefined,
          action: actionFilter || undefined,
        },
      });
      setLogs(res.data.items || []);
    } catch (err: any) {
      console.error('Failed to load audit logs:', err);
      setLoadError(err.response?.data?.message || t('common.loadErrorDescription'));
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

  const parseJsonData = (val?: string) => {
    if (!val) return null;
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  };

  // Requirement 6: Device IP & Origin presentation logic
  const renderOriginBadge = (log: AuditItem) => {
    const payload = parseJsonData(log.newValues) || {};
    const isDeviceEvent = log.module === 'Biometric' || log.entity === 'BiometricDevice';
    const loopback = log.ipAddress === '127.0.0.1' || log.ipAddress === '::1';
    const deviceIp = payload.deviceIp || (log.module === 'Biometric' && !loopback && log.ipAddress !== 'No registrada' ? log.ipAddress : null);
    return <div className="space-y-1 text-xs">
      <p><span className="text-[#60727E]">{t('audit.deviceIp')}: </span><span className="font-mono">{isDeviceEvent ? deviceIp || t('audit.notRecorded') : t('audit.notApplicable')}</span></p>
      {loopback && <p className="font-mono text-[#60727E]" title={t('audit.internalTransport')}>{t('audit.transport')}: {log.ipAddress}</p>}
      {!loopback && log.module !== 'Biometric' && log.ipAddress && <p className="font-mono text-[#60727E]">{t('audit.userIp')}: {log.ipAddress}</p>}
    </div>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#203441] tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-[#00695F]" />
            <span>{t('audit.title')}</span>
          </h1>
          <p className="text-xs text-[#60727E] mt-1">
            {t('audit.ui_trazabilidad_de_modificaciones_de_horarios_recalculos')}
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#60727E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('audit.moduleFilter')}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="pl-8 bg-white border border-[#DFE7EB] rounded-lg px-3 py-1.5 text-xs text-[#203441] placeholder-slate-400 focus:outline-none focus:border-[#00695F] shadow-2xs"
            />
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#60727E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={t('audit.actionFilter')}
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="pl-8 bg-white border border-[#DFE7EB] rounded-lg px-3 py-1.5 text-xs text-[#203441] placeholder-slate-400 focus:outline-none focus:border-[#00695F] shadow-2xs"
            />
          </div>
          <button
            onClick={fetchLogs}
            className="p-2 rounded-lg bg-white border border-[#DFE7EB] text-[#203441] hover:bg-slate-50 shadow-2xs transition"
            title={t('audit.refresh')}
          >
            <RefreshCw className={`w-4 h-4 text-[#00695F] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Desktop Audit Logs Table */}
      <div className="hidden md:block bg-white border border-[#DFE7EB] rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F7F8] uppercase text-[#60727E] font-semibold border-b border-[#DFE7EB]">
              <tr>
                <th className="px-4 py-3">{t('common.time')}</th>
                <th className="px-4 py-3">{t('audit.ui_usuario')}</th>
                <th className="px-4 py-3">{t('audit.module')}</th>
                <th className="px-4 py-3">{t('audit.action')}</th>
                <th className="px-4 py-3">{t('audit.ui_entidad')}</th>
                <th className="px-4 py-3">{t('audit.ui_origen_ip')}</th>
                <th className="px-4 py-3 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DFE7EB]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#60727E]">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center">
                    <p className="font-semibold text-rose-700">{loadError}</p>
                    <button type="button" onClick={fetchLogs} className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white hover:bg-rose-700">
                      {t('common.retry')}
                    </button>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#60727E]">
                    {t('audit.ui_no_hay_registros_de_auditoria')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-mono text-[#60727E] whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-4 py-3 font-semibold text-[#203441]">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-[#00695F]" />
                        <span>{log.username}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E6F2F0] text-[#00695F] border border-[#00695F]/20 font-mono">
                        {log.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-[#00695F]">{log.action}</td>
                    <td className="px-4 py-3 font-mono text-[#60727E]">
                      {log.entity} {log.recordId ? `[#${log.recordId}]` : ''}
                    </td>
                    <td className="px-4 py-3">{renderOriginBadge(log)}</td>
                    <td className="px-4 py-3 text-right">
                      {log.oldValues || log.newValues ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#E6F2F0] text-[#00695F] text-xs font-semibold transition border border-[#00695F]/30 shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{t('audit.ui_ver_detalle')}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List (iPhone Responsive) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={fetchLogs} />
        ) : logs.length === 0 ? (
          <div className="bg-white border border-[#DFE7EB] rounded-xl p-6 text-center text-[#60727E] text-xs">
            {t('audit.ui_no_hay_registros_de_auditoria')}
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-white border border-[#DFE7EB] rounded-xl p-4 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-[#60727E]">{log.timestamp}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#E6F2F0] text-[#00695F] border border-[#00695F]/20 font-mono">
                  {log.module}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-sm text-[#203441]">
                  <Shield className="w-3.5 h-3.5 text-[#00695F]" />
                  <span>{log.username}</span>
                </div>
                <span className="font-mono font-bold text-xs text-[#00695F]">{log.action}</span>
              </div>
              <div className="text-xs text-[#60727E] font-mono">
                {log.entity} {log.recordId ? `[#${log.recordId}]` : ''}
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#DFE7EB]/60">
                <div>{renderOriginBadge(log)}</div>
                {log.oldValues || log.newValues ? (
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#E6F2F0] text-[#00695F] text-xs font-semibold"
                  >
                    <Eye className="w-3 h-3" />
                    <span>{t('audit.ui_detalle')}</span>
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Diff & Traceability Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-[#DFE7EB] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 bg-[#F4F7F8] border-b border-[#DFE7EB] flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[#203441] text-sm">
                  {t('audit.ui_trazabilidad_y_detalle_de_auditoria')}
                </h3>
                <span className="text-xs text-[#00695F] font-mono font-medium">
                  {selectedLog.module} · {selectedLog.action} · {selectedLog.timestamp}
                </span>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 rounded-md text-[#60727E] hover:text-[#203441] hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Origin Snapshot Context */}
              <div className="bg-[#F4F7F8] border border-[#DFE7EB] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[#60727E] block text-[11px]">{t('audit.ui_origen_ip_2')}</span>
                  <div className="mt-0.5">{renderOriginBadge(selectedLog)}</div>
                </div>
                <div>
                  <span className="text-[#60727E] block text-[11px]">{t('audit.ui_entidad_objetivo')}</span>
                  <span className="font-mono font-bold text-[#203441]">{selectedLog.entity} {selectedLog.recordId ? `[#${selectedLog.recordId}]` : ''}</span>
                </div>
                <div>
                  <span className="text-[#60727E] block text-[11px]">{t('audit.ui_operador')}</span>
                  <span className="font-semibold text-[#203441]">{selectedLog.username}</span>
                </div>
              </div>

              <AuditChanges before={selectedLog.oldValues} after={selectedLog.newValues} />
            </div>

            <div className="p-4 bg-[#F4F7F8] border-t border-[#DFE7EB] flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-white border border-[#DFE7EB] hover:bg-slate-100 text-xs font-semibold text-[#203441] shadow-2xs"
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
