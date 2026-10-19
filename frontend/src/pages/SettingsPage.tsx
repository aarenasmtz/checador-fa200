import React, { useState } from 'react';
import {
  Settings,
  AlertTriangle,
  Layers,
  CheckSquare,
  Square
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ChecklistItem {
  id: string;
  category: string;
  titleZh: string;
  titleEs: string;
  descZh: string;
  descEs: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  // 1. Physical & Power
  {
    id: 'c1-1',
    category: '1. 物理检查与供电 (Físico y Alimentación)',
    titleZh: '检查机身铭牌与输入规格',
    titleEs: 'Verificar placa de datos y especificaciones de entrada',
    descZh: '核对 FA200 标称电压为 12V 1.5A/2A DC，防止过压击穿硬件。',
    descEs: 'Confirmar voltaje nominal 12V 1.5A/2A DC para evitar sobretensión.',
  },
  {
    id: 'c1-2',
    category: '1. 物理检查与供电 (Físico y Alimentación)',
    titleZh: '电源适配器与备用电池接入',
    titleEs: 'Fuente de poder y batería de respaldo',
    descZh: '配置专用稳压电源与断电应急后备电源，保证考勤数据不丢失。',
    descEs: 'Conectar regulador y respaldo de energía para garantizar persistencia.',
  },
  {
    id: 'c1-3',
    category: '1. 物理检查与供电 (Físico y Alimentación)',
    titleZh: '传感器光学与红外镜头清洁',
    titleEs: 'Inspección de sensores ópticos e infrarrojos',
    descZh: '检查指纹棱镜与双目光面部识别镜头无划痕及油污遮挡。',
    descEs: 'Verificar prisma de huella y lente facial sin suciedad ni rasguños.',
  },
  {
    id: 'c1-4',
    category: '1. 物理检查与供电 (Físico y Alimentación)',
    titleZh: '出厂固件版本号记录',
    titleEs: 'Registro de versión de firmware de fábrica',
    descZh: '进入系统信息菜单，拍照记录固件版本（如 Ver 6.60 / ZEM600 等平台）。',
    descEs: 'Anotar versión de firmware y plataforma desde el menú del dispositivo.',
  },
  {
    id: 'c1-5',
    category: '1. 物理检查与供电 (Físico y Alimentación)',
    titleZh: '防拆报警与物理复位孔验证',
    titleEs: 'Prueba de botón tamper y orificio de reinicio',
    descZh: '测试机身背面防拆微动开关及 Reset 重启针孔机械可靠性。',
    descEs: 'Comprobar microswitch tamper y orificio de reinicio físico.',
  },

  // 2. Network & Static IP
  {
    id: 'c2-1',
    category: '2. 网络配置与静态IP (Red e IP Estática)',
    titleZh: '分配专用静态 IP 与 VLAN 隔离',
    titleEs: 'Asignación de IP estática y VLAN aislada',
    descZh: '严禁使用动态 DHCP，避免路由器租期到期导致 IP 漂移断连。',
    descEs: 'Evitar DHCP; asignar IP fija en segmento reservado para periféricos.',
  },
  {
    id: 'c2-2',
    category: '2. 网络配置与静态IP (Red e IP Estática)',
    titleZh: '子网掩码与默认网关校验',
    titleEs: 'Comprobación de máscara y puerta de enlace',
    descZh: '配置正确的网关地址，确保跨网段分店能够路由至总部服务器。',
    descEs: 'Configurar gateway correcto para asegurar enrutamiento entre sucursales.',
  },
  {
    id: 'c2-3',
    category: '2. 网络配置与静态IP (Red e IP Estática)',
    titleZh: '端口连通性嗅探 (Nmap / Telnet)',
    titleEs: 'Escaneo de puertos abiertos (Nmap / Telnet)',
    descZh: '在隔离测试机使用 Nmap 扫描设备开放端口（如 4370 UDP, 80 HTTP, 5005 TCP）。',
    descEs: 'Escanear puertos abiertos en el dispositivo mediante Nmap (ej. 4370 UDP, 80 HTTP).',
  },
  {
    id: 'c2-4',
    category: '2. 网络配置与静态IP (Red e IP Estática)',
    titleZh: '通信密码与防暴力破解密码设置',
    titleEs: 'Establecimiento de contraseña de comunicación (CommKey)',
    descZh: '更改设备出厂默认的 0 通信密码，设定高强度机密通讯密钥。',
    descEs: 'Cambiar la clave por defecto "0" por una contraseña segura.',
  },
  {
    id: 'c2-5',
    category: '2. 网络配置与静态IP (Red e IP Estática)',
    titleZh: '双向 ICMP Ping 稳定性压测 (0% 丢包)',
    titleEs: 'Prueba de estrés ICMP Ping (0% pérdida)',
    descZh: '持续 1000 次 ping 包测试，平均时延必须小于 2ms，丢包率为 0。',
    descEs: 'Ejecutar ping continuo; la latencia debe ser <2ms con 0% de pérdida.',
  },

  // 3. Protocol Sniffing
  {
    id: 'c3-1',
    category: '3. 隔离网络抓包分析 (Análisis Wireshark Aislado)',
    titleZh: '搭建隔离以太网测试沙盒环境',
    titleEs: 'Montaje de banco de pruebas en red aislada',
    descZh: '测试机与 FA200 单独直连交换机，绝不接入公司生产网络。',
    descEs: 'Conectar dispositivo y máquina de pruebas en switch aislado sin producción.',
  },
  {
    id: 'c3-2',
    category: '3. 隔离网络抓包分析 (Análisis Wireshark Aislado)',
    titleZh: 'Wireshark 启动捕获设备开机握手包',
    titleEs: 'Captura Wireshark de paquetes de inicio/handshake',
    descZh: '开启 Wireshark 过滤 ip.addr == [设备IP]，记录设备上电广播与握手序列。',
    descEs: 'Filtrar por IP del equipo y grabar paquetes de encendido y difusión.',
  },
  {
    id: 'c3-3',
    category: '3. 隔离网络抓包分析 (Análisis Wireshark Aislado)',
    titleZh: '执行单次指纹打卡并截获报文',
    titleEs: 'Captura de paquete tras checada real con huella',
    descZh: '用测试手指打卡一次，记录发送的数据帧协议（UDP 4370 或 TCP 推送）。',
    descEs: 'Realizar checada de prueba y analizar payload (UDP 4370 o TCP Push).',
  },
  {
    id: 'c3-4',
    category: '3. 隔离网络抓包分析 (Análisis Wireshark Aislado)',
    titleZh: '分析 Payload 报文头与命令字 (CMD)',
    titleEs: 'Inspección de cabeceras binarias y comandos (CMD)',
    descZh: '确定报文结构中是否含有 0x0409 (CMD_ACK_OK) 或 0x0504 (CMD_DATA) 等特征。',
    descEs: 'Identificar si usa tramas estándar tipo ZK con bytes de comando y checksum.',
  },
  {
    id: 'c3-5',
    category: '3. 隔离网络抓包分析 (Análisis Wireshark Aislado)',
    titleZh: '确定通讯架构为主动 Push 还是轮询 Pull',
    titleEs: 'Determinación de arquitectura: Push activo vs Pull (Sondeo)',
    descZh: '核实 FA200 是否支持 ADMS/IClock 云端主动 HTTP 推送，或需后台轮询拉取。',
    descEs: 'Confirmar si el equipo soporta modo Cloud Push (HTTP ADMS) o requiere sondeo.',
  },

  // 4. Safe Handshake & Driver Implementation
  {
    id: 'c4-1',
    category: '4. 驱动实现与安全对接 (Implementación Segura)',
    titleZh: '保持 IBiometricProvider 纯净契约不变',
    titleEs: 'Mantener contrato IBiometricProvider sin modificaciones',
    descZh: '领域核心业务不许修改，所有硬件差异全在 Fa200BiometricProvider 内部封装。',
    descEs: 'Cero cambios en Application/Domain; todo se encapsula en Fa200BiometricProvider.',
  },
  {
    id: 'c4-2',
    category: '4. 驱动实现与安全对接 (Implementación Segura)',
    titleZh: '配置 appsettings.json 硬件安全开关 (Feature Flag)',
    titleEs: 'Configurar Feature Flag en appsettings.json',
    descZh: '只有当实际代码通过单元测试后，才将 "BiometricProviders:FA200:Enabled" 置为 true。',
    descEs: 'Activar el provider real sólo tras superar pruebas unitarias en sandbox.',
  },
  {
    id: 'c4-3',
    category: '4. 驱动实现与安全对接 (Implementación Segura)',
    titleZh: '超时熔断与网络重连机制 (Polly)',
    titleEs: 'Políticas de reintento y Circuit Breaker (Polly)',
    descZh: '硬件调用增加 3000ms 超时限制，连续 3 次失败自动熔断保护后台工作流。',
    descEs: 'Timeout de 3s y circuit breaker para no bloquear el Worker si el equipo se desconecta.',
  },
  {
    id: 'c4-4',
    category: '4. 驱动实现与安全对接 (Implementación Segura)',
    titleZh: '硬件时钟与 NTP 服务器授时同步',
    titleEs: 'Sincronización horaria con servidor NTP corporativo',
    descZh: '每日自动向 FA200 校准系统时间，防止因设备晶振偏差产生迟到误判。',
    descEs: 'Sincronizar RTC del checador diariamente para evitar disputas de asistencia.',
  },
  {
    id: 'c4-5',
    category: '4. 驱动实现与安全对接 (Implementación Segura)',
    titleZh: '打卡日志指针保存与断点续传 (Log Cursor)',
    titleEs: 'Gestión de puntero de lectura y retransmisión (Offset)',
    descZh: '记录最后一次同步的日志流水号，只拉取增量，支持断网重连后无损恢复。',
    descEs: 'Guardar índice del último log leído para sincronización incremental y resiliente.',
  },

  // 5. Data Ingestion & Idempotency
  {
    id: 'c5-1',
    category: '5. 数据摄入与防重幂等性 (Ingestión e Idempotencia)',
    titleZh: '统一映射为标准化 BiometricEvent 证据实体',
    titleEs: 'Mapeo uniforme a entidad de evidencia BiometricEvent',
    descZh: '无论何种硬件，打卡原始数据一律存入 BiometricEvents 表，作为不可篡改证据。',
    descEs: 'Todo registro se almacena en crudo en BiometricEvents como evidencia inmutable.',
  },
  {
    id: 'c5-2',
    category: '5. 数据摄入与防重幂等性 (Ingestión e Idempotencia)',
    titleZh: '验证 SHA-256 EventHash 唯一索引',
    titleEs: 'Verificación del índice único SHA-256 EventHash',
    descZh: '实测员工 1 秒内连续刷卡 5 次，系统仅保留 1 条记录，其余触发幂等忽略。',
    descEs: 'Prueba de 5 checadas en 1 segundo; el índice único descarta duplicados sin error.',
  },
  {
    id: 'c5-3',
    category: '5. 数据摄入与防重幂等性 (Ingestión e Idempotencia)',
    titleZh: '打卡类型与门禁方向严格识别 (In / Out)',
    titleEs: 'Detección correcta de Entrada vs Salida',
    descZh: '比对设备上的状态键（0=上班, 1=下班, 4=加班入, 5=加班出），与排班规则精准匹配。',
    descEs: 'Mapeo de teclas de función del equipo a los tipos CheckIn / CheckOut del sistema.',
  },
  {
    id: 'c5-4',
    category: '5. 数据摄入与防重幂等性 (Ingestión e Idempotencia)',
    titleZh: '生物识别介质归类 (指纹 / 面部 / 密码 / 刷卡)',
    titleEs: 'Clasificación de medio (Huella / Rostro / Tarjeta / PIN)',
    descZh: '解析硬件报文中的 VerifyMode 字段，正确在审计流中记录验证方式。',
    descEs: 'Parseo del campo VerifyMode para registrar método en logs de auditoría.',
  },
  {
    id: 'c5-5',
    category: '5. 数据摄入与防重幂等性 (Ingestión e Idempotencia)',
    titleZh: '全量同步与设备内存自动清理安全水线',
    titleEs: 'Límite de memoria del dispositivo y purga segura',
    descZh: '仅当服务器数据库成功落盘并备份后，才允许向设备下发已读标记，杜绝丢数据。',
    descEs: 'Marcar registros como leídos en el checador sólo tras confirmación en SQL Server.',
  },

  // 6. Production Rollout
  {
    id: 'c6-1',
    category: '6. 生产灰度发布 (Lanzamiento en Producción)',
    titleZh: '单店灰度试运行 7 天 (Sucursal Centro)',
    titleEs: 'Piloto de 7 días en una sola sucursal (Centro)',
    descZh: '首先在客流与员工最集中的中央分店安装首台 FA200，并与模拟器并行对照。',
    descEs: 'Instalar primer equipo en Sucursal Centro en paralelo con el simulador.',
  },
  {
    id: 'c6-2',
    category: '6. 生产灰度发布 (Lanzamiento en Producción)',
    titleZh: '考勤工时与迟到报表自动复核',
    titleEs: 'Auditoría automática de horas y retardos',
    descZh: '每天 18:30 自动比对物理打卡与排班算法生成的结果，确保零偏差。',
    descEs: 'Validar reporte diario a las 18:30 para asegurar precisión en cálculos de nómina.',
  },
  {
    id: 'c6-3',
    category: '6. 生产灰度发布 (Lanzamiento en Producción)',
    titleZh: '应急回滚方案 (一键切回 MockProvider)',
    titleEs: 'Plan de contingencia (Retorno a MockProvider con un clic)',
    descZh: '若硬件断电或线缆损坏，直接在配置中将该设备设为 MOCK，考勤系统无感运行。',
    descEs: 'Si el hardware falla, conmutar a MOCK sin reiniciar ni degradar el servicio.',
  },
  {
    id: 'c6-4',
    category: '6. 生产灰度发布 (Lanzamiento en Producción)',
    titleZh: '全集团其余 3 家分店硬件批量部署',
    titleEs: 'Despliegue escalonado en las 3 sucursales restantes',
    descZh: '完成灰度验收后，推广至 Norte、Insurgentes 及 CEDI 仓储中心。',
    descEs: 'Despliegue final en Sucursal Norte, Insurgentes y CEDI Distribución.',
  },
  {
    id: 'c6-5',
    category: '6. 生产灰度发布 (Lanzamiento en Producción)',
    titleZh: '硬件对接终期验收与运维手册交付',
    titleEs: 'Aceptación final y entrega de manual de operaciones',
    descZh: '签署硬件集成最终验收备忘录，交付中西双语考勤设备故障排查操作手册。',
    descEs: 'Firma de aceptación final y entrega de manual operativo bilingüe.',
  },
];

export const SettingsPage: React.FC = () => {
  const { t, language } = useLanguage();
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('fa200_checklist');
    return saved ? JSON.parse(saved) : {};
  });

  const toggleCheck = (id: string) => {
    const updated = { ...checkedItems, [id]: !checkedItems[id] };
    setCheckedItems(updated);
    localStorage.setItem('fa200_checklist', JSON.stringify(updated));
  };

  const totalChecks = CHECKLIST_ITEMS.length;
  const completedChecks = Object.values(checkedItems).filter(Boolean).length;
  const progressPercent = Math.round((completedChecks / totalChecks) * 100);

  // Group by category
  const categories = Array.from(new Set(CHECKLIST_ITEMS.map((item) => item.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          {t('settings.title')}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {t('settings.guideDesc')}
        </p>
      </div>

      {/* Prominent Physical Device Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base">
                  {t('settings.badgePending')}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-100 text-amber-800 border border-amber-300 font-bold">
                  PHASE 1 SECURE
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                {language === 'zh-CN'
                  ? '目前开发阶段未接入 FA200 实体机。系统完全通过 MockBiometricProvider 运行，未编写任何猜测性的二进制通信命令。当您收到实体机器时，请按本页面提供的 30 步标准化检测规程执行硬件验证。'
                  : 'En esta etapa el checador FA200 no está presente físicamente. El sistema corre 100% sobre MockBiometricProvider sin inventar protocolos binarios. Al recibir el dispositivo, siga esta lista de 30 pasos para la homologación real.'}
              </p>
            </div>
          </div>

          {/* Progress widget */}
          <div className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-2xs min-w-[180px] shrink-0 text-center">
            <span className="text-[11px] text-slate-600 block font-semibold">
              {language === 'zh-CN' ? '硬件接入准备进度' : 'Progreso de Homologación'}
            </span>
            <div className="text-xl font-bold text-slate-900 mt-0.5 font-mono">
              {completedChecks} / {totalChecks}
              <span className="text-xs text-indigo-600 ml-1.5 font-bold">({progressPercent}%)</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Architecture Decoupling Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          {language === 'zh-CN' ? '系统防风险解耦架构 (零破坏集成设计)' : 'Arquitectura Desacoplada Antirriesgo (Diseño Cero Impacto)'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
            <span className="text-emerald-800 font-bold block mb-1">1. Fa200BiometricProvider (Activo)</span>
            <p className="text-slate-600 font-sans">
              {language === 'zh-CN'
                ? 'FA200 真实硬件通信层。处理物理打卡传输、网络重连与 SHA-256 存证防重。'
                : 'Driver real de integración FA200. Comunicación TCP/IP, sincronización de checadas e idempotencia SHA-256.'}
            </p>
          </div>

          <div className="bg-indigo-50/60 p-4 rounded-xl border border-indigo-200">
            <span className="text-indigo-800 font-bold block mb-1">2. IBiometricProvider (统一契约)</span>
            <p className="text-slate-600 font-sans">
              {language === 'zh-CN'
                ? '定义 TestConnectionAsync, PullNewEventsAsync, SyncUsersAsync。解耦硬件实现与考勤工时计算。'
                : 'Define la interfaz contractual. Desacopla la lógica de negocio del protocolo de comunicación de hardware.'}
            </p>
          </div>

          <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
            <span className="text-blue-800 font-bold block mb-1">3. Agente Local en Tiempo Real</span>
            <p className="text-slate-600 font-sans">
              {language === 'zh-CN'
                ? '运行于本地节点，实时监听 FA200 硬件端口（4370），毫秒级自动推送打卡数据至云端。'
                : 'Servicio residente local en red. Sondea el puerto 4370 del FA200 y transmite checadas en tiempo real a la API.'}
            </p>
          </div>
        </div>
      </div>

      {/* 30-Check Checklist categorized */}
      <div className="space-y-6">
        <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-600" />
          {language === 'zh-CN' ? 'FA200 硬件到货 30 项实操检测清单' : 'Lista de Verificación de 30 Pasos para Hardware FA200'}
        </h2>

        {categories.map((cat) => {
          const catTitle = language === 'zh-CN'
            ? cat.split(' (')[0]
            : (cat.match(/\((.*?)\)/)?.[1] ? `${cat.split('.')[0]}. ${cat.match(/\((.*?)\)/)?.[1]}` : cat);
          return (
            <div key={cat} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  {catTitle}
                </span>
              </div>
            <div className="divide-y divide-slate-100">
              {CHECKLIST_ITEMS.filter((i) => i.category === cat).map((item) => {
                const isChecked = !!checkedItems[item.id];
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleCheck(item.id)}
                    className="p-4 flex items-start gap-3 hover:bg-slate-50/80 cursor-pointer transition select-none"
                  >
                    <div className="mt-0.5">
                      {isChecked ? (
                        <CheckSquare className="w-5 h-5 text-indigo-600" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold text-sm ${
                            isChecked ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {language === 'zh-CN' ? item.titleZh : item.titleEs}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {language === 'zh-CN' ? item.descZh : item.descEs}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};
