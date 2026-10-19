# FA200 硬件对接与实操概念验证规范 (FA200 Hardware POC & Integration Guide)

> **当前阶段状态 (Fase 1 Estado):**  
> ⚠️ **实体设备未就绪 (Equipo Físico Ausente)**  
> 系统 100% 运行于模拟仿真驱动 (`MockBiometricProvider`)。领域层与数据库层已完全就绪并经过自动化单元测试验证。严禁在未捕获真实报文前猜测私有通信协议。

---

## 1. 架构解耦设计 (Diseño Desacoplado)

系统采用**依赖倒置原则 (DIP)** 与**驱动工厂模式**：

```
[ FA200 物理硬件 ] (未来接入)
        │
        ▼ (物理网口 / Wireshark 嗅探)
[ Fa200BiometricProvider ] ──┐
                             ├─► [ IBiometricProvider ] ──► [ IngestionService ] ──► [ BiometricEvents ] (SHA-256 证据)
[ MockBiometricProvider ]  ──┘                                                              │
   (当前运行仿真驱动)                                                                         ▼
                                                                                   [ AttendanceProcessingService ]
                                                                                            │
                                                                                            ▼
                                                                                   [ AttendanceDaily ] (工时核算)
```

### 1.1 核心防风险契约 (`IBiometricProvider`)
```csharp
public interface IBiometricProvider
{
    string ProviderName { get; }
    Task<bool> TestConnectionAsync(Device device, CancellationToken ct = default);
    Task<IReadOnlyList<RawBiometricRecord>> PullNewEventsAsync(Device device, DateTime since, CancellationToken ct = default);
    Task<bool> SyncUsersAsync(Device device, IReadOnlyList<Employee> employees, CancellationToken ct = default);
    Task<BiometricDeviceInfo> GetDeviceInfoAsync(Device device, CancellationToken ct = default);
}
```

### 1.2 零修改安全承诺
- **领域逻辑零修改:** 接入实体机无需修改 `AttendanceDaily`、`AttendanceProcessingService` 或 `BiometricEvents` 表结构。
- **数据流幂等性保证:** 实体机推送的每一条打卡记录都会先计算 `EventHash = SHA256(DeviceCode:EmployeeCode:Timestamp:Method)`。若发生网络重发或重复按指纹，唯一索引将拦截重复插入，数据库零脏数据。

---

## 2. 硬件到货 30 项实操检测清单 (Lista de Verificación de 30 Pasos)

当收到 FA200 实体设备后，工程师必须按以下 6 个阶段共 30 项检查逐一实施验证：

### 阶段一：物理与供电检查 (Físico y Alimentación)
1. **[ ] 铭牌输入核对:** 核验 FA200 背部铭牌，确认额定工作电压为 DC 12V 1.5A/2A。
2. **[ ] 电源稳压配置:** 严禁直插非稳压插座，必须接入带防浪涌功能的稳压电源或 UPS。
3. **[ ] 光学/红外镜头清洁:** 检查面部识别双目红外摄像头与指纹棱镜无划痕、指纹油膜或变形。
4. **[ ] 记录出厂固件信息:** 进入设备设置菜单 `系统信息 -> 固件版本`，拍照存档（例如 ZEM600 / Ver 6.60）。
5. **[ ] 防拆微动与复位孔测试:** 确认背部防拆报警开关弹性正常，机械复位孔位置明确。

### 阶段二：网络配置与静态 IP (Red e IP Estática)
6. **[ ] 分配专用静态 IP:** 在路由器或网关为设备 MAC 地址绑定固定 IP（如 `192.168.1.201`），禁止使用动态 DHCP。
7. **[ ] 配置子网掩码与网关:** 填写与考勤服务器一致的网关及子网掩码，确保跨网段互通。
8. **[ ] 端口扫描 (Nmap):** 在同网段测试机运行 `nmap -sS -sU -p 1-65535 192.168.1.201`，确认开放端口（如 UDP 4370、TCP 80、TCP 5005）。
9. **[ ] 设置高强度通信密钥:** 在机身菜单修改通信密码（CommKey），废弃默认密码 "0"。
10. **[ ] 压力 Ping 连通测试:** 执行 `ping -t -l 1024 [IP]` 进行 1000 次长 ping，验证丢包率必须为 0%，时延 < 2ms。

### 阶段三：隔离网络与 Wireshark 抓包分析 (Análisis Wireshark Aislado)
11. **[ ] 搭建物理隔离测试环境:** 测试电脑与 FA200 独立接入微型交换机，不接入任何生产内网。
12. **[ ] 捕获设备冷启动广播包:** 启动 Wireshark 监听网卡，FA200 通电开机，记录是否有 ARP/UDP 广播或 SSDP 发现包。
13. **[ ] 捕获单次指纹打卡报文:** 测试人员录入一枚测试指纹并打卡，在 Wireshark 过滤 `ip.addr == [设备IP]`，保存为 `.pcapng`。
14. **[ ] 分析报文命令字 (CMD):** 检查载荷前 8 字节是否符合标准协议头（如 ZK UDP 报文格式：`0x5050` 校验魔数、会话 ID、报文计数器、命令代码）。
15. **[ ] 确认架构类型 (Push vs Pull):** 查验设备是否支持云推送（ADMS / Cloud Server 配置菜单），判断是设备主动 HTTP POST 还是需要服务器后台轮询拉取。

### 阶段四：安全驱动实现 (Implementación Segura en Código)
16. **[ ] 继承 IBiometricProvider:** 保持现有接口签名不变，在 `Attendance.Biometrics/Providers/Fa200BiometricProvider.cs` 中实现。
17. **[ ] 开启 Feature Flag 保护:** 仅在本地沙盒测试完毕后，在 `appsettings.json` 中配置 `"BiometricProviders:FA200:Enabled": true`。
18. **[ ] 注入超时与熔断策略 (Polly):** 对网络 Socket 读写强制设置 3000ms 超时，连续失败 3 次触发断开保护，避免阻塞后台 Worker。
19. **[ ] 授时自动校准 (NTP Clock Sync):** 在驱动初始化或每日凌晨 03:00 自动下发系统时间，校准机身 RTC 硬件时钟。
20. **[ ] 增量日志指针跟踪 (Cursor Offset):** 记录已读取的最新记录流水号，避免重复扫描整机闪存。

### 阶段五：数据摄入与幂等性验证 (Ingestión e Idempotencia)
21. **[ ] 统一转换为 BiometricEvent:** 将设备解析出的日志映射为 `BiometricEvent`，存储在只追加证据表中。
22. **[ ] 验证防重哈希唯一约束:** 实测短时间内连续刷卡，验证数据库 `IX_BiometricEvents_EventHash` 成功拦截重复数据。
23. **[ ] 打卡类型（上下班）状态位匹配:** 核对设备上的功能键（In / Out / BreakIn / BreakOut）是否准确对应枚举值。
24. **[ ] 识别模式分类:** 提取验证模式（VerifyMode：0=密码, 1=指纹, 2=面部, 15=RFID卡），存入数据库以备合规审计。
25. **[ ] 安全清空与落盘双重确认:** 仅在本地数据库事务 `SaveChangesAsync()` 成功后，方可向硬件发送日志确认标记。

### 阶段六：生产灰度与上线交接 (Lanzamiento en Producción)
26. **[ ] 选定中央旗舰店灰度试运行:** 率先在客流量最大、员工最齐备的中央分店安装首台设备，保持与模拟器双轨比对 7 天。
27. **[ ] 每日核验考勤结算报表:** 每天 18:30 自动生成考勤核算结果，核对迟到、工时计算与实际班次一致性。
28. **[ ] 准备一键回滚预案:** 若硬件网络或线缆出现意外，只需在系统管理中将设备类型切换回 `MOCK`，业务立即可用。
29. **[ ] 批量部署其余分店:** 灰度期满且数据准确率 100% 后，将设备推广至 Norte、Insurgentes 及 CEDI 分店。
30. **[ ] 签署硬件集成验收备忘录:** 交付中西双语操作维护手册，完成硬件验收闭环。

---

## 3. Wireshark 抓包关键过滤表达式 (Filtros Clave de Wireshark)

在测试电脑运行 Wireshark 时，可使用以下过滤语法：

```wireshark
# 1. 过滤与 FA200 设备 IP 的所有通信
ip.addr == 192.168.1.201

# 2. 过滤常见考勤设备私有 UDP 端口
udp.port == 4370

# 3. 过滤 ADMS 云推送 HTTP 流量
tcp.port == 80 || tcp.port == 8080 || http

# 4. 仅查看含有有效数据的载荷包 (排除纯 ACK)
ip.addr == 192.168.1.201 && data.len > 0
```

---

## 4. 结论与安全底线 (Conclusión y Principio de Seguridad)

- 本系统已经完成第一阶段的全部架构、业务、数据库、工时计算算法、防重审计和中西双语管理界面的开发。
- 当实体 FA200 硬件到货时，**只需编写一个实现了 `IBiometricProvider` 的适配器类**，即可无缝点亮实体考勤机。
