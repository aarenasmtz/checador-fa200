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
  Power
} from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

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
}

export const DevicesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [devices, setDevices] = useState<Device[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Delete modal state
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [devRes, branchRes] = await Promise.all([
        api.get('/v1/devices'),
        api.get('/v1/branches')
      ]);
      setDevices(devRes.data || []);
      setBranches(branchRes.data || []);
    } catch (err: any) {
      console.error('Failed to load devices/branches:', err);
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
      setFormError(language === 'zh-CN' ? '请选择所属分店' : 'Debe seleccionar una sucursal.');
      return;
    }
    if (!formData.code.trim()) {
      setFormError(language === 'zh-CN' ? '请输入设备编号' : 'El código del dispositivo es obligatorio.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingDevice) {
        await api.put(`/v1/devices/${editingDevice.id}`, formData);
        showNotification(language === 'zh-CN' ? '设备更新成功' : 'Dispositivo reloj checador actualizado exitosamente.');
      } else {
        await api.post('/v1/devices', formData);
        showNotification(language === 'zh-CN' ? '新考勤机登记成功' : 'Nuevo reloj checador registrado exitosamente.');
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
      showNotification(language === 'zh-CN' ? '设备已删除' : 'Reloj checador eliminado exitosamente.');
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
    if (!isoDate) return language === 'zh-CN' ? '从未' : 'Nunca';
    const date = new Date(isoDate);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return language === 'zh-CN' ? '刚刚' : 'Hace un momento';
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
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? '通过各分店 GL.iNet GL-MT300N-V2 (Mango) 路由器 WireGuard VPN 隧道集中管理 FA200 考勤机，无需各店留守电脑。'
              : 'Gestión centralizada de checadores biométricos FA200 mediante túnel VPN WireGuard con router GL.iNet Mango, eliminando la necesidad de PC encendida en sucursal.'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-700 ${loading ? 'animate-spin' : ''}`} />
            <span>{language === 'zh-CN' ? '刷新' : 'Actualizar'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '登记新考勤机' : 'Registrar Checador VPN'}</span>
          </button>
        </div>
      </div>

      {/* Architecture Alert / Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-xl p-4 text-xs text-slate-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>{language === 'zh-CN' ? 'GL.iNet Mango 专用 VPN 架构' : 'Arquitectura VPN GL.iNet Mango Activa'}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white border border-emerald-300 text-emerald-800">
                <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
                WireGuard 10.10.0.0/24
              </span>
            </div>
            <p className="text-slate-600 mt-0.5">
              {language === 'zh-CN'
                ? '服务器集中通过 10.10.x.10 端口 4370 TCP 读取各店打卡，双向数据自动去重且绝不删减考勤机记录。'
                : 'El servidor central sondea directamente cada FA200 en su IP privada 10.10.x.10:4370. Las marcas se preservan intactas en el reloj con deduplicación SHA-256.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] font-medium text-slate-600 self-end md:self-auto shrink-0 bg-white/70 px-3 py-1.5 rounded-lg border border-emerald-100">
          <div>
            <span className="text-slate-400">Total Equipos: </span>
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
        <div className="text-center py-12 text-slate-400 animate-pulse text-xs">
          {t('common.loading')}
        </div>
      ) : devices.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mx-auto">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {language === 'zh-CN' ? '暂未登记考勤机' : 'No hay relojes checadores registrados'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {language === 'zh-CN'
                ? '点击上方“登记新考勤机”按钮，添加你的第一个 FA200 生物识别设备并通过 Mango VPN 连接。'
                : 'Haga clic en "+ Registrar Checador VPN" para dar de alta su equipo biométrico FA200 y asociarlo a la red del router Mango.'}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '立即登记设备' : 'Registrar Checador Ahora'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {devices.map((d) => {
            const isSyncing = d.isSyncInProgress || d.status === 'Syncing' || syncingId === d.id;
            const isOffline = d.status === 'Offline' || d.status === 'Error';
            const outdated = isDataOutdated(d);

            return (
              <div
                key={d.id}
                className="bg-white border border-slate-200 rounded-xl p-5 hover:border-emerald-300 hover:shadow-md transition shadow-xs space-y-4"
              >
                {/* Header Card */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">{d.name}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                        {d.code}
                      </span>
                      {d.isEnabled === false && (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-500 font-medium">
                          Deshabilitado / 已停用
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="font-medium text-slate-700">{d.branchName || 'Sucursal no asignada'}</span>
                      <span className="text-slate-300">•</span>
                      <span className="text-slate-500 font-mono">{d.timeZoneId || 'America/Mexico_City'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    {isSyncing ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                        <RefreshCw className="w-3 h-3 text-sky-600 animate-spin" />
                        <span>{language === 'zh-CN' ? '正在同步...' : 'Sincronizando...'}</span>
                      </span>
                    ) : isOffline ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                        <AlertCircle className="w-3 h-3 text-rose-600" />
                        <span>{language === 'zh-CN' ? '通信异常' : 'Error de comunicación'}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <Activity className="w-3 h-3 text-emerald-600 animate-pulse" />
                        <span>
                          {d.lastSyncRecordsCount && d.lastSyncRecordsCount > 0
                            ? (language === 'zh-CN' ? `正常 (+${d.lastSyncRecordsCount}条)` : `Accesible (+${d.lastSyncRecordsCount} checadas)`)
                            : (language === 'zh-CN' ? '正常无新记录' : 'Accesible sin registros nuevos')}
                        </span>
                      </span>
                    )}

                    <button
                      onClick={() => handleOpenEditModal(d)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setDeletingDevice(d)}
                      title="Eliminar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Specs & Network Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50 p-3.5 rounded-lg border border-slate-200 font-mono">
                  <div>
                    <span className="text-slate-500 font-sans block text-[10px]">IP FA200 (VPN LAN):</span>
                    <span className="text-emerald-700 font-bold">{d.ipAddress || '10.10.1.10'}:{d.port || 4370}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-sans block text-[10px]">Subred Mango:</span>
                    <span className="text-slate-800 font-semibold">{d.vpnSubnet || '10.10.1.0/24'}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-sans block text-[10px]">Túnel WireGuard:</span>
                    <span className="text-slate-800 font-semibold">{d.vpnClientIp || '10.10.0.2'}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-sans block text-[10px]">Checadas Hoy:</span>
                    <span className="text-emerald-800 font-bold">{d.punchesToday || 0}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-sans block text-[10px]">Última Sincronización:</span>
                    <span className="text-slate-800 font-semibold">{formatTimeAgo(d.lastSuccessfulSyncAt || d.lastSyncAt)}</span>
                  </div>

                  <div>
                    <span className="text-slate-500 font-sans block text-[10px]">Intervalo de Sondeo:</span>
                    <span className="text-slate-700">{d.syncIntervalSeconds || 30}s</span>
                  </div>
                </div>

                {/* Data Freshness Indicator */}
                <div className="flex items-center justify-between text-[11px] px-1 text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {language === 'zh-CN' ? '数据新鲜度: ' : 'Antigüedad de los datos: '}
                      <strong className={outdated ? 'text-amber-700' : 'text-slate-800'}>
                        {formatTimeAgo(d.lastEventAt || d.lastSuccessfulSyncAt)}
                      </strong>
                    </span>
                    {outdated && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-50 text-amber-800 border border-amber-200">
                        {language === 'zh-CN' ? '待更新' : 'Pendiente'}
                      </span>
                    )}
                  </div>

                  <div>
                    <span>{language === 'zh-CN' ? '最新入库: ' : 'Última captura: '}</span>
                    <strong className="text-emerald-700">
                      +{d.lastSyncRecordsCount || 0} {language === 'zh-CN' ? '条' : 'reg'}
                    </strong>
                  </div>
                </div>

                {/* Error Banner */}
                {d.lastErrorMessage && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <span className="break-all">{d.lastErrorMessage}</span>
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Network className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Modo: </span>
                    <span className="font-semibold text-slate-800">
                      {d.connectionMode === 'VpnTunnel' ? 'VPN Mango' : d.connectionMode}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestConnection(d.id, d.name)}
                      disabled={testingId === d.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition border border-slate-200 shadow-2xs disabled:opacity-50"
                    >
                      <Wifi className={`w-3.5 h-3.5 text-emerald-700 ${testingId === d.id ? 'animate-pulse' : ''}`} />
                      <span>{testingId === d.id ? 'Probando...' : t('devices.testConnection')}</span>
                    </button>

                    <button
                      onClick={() => handleSync(d.id, d.name)}
                      disabled={syncingId === d.id || isSyncing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold text-white transition shadow-xs disabled:opacity-50"
                    >
                      <ArrowRightLeft className={`w-3.5 h-3.5 ${syncingId === d.id ? 'animate-spin' : ''}`} />
                      <span>{syncingId === d.id ? 'Sincronizando...' : (language === 'zh-CN' ? '立即同步' : 'Sincronizar Ahora')}</span>
                    </button>
                  </div>
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
                    ? (language === 'zh-CN' ? '编辑考勤机 VPN 配置' : 'Editar Reloj Checador VPN')
                    : (language === 'zh-CN' ? '登记新考勤机 (Mango VPN)' : 'Registrar Nuevo Checador VPN (Mango)')}
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
                  {language === 'zh-CN' ? '所属分店 *' : 'Sucursal a la que Pertenece *'}
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
                    {language === 'zh-CN' ? '-- 请选择所属分店 --' : '-- Seleccionar Sucursal --'}
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
                    {language === 'zh-CN' ? '设备编号 (Code) *' : 'Código de Dispositivo *'}
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
                    {language === 'zh-CN' ? '设备型号' : 'Modelo'}
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
                  {language === 'zh-CN' ? '设备名称 / 描述 *' : 'Nombre / Ubicación *'}
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Reloj Checador Entrada Principal"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Networking Section */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-[11px]">
                  <Network className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{language === 'zh-CN' ? '网络与 VPN WireGuard 参数' : 'Parámetros de Red y VPN WireGuard'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      {language === 'zh-CN' ? 'FA200 私有 IP (LAN)' : 'IP Privada FA200 (LAN)'}
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
                      {language === 'zh-CN' ? '通信端口 (TCP)' : 'Puerto TCP'}
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
                      {language === 'zh-CN' ? 'Mango 局域网网段' : 'Subred LAN Mango'}
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
                      {language === 'zh-CN' ? 'WireGuard 隧道 IP' : 'IP Túnel WireGuard'}
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
                    {language === 'zh-CN' ? '时区' : 'Zona Horaria'}
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
                    {language === 'zh-CN' ? '同步间隔 (秒)' : 'Intervalo de Sondeo (segundos)'}
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
                  {language === 'zh-CN' ? '启用自动同步' : 'Habilitar sondeo y sincronización automática'}
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
                  {language === 'zh-CN' ? '确认删除此考勤机？' : '¿Eliminar Reloj Checador?'}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === 'zh-CN'
                    ? `此操作将移除设备 [${deletingDevice.code}] ${deletingDevice.name}`
                    : `Se eliminará el equipo [${deletingDevice.code}] ${deletingDevice.name}.`}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
              {language === 'zh-CN'
                ? '确认后该考勤机将不再接收同步。'
                : 'Esta acción desvinculará este reloj biométrico del sistema.'}
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
