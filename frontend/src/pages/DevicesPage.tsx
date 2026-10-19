import React, { useState, useEffect } from 'react';
import { Cpu, RefreshCw, Wifi, CheckCircle2, ShieldAlert, Activity, ArrowRightLeft } from 'lucide-react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';

interface Device {
  id: number;
  code: string;
  name: string;
  branchName: string;
  ipAddress: string;
  port: number;
  model: string;
  serialNumber: string;
  status: string;
  providerType: string;
  lastSyncAt?: string;
  isActive: boolean;
}

export const DevicesPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await api.get('/v1/devices');
      setDevices(res.data);
    } catch (err) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleTestConnection = async (id: number, name: string) => {
    try {
      const res = await api.post(`/v1/devices/${id}/test-connection`);
      setActionMessage(
        language === 'zh-CN'
          ? `[${name}] 连接成功: ${res.data.message || '模拟握手响应正常 (MockProvider)'}`
          : `[${name}] Conexión Exitosa: ${res.data.message || 'Respuesta Mock simulada OK'}`
      );
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      console.error('Test connection error:', err);
    }
  };

  const handleSync = async (id: number, name: string) => {
    try {
      const res = await api.post(`/v1/devices/${id}/sync`);
      setActionMessage(
        language === 'zh-CN'
          ? `[${name}] 同步成功: ${res.data.message || '已同步员工指纹与面部仿真数据'}`
          : `[${name}] Sincronización Exitosa: ${res.data.message || 'Datos biométricos sincronizados'}`
      );
      fetchDevices();
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err) {
      console.error('Sync error:', err);
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
              ? 'FA200 硬件设备与仿真控制器状态中心'
              : 'Centro de estado de dispositivos FA200 y controladores de simulación'}
          </p>
        </div>
        <button
          onClick={fetchDevices}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition self-start"
        >
          <RefreshCw className="w-4 h-4 text-indigo-600" />
          <span>{language === 'zh-CN' ? '刷新状态' : 'Actualizar'}</span>
        </button>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 shadow-2xs">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <h4 className="font-bold text-amber-800">
            {language === 'zh-CN' ? '阶段一保护模式：硬件仿真层已全面接管' : 'MODO DE SEGURIDAD FASE 1: SIMULACIÓN ACTIVA'}
          </h4>
          <p className="text-slate-600 mt-1 leading-relaxed">
            {language === 'zh-CN'
              ? '当前系统严格运行于 MockBiometricProvider 驱动之下。FA200 实体设备未到货前，绝不向网络发起未经授权的裸二进制私有报文。所有测试连接及人员同步均由仿真驱动返回沙盒结果。'
              : 'El sistema opera bajo MockBiometricProvider de manera desacoplada. No se envían paquetes binarios a la red sin el equipo físico verificado. Todas las pruebas y sincronizaciones responden de forma segura en sandbox.'}
          </p>
        </div>
      </div>

      {/* Notification Toast */}
      {actionMessage && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Device List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 animate-pulse text-xs">
          {t('common.loading')}
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
                  <span className="text-xs text-slate-500">{d.branchName}</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <Activity className="w-3 h-3 text-amber-600 animate-pulse" />
                  {t('devices.badgeSimulated')}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono">
                <div>
                  <span className="text-slate-500 font-sans">{t('devices.ip')}:</span>{' '}
                  <span className="text-indigo-600 font-semibold">{d.ipAddress}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">{t('devices.port')}:</span>{' '}
                  <span className="text-slate-800 font-semibold">{d.port}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">{t('devices.model')}:</span>{' '}
                  <span className="text-slate-800 font-semibold">{d.model}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-sans">{t('devices.serial')}:</span>{' '}
                  <span className="text-slate-600">{d.serialNumber}</span>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500">
                  <span>{t('devices.lastSync')}: </span>
                  <span className="text-slate-800 font-medium">
                    {d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : (language === 'zh-CN' ? '刚刚' : 'Reciente')}
                  </span>
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
    </div>
  );
};
