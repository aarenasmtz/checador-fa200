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
  AlertCircle
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
  lastConnectionAt?: string;
  lastEventAt?: string;
  lastSyncAt?: string;
  pendingQueueCount?: number;
  lastErrorMessage?: string;
  firmwareVersion?: string;
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
    ipAddress: '192.168.100.21',
    port: 4370
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleOpenAddModal = () => {
    setEditingDevice(null);
    setFormData({
      branchId: branches.length > 0 ? branches[0].id : 0,
      code: `FA200-${branches.length > 0 ? branches[0].code : '01'}-01`,
      name: 'Reloj Checador Entrada Principal',
      model: 'FA200',
      ipAddress: '192.168.100.21',
      port: 4370
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
      ipAddress: dev.ipAddress || '',
      port: dev.port || 4370
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
      const res = await api.post(`/v1/devices/${id}/test-connection`);
      showNotification(`[${name}] ${res.data.message || 'Conexión verificada exitosamente'}`);
    } catch (err: any) {
      showNotification(`[${name}] Fallo al conectar: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  const handleSync = async (id: number, name: string) => {
    try {
      const res = await api.post(`/v1/devices/${id}/sync`);
      showNotification(`[${name}] Sincronización: ${res.data.message || 'Sincronización completada'}`);
      fetchData();
    } catch (err: any) {
      showNotification(`[${name}] Error en sincronización: ${err.response?.data?.message || err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Cpu className="w-6 h-6 text-indigo-600" />
            {t('devices.title')}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {language === 'zh-CN'
              ? '管理商场各分店的 FA200 面部与指纹识别考勤机设备及网络连接'
              : 'Registro y administración de checadores biométricos FA200 (Cara y Huella) por sucursal'}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
          >
            <RefreshCw className="w-4 h-4 text-indigo-600" />
            <span>{language === 'zh-CN' ? '刷新' : 'Actualizar'}</span>
          </button>

          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '登记新考勤机' : 'Registrar Checador'}</span>
          </button>
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
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
            <Cpu className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              {language === 'zh-CN' ? '暂未登记考勤机' : 'No hay relojes checadores registrados'}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {language === 'zh-CN'
                ? '点击上方“登记新考勤机”按钮，添加你的第一个 FA200 生物识别设备并绑定对应分店。'
                : 'Haga clic en "+ Registrar Checador" para dar de alta su equipo biométrico FA200 y vincularlo a su sucursal.'}
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'zh-CN' ? '立即登记设备' : 'Registrar Checador Ahora'}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {devices.map((d) => (
            <div
              key={d.id}
              className="bg-white border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition shadow-xs space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 text-base">{d.name}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-semibold">
                      {d.code}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="font-medium text-slate-700">{d.branchName || 'Sucursal no asignada'}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    d.status === 'Online'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : d.status === 'Offline'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    <Activity className={`w-3 h-3 ${d.status === 'Online' ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
                    <span>{d.status === 'Online' ? (language === 'zh-CN' ? '正常在网' : 'En Línea / Listo') : (language === 'zh-CN' ? '离线' : 'Desconectado')}</span>
                  </span>

                  <button
                    onClick={() => handleOpenEditModal(d)}
                    title="Editar"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
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

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-500 font-sans">{t('devices.ip')}:</span>{' '}
                  <span className="text-indigo-600 font-semibold">{d.ipAddress || '192.168.100.21'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">{t('devices.port')}:</span>{' '}
                  <span className="text-slate-800 font-semibold">{d.port || 4370}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">N° Serie:</span>{' '}
                  <span className="text-slate-800 font-semibold">{d.serialNumber || 'PHZ6092608717'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">{language === 'zh-CN' ? '今日打卡' : 'Checadas Hoy'}:</span>{' '}
                  <span className="text-emerald-700 font-bold">{d.punchesToday || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Cola Local:</span>{' '}
                  <span className={`font-semibold ${d.pendingQueueCount && d.pendingQueueCount > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                    {d.pendingQueueCount || 0} pendientes
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">Firmware:</span>{' '}
                  <span className="text-slate-700">{d.firmwareVersion || 'Ver 6.60'}</span>
                </div>
              </div>

              {/* Error Alert if any */}
              {d.lastErrorMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="truncate">{d.lastErrorMessage}</span>
                </div>
              )}

              {/* Status and Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  <span>Último contacto: </span>
                  <span className="text-slate-800 font-medium">
                    {d.lastConnectionAt ? new Date(d.lastConnectionAt).toLocaleTimeString() : 'Listo'}
                  </span>
                  {d.lastSyncAt && (
                    <span className="ml-2 text-indigo-600 font-medium">
                      (Sinc: {new Date(d.lastSyncAt).toLocaleTimeString()})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTestConnection(d.id, d.name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition border border-slate-200 shadow-2xs"
                  >
                    <Wifi className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{t('devices.testConnection')}</span>
                  </button>
                  <button
                    onClick={() => handleSync(d.id, d.name)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white transition shadow-xs"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>{t('devices.syncUsers')}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Device Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 relative border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                <span>
                  {editingDevice
                    ? (language === 'zh-CN' ? '编辑考勤机配置' : 'Editar Reloj Checador')
                    : (language === 'zh-CN' ? '登记并添加新考勤机' : 'Registrar Nuevo Reloj Checador')}
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
                    setFormData((prev) => ({
                      ...prev,
                      branchId: bId,
                      code: prev.code.includes('FA200-') && b ? `FA200-${b.code}-01` : prev.code
                    }));
                  }}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono uppercase focus:bg-white focus:border-indigo-500 focus:outline-none"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? 'IP 地址' : 'Dirección IP Local'}
                  </label>
                  <input
                    type="text"
                    value={formData.ipAddress}
                    onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                    placeholder="192.168.100.21"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    {language === 'zh-CN' ? '通信端口' : 'Puerto TCP'}
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    placeholder="4370"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
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
                  className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs disabled:opacity-50"
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
