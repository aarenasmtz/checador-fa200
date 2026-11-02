import React, { useState, useEffect } from 'react';
import { History, RefreshCw, Eye, X, Shield, Cpu, Globe, Search } from 'lucide-react';
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
    const isDeviceEvent =
      log.module === 'Biometric' ||
      log.entity === 'BiometricDevice' ||
      log.action?.toLowerCase().includes('sync') ||
      log.action?.toLowerCase().includes('punch');

    if (isDeviceEvent) {
      if (log.ipAddress && log.ipAddress !== '127.0.0.1' && log.ipAddress !== '::1' && log.ipAddress !== 'No registrada') {
        return (
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-[#E6F2F0] text-[#00695F] border border-[#00695F]/30 font-mono text-[11px] font-semibold">
            <Cpu className="w-3 h-3 text-[#00695F]" />
            <span>{log.ipAddress}</span>
            <span className="text-[10px] text-[#00695F]/80 uppercase tracking-wider font-sans font-normal">(FA200)</span>
          </div>
        );
      }
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-500 font-mono">
          {language === 'zh-CN' ? '未记录' : 'No registrada'}
        </span>
      );
    }

    // Manual/Admin or system operations
    if (log.ipAddress && log.ipAddress !== '127.0.0.1' && log.ipAddress !== '::1' && log.ipAddress !== 'No registrada') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[#203441] border border-[#DFE7EB] font-mono text-[11px]">
          <Globe className="w-3 h-3 text-[#60727E]" />
          <span>{log.ipAddress}</span>
          <span className="text-[10px] text-[#60727E] uppercase font-sans">(Web)</span>
        </div>
      );
    }

    if (log.ipAddress === '127.0.0.1' || log.ipAddress === '::1') {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-600 font-mono" title="Transporte interno o Proxy local de VPS">
          127.0.0.1 (Local)
        </span>
      );
    }

    // Operations without device association
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] bg-slate-100 text-slate-400 font-sans">
        {language === 'zh-CN' ? '不适用' : 'No aplica'}
      </span>
    );
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
            {language === 'zh-CN'
              ? '全方位记录系统操作员行为、FA200 考勤打卡来源、排班修改及权限变更轨迹'
              : 'Trazabilidad de modificaciones de horarios, recálculos y eventos de reloj biométrico'}
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#60727E] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={language === 'zh-CN' ? '按模块筛选 (Attendance, Biometric)...' : 'Filtrar módulo...'}
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="pl-8 bg-white border border-[#DFE7EB] rounded-lg px-3 py-1.5 text-xs text-[#203441] placeholder-slate-400 focus:outline-none focus:border-[#00695F] shadow-2xs"
            />
          </div>
          <button
            onClick={fetchLogs}
            className="p-2 rounded-lg bg-white border border-[#DFE7EB] text-[#203441] hover:bg-slate-50 shadow-2xs transition"
            title={language === 'zh-CN' ? '刷新审计日志' : 'Actualizar registros'}
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
                <th className="px-4 py-3">{language === 'zh-CN' ? '操作账号' : 'Usuario'}</th>
                <th className="px-4 py-3">{t('audit.module')}</th>
                <th className="px-4 py-3">{t('audit.action')}</th>
                <th className="px-4 py-3">{language === 'zh-CN' ? '变更实体' : 'Entidad'}</th>
                <th className="px-4 py-3">{language === 'zh-CN' ? '来源 / IP' : 'Origen / IP'}</th>
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
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#60727E]">
                    {language === 'zh-CN' ? '暂无审计日志记录' : 'No hay registros de auditoría'}
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
                          <span>{language === 'zh-CN' ? '查看明细' : 'Ver Detalle'}</span>
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
          <div className="bg-white border border-[#DFE7EB] rounded-xl p-6 text-center text-[#60727E] text-xs">
            {t('common.loading')}
          </div>
        ) : logs.length === 0 ? (
          <div className="bg-white border border-[#DFE7EB] rounded-xl p-6 text-center text-[#60727E] text-xs">
            {language === 'zh-CN' ? '暂无审计日志记录' : 'No hay registros de auditoría'}
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
                    <span>{language === 'zh-CN' ? '明细' : 'Detalle'}</span>
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
                  {language === 'zh-CN' ? '审计溯源明细 (Before & After)' : 'Trazabilidad y Detalle de Auditoría'}
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
                  <span className="text-[#60727E] block text-[11px]">{language === 'zh-CN' ? '来源设备 / IP' : 'Origen / IP:'}</span>
                  <div className="mt-0.5">{renderOriginBadge(selectedLog)}</div>
                </div>
                <div>
                  <span className="text-[#60727E] block text-[11px]">{language === 'zh-CN' ? '变更实体' : 'Entidad objetivo:'}</span>
                  <span className="font-mono font-bold text-[#203441]">{selectedLog.entity} {selectedLog.recordId ? `[#${selectedLog.recordId}]` : ''}</span>
                </div>
                <div>
                  <span className="text-[#60727E] block text-[11px]">{language === 'zh-CN' ? '操作人' : 'Operador:'}</span>
                  <span className="font-semibold text-[#203441]">{selectedLog.username}</span>
                </div>
              </div>

              {/* Before / After Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs font-bold text-rose-700 block mb-2">
                    {t('audit.oldValue')} (Before)
                  </span>
                  <pre className="bg-rose-50/70 border border-rose-200 p-3 rounded-lg text-xs font-mono text-rose-900 overflow-x-auto max-h-72 whitespace-pre-wrap">
                    {formatJson(selectedLog.oldValues) || (language === 'zh-CN' ? '(无变更前数据)' : '(Sin valores previos)')}
                  </pre>
                </div>

                <div>
                  <span className="text-xs font-bold text-[#00695F] block mb-2">
                    {t('audit.newValue')} (After)
                  </span>
                  <pre className="bg-[#E6F2F0]/70 border border-[#00695F]/30 p-3 rounded-lg text-xs font-mono text-[#00695F] overflow-x-auto max-h-72 whitespace-pre-wrap">
                    {formatJson(selectedLog.newValues) || (language === 'zh-CN' ? '(无变更后数据)' : '(Sin valores nuevos)')}
                  </pre>
                </div>
              </div>
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
