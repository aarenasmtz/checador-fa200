import React, { useState, useEffect } from 'react';
import api from '../api/client';
import { useLanguage } from '../context/LanguageContext';
import {
  Radio,
  Send,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  UserCheck,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const SimulatorPage: React.FC = () => {
  const { t, language } = useLanguage();

  const [devices, setDevices] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [method, setMethod] = useState('FACE');
  const [eventType, setEventType] = useState('Entry');
  const [punchDateTime, setPunchDateTime] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [devRes, empRes] = await Promise.all([
          api.get('/v1/devices'),
          api.get('/v1/employees?pageSize=100')
        ]);
        setDevices(devRes.data || []);
        if (devRes.data?.length > 0) setSelectedDevice(devRes.data[0].code);

        setEmployees(empRes.data?.items || []);
        if (empRes.data?.items?.length > 0) setSelectedEmployee(empRes.data.items[0].employeeCode);
      } catch (err) {
        console.error('Error loading simulator catalogs:', err);
      }
    };
    loadCatalogs();
  }, []);

  const handleSimulatePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload = {
        deviceCode: selectedDevice,
        employeeCode: selectedEmployee,
        timestamp: new Date(punchDateTime).toISOString(),
        method: method,
        eventType: eventType
      };

      const res = await api.post('/devices/simulator/events', payload);
      const logEntry = {
        time: new Date().toLocaleTimeString(),
        type: 'SINGLE_PUNCH',
        device: selectedDevice,
        employee: selectedEmployee,
        method: method,
        isDuplicate: res.data.isDuplicate,
        hash: res.data.eventHash,
        message: res.data.message
      };

      setLogs((prev) => [logEntry, ...prev.slice(0, 19)]);
    } catch (err: any) {
      const errorEntry = {
        time: new Date().toLocaleTimeString(),
        type: 'ERROR',
        device: selectedDevice,
        employee: selectedEmployee,
        message: err.response?.data?.message || err.message
      };
      setLogs((prev) => [errorEntry, ...prev.slice(0, 19)]);
    } finally {
      setLoading(false);
    }
  };

  const handleScenario = async (scenario: string) => {
    setLoading(true);
    try {
      const res = await api.post('/devices/simulator/scenario', {
        deviceCode: selectedDevice,
        employeeCode: selectedEmployee,
        scenario: scenario
      });

      const logEntry = {
        time: new Date().toLocaleTimeString(),
        type: 'SCENARIO',
        scenario: scenario,
        device: selectedDevice,
        employee: selectedEmployee,
        message: `Escenario '${scenario}' ejecutado con éxito.`,
        details: res.data.generatedEvents
      };

      setLogs((prev) => [logEntry, ...prev.slice(0, 19)]);
    } catch (err: any) {
      console.error('Scenario error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-amber-500 animate-pulse" />
          <h1 className="text-lg font-bold text-slate-900">{t('simulator.title')}</h1>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            FA200 Mock
          </span>
        </div>
        <p className="text-xs text-slate-500">{t('simulator.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Form: Manual Interactive Punch */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-600" />
              <span>{language === 'zh-CN' ? '手动构造单次打卡事件' : 'Simular Checada Individual'}</span>
            </h2>

            <form onSubmit={handleSimulatePunch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Device selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t('simulator.selectDevice')}
                  </label>
                  <select
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    {devices.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employee selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t('simulator.selectEmployee')}
                  </label>
                  <select
                    value={selectedEmployee}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    {employees.map((emp) => (
                      <option key={emp.employeeCode} value={emp.employeeCode}>
                        {emp.employeeCode} - {emp.firstName} {emp.lastName} ({emp.branchName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Biometric Method */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t('simulator.selectMethod')}
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="FACE">{language === 'zh-CN' ? '人脸识别 (FACE)' : 'Reconocimiento Facial (FACE)'}</option>
                    <option value="FINGERPRINT">{language === 'zh-CN' ? '指纹识别 (FINGERPRINT)' : 'Huella Digital (FINGERPRINT)'}</option>
                    <option value="CARD">{language === 'zh-CN' ? '刷卡 (CARD)' : 'Tarjeta RFID (CARD)'}</option>
                    <option value="MANUAL">{language === 'zh-CN' ? '手动补签 (MANUAL)' : 'Registro Manual (MANUAL)'}</option>
                  </select>
                </div>

                {/* Event Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t('simulator.selectType')}
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Entry">{language === 'zh-CN' ? '上班打卡 (Entry)' : 'Entrada (Entry)'}</option>
                    <option value="Exit">{language === 'zh-CN' ? '下班打卡 (Exit)' : 'Salida (Exit)'}</option>
                    <option value="Auto">{language === 'zh-CN' ? '自动判定 (Auto)' : 'Automático (Auto)'}</option>
                  </select>
                </div>

                {/* DateTime */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    {t('simulator.selectDateTime')}
                  </label>
                  <input
                    type="datetime-local"
                    value={punchDateTime}
                    onChange={(e) => setPunchDateTime(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-xs disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{t('simulator.punchBtn')}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Quick Scenario Buttons */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
            <h2 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>{t('simulator.quickScenarios')}</span>
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              {language === 'zh-CN'
                ? '一键生成典型考勤情况，立即验证考勤引擎的迟到、早退、漏卡与 SHA-256 幂等防重机制'
                : 'Genera escenarios con un click para probar inmediatamente retardo, salida temprana, y la desduplicación SHA-256'}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => handleScenario('NormalDay')}
                disabled={loading}
                className="p-3 rounded-lg bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-200 text-left transition flex flex-col gap-1 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('simulator.normalDay')}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {language === 'zh-CN' ? '07:56 入 / 18:04 出' : '07:56 Ent / 18:04 Sal'}
                </span>
              </button>

              <button
                onClick={() => handleScenario('Late')}
                disabled={loading}
                className="p-3 rounded-lg bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-200 text-left transition flex flex-col gap-1 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-amber-700 font-semibold">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{t('simulator.late')}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {language === 'zh-CN' ? '08:22 入 (>10分容差)' : '08:22 Ent (>10 min toler.)'}
                </span>
              </button>

              <button
                onClick={() => handleScenario('EarlyExit')}
                disabled={loading}
                className="p-3 rounded-lg bg-slate-50 hover:bg-orange-50/50 border border-slate-200 hover:border-orange-200 text-left transition flex flex-col gap-1 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-orange-700 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{t('simulator.early')}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {language === 'zh-CN' ? '07:58 入 / 16:30 出' : '07:58 Ent / 16:30 Sal'}
                </span>
              </button>

              <button
                onClick={() => handleScenario('Incomplete')}
                disabled={loading}
                className="p-3 rounded-lg bg-slate-50 hover:bg-purple-50/50 border border-slate-200 hover:border-purple-200 text-left transition flex flex-col gap-1 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-purple-700 font-semibold">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{t('simulator.incomplete')}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {language === 'zh-CN' ? '仅08:02打卡一次' : 'Sólo 1 checada 08:02'}
                </span>
              </button>

              <button
                onClick={() => handleScenario('Duplicate')}
                disabled={loading}
                className="p-3 rounded-lg bg-slate-50 hover:bg-indigo-50/50 border border-slate-200 hover:border-indigo-200 text-left transition flex flex-col gap-1 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-indigo-700 font-semibold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('simulator.duplicate')}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {language === 'zh-CN' ? '连发2次完全相同事件' : '2 eventos idénticos seguidos'}
                </span>
              </button>

              <button
                onClick={() => handleScenario('Week')}
                disabled={loading}
                className="p-3 rounded-lg bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-200 text-left transition flex flex-col gap-1 text-xs shadow-2xs"
              >
                <div className="flex items-center gap-1.5 text-indigo-600 font-semibold">
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('simulator.week')}</span>
                </div>
                <span className="text-[11px] text-slate-500">
                  {language === 'zh-CN' ? '周一至周五完整记录' : 'Lun a Vie completo'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Execution Log & Idempotency Proof */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col h-[520px] shadow-xs">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{language === 'zh-CN' ? '模拟事件执行日志 & 幂等校验' : 'Logs y Verificación de Idempotencia'}</span>
            </h3>
            {logs.length > 0 && (
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-400 hover:text-slate-700 font-medium"
              >
                {language === 'zh-CN' ? '清空日志' : 'Limpiar'}
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-mono text-[11px]">
            {logs.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs">
                {language === 'zh-CN'
                  ? '等待发送打卡信号...\n每次打卡将在此输出 SHA-256 签名与防重状态'
                  : 'Esperando eventos...\nAquí se visualizará el hash SHA-256 e idempotencia'}
              </div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`p-2.5 rounded-lg border text-left ${
                    log.isDuplicate
                      ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                      : log.type === 'ERROR'
                      ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                      : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold mb-1">
                    <span className="text-indigo-600 font-bold">[{log.time}]</span>
                    {log.isDuplicate ? (
                      <span className="text-amber-700 font-bold text-[10px] bg-amber-100/60 px-1.5 py-0.5 rounded">
                        {language === 'zh-CN' ? '幂等拦截 (拒绝重复打卡)' : 'IDEMPOTENCIA ACTIVADA (RECHAZO)'}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-bold text-[10px] bg-emerald-100/60 px-1.5 py-0.5 rounded">
                        {language === 'zh-CN' ? '处理成功 (新记录)' : 'PROCESADO CON ÉXITO'}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500">Device:</span> <strong className="text-slate-800">{log.device}</strong> |{' '}
                    <span className="text-slate-500">Emp:</span> <strong className="text-slate-800">{log.employee}</strong>
                  </div>
                  {log.hash && (
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      Hash: <span className="text-indigo-600 font-semibold">{log.hash}</span>
                    </div>
                  )}
                  <div className="text-[10px] text-slate-600 mt-1">{log.message}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
