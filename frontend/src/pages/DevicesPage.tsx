import React, { useState, useEffect } from 'react';
import {
  Cpu,
  RefreshCw,
  Wifi,
  CheckCircle2,
  Activity,
  ArrowRightLeft,
  Plus,
  Trash2,
  Edit2,
  Building2,
  X,
  AlertCircle,
  Clock,
  ShieldCheck,
  Network,
  Radio,
  Power,
  ChevronDown,
  ChevronUp,
  Terminal
} from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import { ErrorState, LoadingState } from '../components/AsyncState';

interface Branch {
  id: number;
  name: string;
  code: string;
}

interface Device {
  id: number;
  branchId: number;
  branchName: string;
  code: string;
  name: string;
  ipAddress: string;
  port: number;
  model: string;
  serialNumber?: string;
  status: string;
  provider: string;
  connectionMode: string;
  isEnabled: boolean;
  timeZoneId: string;
  syncIntervalSeconds: number;
  lastConnectionAt?: string;
  lastEventAt?: string;
  lastSyncAt?: string;
  lastSyncAttemptAt?: string;
  lastSuccessfulSyncAt?: string;
  lastSyncRecordsCount?: number;
  isSyncInProgress?: boolean;
  pendingQueueCount?: number;
  lastErrorMessage?: string;
  firmwareVersion?: string;
  vpnSubnet?: string;
  vpnClientIp?: string;
  punchesToday?: number;
  latencyMs?: number;
}

export const DevicesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [devices, setDevices] = useState<Device[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [formData, setFormData] = useState({
    branchId: 0,
    code: '',
    name: '',
    model: 'FA200',
    connectionMode: 'VpnTunnel',
    ipAddress: '10.10.1.10',
    port: 4370,
    isEnabled: true,
    timeZoneId: 'America/Mexico_City',
    syncIntervalSeconds: 30,
    vpnSubnet: '10.10.1.0/24',
    vpnClientIp: '10.10.0.2'
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Testing & Sync states
  const [testingId, setTestingId] = useState<number | null>(null);
  const [latencies, setLatencies] = useState<Record<number, number | null>>({});
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Diagnostics collapsible state
  const [expandedDiagnostics, setExpandedDiagnostics] = useState<number[]>([]);
  const toggleDiagnostics = (id: number) => {
    setExpandedDiagnostics((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Delete modal state
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [devRes, branchRes] = await Promise.all([
        api.get('/v1/devices'),
        api.get('/v1/branches')
      ]);
      setDevices(devRes.data || []);
      setBranches(branchRes.data || []);
    } catch (err: any) {
      console.error('Failed to load devices/branches:', err);
      setLoadError(err.response?.data?.message || t('common.loadErrorDescription'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showNotification = (text: string, type: 'success' | 'error' = 'success') => {
    setActionMessage({ text, type });
    setTimeout(() => setActionMessage(null), 6000);
  };

  const handleOpenAddModal = () => {
    setEditingDevice(null);
    const firstBranch = branches.length > 0 ? branches[0] : null;
    const branchCode = firstBranch ? firstBranch.code : '01';
    setFormData({
      branchId: firstBranch ? firstBranch.id : 0,
      code: `FA200-${branchCode}-01`,
      name: `Reloj Checador ${firstBranch ? firstBranch.name : 'Entrada'}`,
      model: 'FA200',
      connectionMode: 'VpnTunnel',
      ipAddress: '10.10.1.10',
      port: 4370,
      isEnabled: true,
      timeZoneId: 'America/Mexico_City',
      syncIntervalSeconds: 30,
      vpnSubnet: '10.10.1.0/24',
      vpnClientIp: '10.10.0.2'
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dev: Device) => {
    setEditingDevice(dev);
    setFormData({
      branchId: dev.branchId,
      code: dev.code,
      name: dev.name,
      model: dev.model || 'FA200',
      connectionMode: dev.connectionMode || 'VpnTunnel',
      ipAddress: dev.ipAddress || '',
      port: dev.port || 4370,
      isEnabled: dev.isEnabled !== false,
      timeZoneId: dev.timeZoneId || 'America/Mexico_City',
      syncIntervalSeconds: dev.syncIntervalSeconds || 30,
      vpnSubnet: dev.vpnSubnet || '',
      vpnClientIp: dev.vpnClientIp || ''
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.branchId) {
      setFormError(t('devices.ui_debe_seleccionar_una_sucursal'));
      return;
    }
    if (!formData.code.trim()) {
      setFormError(t('devices.ui_el_codigo_del_dispositivo_es_obligatorio'));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingDevice) {
        await api.put(`/v1/devices/${editingDevice.id}`, formData);
        showNotification(t('devices.ui_dispositivo_reloj_checador_actualizado_exitosamente'));
      } else {
        await api.post('/v1/devices', formData);
        showNotification(t('devices.ui_nuevo_reloj_checador_registrado_exitosamente'));
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Error al guardar el dispositivo.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = async () => {
    if (!deletingDevice) return;
    setDeleting(true);
    try {
      await api.delete(`/v1/devices/${deletingDevice.id}`);
      showNotification(t('devices.ui_reloj_checador_eliminado_exitosamente'));
      setDeletingDevice(null);
      fetchData();
    } catch (err: any) {
      showNotification(err.response?.data?.message || 'Error al eliminar dispositivo.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleTestConnection = async (id: number, name: string) => {
    try {
      setTestingId(id);
      const res = await api.post(`/v1/devices/${id}/test-connection`);
      setLatencies(current => ({ ...current, [id]: res.data.success && Number.isFinite(res.data.latencyMs) ? res.data.latencyMs : null }));
      if (res.data.success) {
        showNotification(`[${name}] ${res.data.message || 'Conexión verificada exitosamente'}`);
      } else {
        showNotification(`[${name}] ${res.data.message || 'Fallo de conexión'}`, 'error');
      }
      fetchData();
    } catch (err: any) {
      showNotification(`[${name}] Fallo al conectar: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setTestingId(null);
    }
  };

  const handleSync = async (id: number, name: string) => {
    try {
      setSyncingId(id);
      const res = await api.post(`/v1/devices/${id}/sync`);
      if (res.data.success) {
        showNotification(`[${name}] ${res.data.message || 'Sincronización procesada'}`);
      } else {
        showNotification(`[${name}] ${res.data.message || 'Error en sincronización'}`, 'error');
      }
      fetchData();
    } catch (err: any) {
      showNotification(`[${name}] Error en sincronización: ${err.response?.data?.message || err.message}`, 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const formatTimeAgo = (isoDate?: string): string => {
    if (!isoDate) return t('devices.ui_nunca');
    const date = new Date(isoDate);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return t('devices.ui_hace_un_momento');
    if (diffSec < 3600) {
      const min = Math.floor(diffSec / 60);
      return language === 'zh-CN' ? `${min}分钟前` : `Hace ${min} min`;
    }
    if (diffSec < 86400) {
      const h = Math.floor(diffSec / 3600);
      return language === 'zh-CN' ? `${h}小时前` : `Hace ${h} h`;
    }
    const days = Math.floor(diffSec / 86400);
    return language === 'zh-CN' ? `${days}天前` : `Hace ${days} d`;
  };

  const isDataOutdated = (dev: Device): boolean => {
    if (!dev.lastSuccessfulSyncAt) return true;
    const diffHours = (new Date().getTime() - new Date(dev.lastSuccessfulSyncAt).getTime()) / (1000 * 3600);
    return diffHours > 2;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-6 h-6 text-emerald-700" />
            <span>{t('devices.title')}</span>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              VPN Mango WireGuard
            </span>
          </h1>
          <p className="wpc-secondary-copy text-xs text-slate-500 mt-1">
            {t('devices.ui_gestion_centralizada_de_checadores_biometricos_fa200')}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('devices.ui_actualizar')}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('devices.ui_registrar_checador_vpn')}</span>
          </button>
        </div>
      </div>

      {/* Architecture Alert / Banner */}
      <div className="wpc-technical-banner bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-xl p-4 text-xs text-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>{t('devices.ui_arquitectura_vpn_gl_inet_mango_activa')}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-emerald-300 text-emerald-800">
                <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                WireGuard 10.10.0.0/24
              </span>
            </div>
            <p className="text-slate-600 mt-0.5">
              {t('devices.ui_el_servidor_central_sondea_directamente_cada')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600 self-end md:self-auto shrink-0 bg-white/70 px-3 py-1.5 rounded-lg border border-emerald-100">
          <div>
            <span className="text-slate-400">{t('devices.totalDevices')}: </span>
            <span className="font-bold text-slate-900">{devices.length}</span>
          </div>
          <span className="text-slate-300">|</span>
          <div>
            <span className="text-slate-400">En Línea: </span>
            <span className="font-bold text-emerald-700">
              {devices.filter((d) => d.status === 'Online').length}
            </span>
          </div>
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

      {/* Device List */}
      {loading ? (
        <LoadingState />
      ) : loadError ? (
        <ErrorState message={loadError} onRetry={fetchData} />
      ) : devices.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mx-auto">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {t('devices.ui_no_hay_relojes_checadores_registrados')}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {t('devices.ui_haga_clic_en_registrar_checador_vpn')}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{t('devices.ui_registrar_checador_ahora')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {devices.map((d) => {
            const isSyncing = d.isSyncInProgress || d.status === 'Syncing' || syncingId === d.id;
            const isOffline = d.status === 'Offline' || d.status === 'Error';
            const isDiagOpen = expandedDiagnostics.includes(d.id);

            return (
              <div
                key={d.id}
                className="bg-white border border-[#DFE7EB] rounded-2xl p-5 hover:border-[#00695F]/40 hover:shadow-md transition shadow-xs flex flex-col justify-between space-y-4"
              >
                {/* Header Card: Name, Branch, Status and Actions */}
                <div className="space-y-3">
                  <div className="wpc-device-header flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[#203441] text-base">{d.name}</h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#E6F2F0] text-[#00695F] border border-[#00695F]/20 font-bold">
                          {d.code}
                        </span>
                        {d.isEnabled === false && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-medium">
                            Deshabilitado
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-[#60727E]">
                        <Building2 className="w-3.5 h-3.5 text-[#00695F]" />
                        <span className="font-medium text-[#203441]">{d.branchName || 'Sucursal no asignada'}</span>
                        <span className="text-slate-300">•</span>
                        <span className="font-mono text-[11px]">{d.timeZoneId || 'America/Mexico_City'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Status Badge */}
                      {isSyncing ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                          <RefreshCw className="w-3 h-3 text-sky-600 animate-spin" />
                          <span>{t('devices.ui_sincronizando')}</span>
                        </span>
                      ) : isOffline ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle className="w-3 h-3 text-rose-600" />
                          <span>{t('devices.ui_fuera_de_linea')}</span>
                        </span>
                      ) : d.status === 'Online' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
                          <span>{t('devices.ui_accesible')}</span>
                        </span>
                      ) : (
                        <span className="wpc-status">{t('settings.unknown')}</span>
                      )}

                      <button
                        onClick={() => handleOpenEditModal(d)}
                        title={t('devices.editDevice')}
                        className="p-1.5 rounded-lg text-[#60727E] hover:text-[#00695F] hover:bg-[#E6F2F0] transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setDeletingDevice(d)}
                        title={t('devices.deleteDevice')}
                        className="p-1.5 rounded-lg text-[#60727E] hover:text-rose-600 hover:bg-rose-50 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Primary Metrics: Last Sync, Latency, Punches Today */}
                  <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-[#DFE7EB] rounded-xl text-xs">
                    <div>
                      <span className="text-[10px] text-[#60727E] block">{t(d.lastSuccessfulSyncAt || d.lastSyncAt ? 'devices.lastSync' : 'devices.lastAttempt')}</span>
                      <strong className="text-[#203441] font-semibold text-xs block truncate mt-0.5">
                        {formatTimeAgo(d.lastSuccessfulSyncAt || d.lastSyncAt || d.lastSyncAttemptAt)}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#60727E] block">{t('devices.responseTime')}</span>
                      <strong className="text-emerald-700 font-mono text-xs block mt-0.5">
                        {latencies[d.id] != null ? `${latencies[d.id]} ms` : d.latencyMs != null ? `${d.latencyMs} ms` : '—'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#60727E] block">{t('devices.punchesToday')}</span>
                      <strong className="text-[#00695F] font-bold text-xs block mt-0.5">
                        {d.punchesToday || 0} marcas
                      </strong>
                    </div>
                  </div>

                  {/* Real Action Buttons: Test Connection & Synchronize */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleTestConnection(d.id, d.name)}
                      disabled={testingId === d.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-slate-50 text-xs font-semibold text-[#203441] transition border border-[#DFE7EB] shadow-2xs disabled:opacity-50 min-h-[40px]"
                    >
                      <Wifi className={`w-4 h-4 text-[#00695F] ${testingId === d.id ? 'animate-pulse' : ''}`} />
                      <span>{testingId === d.id ? 'Probando...' : t('devices.testConnection')}</span>
                    </button>

                    <button
                      onClick={() => handleSync(d.id, d.name)}
                      disabled={syncingId === d.id || isSyncing}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#00695F] hover:bg-[#005149] text-xs font-semibold text-white transition shadow-xs disabled:opacity-50 min-h-[40px]"
                    >
                      <ArrowRightLeft className={`w-4 h-4 ${syncingId === d.id ? 'animate-spin' : ''}`} />
                      <span>{syncingId === d.id ? 'Sincronizando...' : (t('devices.ui_sincronizar_ahora'))}</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Section: Datos Técnicos y Diagnóstico */}
                <div className="pt-2 border-t border-[#DFE7EB]/60">
                  <button
                    type="button"
                    onClick={() => toggleDiagnostics(d.id)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-[#60727E] hover:text-[#203441] py-1 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-[#00695F]" />
                      <span>{t('devices.technicalDiagnostics')}</span>
                    </span>
                    {isDiagOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isDiagOpen && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-50 border border-[#DFE7EB] space-y-2 text-xs font-mono">
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <span className="text-[#60727E] block text-[10px] font-sans">{t('devices.ip')} / {t('devices.port')}:</span>
                          <span className="font-bold text-[#00695F]">{d.ipAddress || '—'}:{d.port ?? '—'}</span>
                        </div>
                        <div>
                          <span className="text-[#60727E] block text-[10px] font-sans">{t('devices.serial')}:</span>
                          <span className="text-[#203441]">{d.serialNumber || t('common.notAvailable')}</span>
                        </div>
                        <div>
                          <span className="text-[#60727E] block text-[10px] font-sans">{t('devices.firmware')}:</span>
                          <span className="text-[#203441]">{d.firmwareVersion || t('common.notAvailable')}</span>
                        </div>
                        <div>
                          <span className="text-[#60727E] block text-[10px] font-sans">{t('devices.protocol')}:</span>
                          <span className="text-[#203441]">{d.connectionMode || t('common.notAvailable')}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#DFE7EB]/60 text-[11px]">
                        <span className="text-[#60727E] block text-[10px] font-sans">{t('devices.vpnMango')}:</span>
                        <span className="text-[#203441]">
                          {t('devices.subnet')}: {d.vpnSubnet || '—'} · {t('devices.tunnelIp')}: {d.vpnClientIp || '—'}
                        </span>
                      </div>

                      {d.lastErrorMessage && (
                        <div className="pt-2 border-t border-[#DFE7EB]/60 text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200">
                          <strong className="font-sans block text-[10px] text-rose-800">{t('devices.errorDiagnosis')}:</strong>
                          <span className="break-all">{d.lastErrorMessage}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Cpu className="w-5 h-5 text-emerald-700" />
                <span>
                  {editingDevice
                    ? (t('devices.ui_editar_reloj_checador_vpn'))
                    : (t('devices.ui_registrar_nuevo_checador_vpn_mango'))}
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

            <form onSubmit={handleSaveDevice} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {t('devices.ui_sucursal_a_la_que_pertenece')}
                </label>
                <select
                  value={formData.branchId}
                  onChange={(e) => {
                    const bId = Number(e.target.value);
                    const b = branches.find((br) => br.id === bId);
                    const branchIdx = branches.findIndex((br) => br.id === bId) + 1;
                    setFormData((prev) => ({
                      ...prev,
                      branchId: bId,
                      code: prev.code.includes('FA200-') && b ? `FA200-${b.code}-01` : prev.code,
                      ipAddress: `10.10.${branchIdx}.10`,
                      vpnSubnet: `10.10.${branchIdx}.0/24`,
                      vpnClientIp: `10.10.0.${branchIdx + 1}`
                    }));
                  }}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value={0} disabled>
                    {t('devices.ui_seleccionar_sucursal')}
                  </option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {t('devices.ui_codigo_de_dispositivo')}
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="FA200-CENTRO-01"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono uppercase focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {t('devices.ui_modelo')}
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="FA200"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {t('devices.ui_nombre_ubicacion')}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('devices.namePlaceholder')}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Networking Section */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <Network className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{t('devices.ui_parametros_de_red_y_vpn_wireguard')}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      {t('devices.ui_ip_privada_fa200_lan')}
                    </label>
                    <input
                      type="text"
                      value={formData.ipAddress}
                      onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                      placeholder="10.10.1.10"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">
                      {t('devices.ui_puerto_tcp')}
                    </label>
                    <input
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                      placeholder="4370"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      {t('devices.ui_subred_lan_mango')}
                    </label>
                    <input
                      type="text"
                      value={formData.vpnSubnet}
                      onChange={(e) => setFormData({ ...formData, vpnSubnet: e.target.value })}
                      placeholder="10.10.1.0/24"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 mb-1">
                      {t('devices.ui_ip_tunel_wireguard')}
                    </label>
                    <input
                      type="text"
                      value={formData.vpnClientIp}
                      onChange={(e) => setFormData({ ...formData, vpnClientIp: e.target.value })}
                      placeholder="10.10.0.2"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sync settings */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {t('devices.ui_zona_horaria')}
                  </label>
                  <input
                    type="text"
                    value={formData.timeZoneId}
                    onChange={(e) => setFormData({ ...formData, timeZoneId: e.target.value })}
                    placeholder="America/Mexico_City"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {t('devices.ui_intervalo_de_sondeo_segundos')}
                  </label>
                  <input
                    type="number"
                    value={formData.syncIntervalSeconds}
                    onChange={(e) => setFormData({ ...formData, syncIntervalSeconds: Number(e.target.value) })}
                    placeholder="30"
                    min={5}
                    max={3600}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Enabled toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={formData.isEnabled}
                  onChange={(e) => setFormData({ ...formData, isEnabled: e.target.checked })}
                  className="rounded text-emerald-700 focus:ring-emerald-500 w-4 h-4"
                />
                <label htmlFor="isEnabled" className="text-slate-700 font-semibold cursor-pointer">
                  {t('devices.ui_habilitar_sondeo_y_sincronizacion_automatica')}
                </label>
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
                  className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold shadow-xs disabled:opacity-50"
                >
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 relative border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {t('devices.ui_eliminar_reloj_checador')}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'zh-CN'
                    ? `此操作将移除设备 [${deletingDevice.code}] ${deletingDevice.name}`
                    : `Se eliminará el equipo [${deletingDevice.code}] ${deletingDevice.name}.`}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {t('devices.ui_esta_accion_desvinculara_este_reloj_biometrico')}
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDevice(null)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteDevice}
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
