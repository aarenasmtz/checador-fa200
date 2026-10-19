# 华龙商业集团 - 智能考勤与生物识别门禁管理系统
## Sistema Profesional de Control de Asistencia y Checador Biométrico
### Grupo Comercial Hualong

---

## 1. 项目简介 (Descripción General)

本项目是专为**华龙商业集团 (Grupo Comercial Hualong)** 旗下连锁商场、仓储物流中心打造的企业级分布式考勤与生物识别控制中心。

### 核心设计原则 (Hardware Phase 1 Constraint):
> **⚠️ 阶段一硬件安全铁律 (Regla de Oro Fase 1):**  
> 当前开发阶段**尚未拿到 FA200 实体考勤机**。系统**严禁猜测、臆造或硬编码任何未经抓包验证的二进制网络协议与端口命令**。  
> 平台采用依赖倒置驱动架构，100% 运行于 `MockBiometricProvider` 与高性能可视化模拟器之上。未来实体机到货后，仅需实现一个驱动类即可零风险无缝点亮，保护已有业务代码免受任何破坏。

---

## 2. 技术栈架构 (Stack Tecnológico)

| 层次 (Capa) | 技术选型 (Tecnología) | 说明 (Descripción) |
| :--- | :--- | :--- |
| **后端核心 (Backend)** | ASP.NET Core Web API (.NET 9 C#) | 高性能 REST API，基于 Clean Architecture |
| **数据库持久化 (Database)** | Microsoft SQL Server + EF Core 9 | Code-First 迁移、严格外键、唯一哈希约束 |
| **生物驱动解耦 (Biometrics)** | `IBiometricProvider` 驱动工厂 | 隔离物理硬件与模拟器，Feature Flag 开关保护 |
| **后台工作服务 (Worker)** | .NET BackgroundService | 异步轮询摄入队列、设备心跳自愈与工时复算 |
| **报表引擎 (Reports)** | ClosedXML (v0.105) + QuestPDF 2024 | 原生 `.xlsx` 格式与高管汇报 `.pdf` (Landscape) |
| **前端界面 (Frontend)** | React 19 + TypeScript + Vite + Tailwind CSS v4 | 现代化沉浸式暗黑高科技控制台 UI |
| **国际化 (i18n)** | 简体中文 (默认) + 西班牙语 | 一键平滑切换，双语全量词条覆盖 |
| **容器化 (DevOps)** | Docker & Docker Compose | 一键编排 SQL Server、API、Worker 与 Nginx |

---

## 3. 核心功能模块 (Módulos del Sistema)

1. **首页综合看板 (Dashboard):**
   - 今日应到、实到、迟到、缺勤、早退 KPI 实时卡片。
   - 近 7 天考勤走势折线/柱状图。
   - 各分店出勤对比饼图。
   - 最新 10 条实时打卡动态流水。
2. **FA200 设备模拟器 (Simulator):**
   - 快速单步打卡仿真（选择分店、设备、员工、识别方式、打卡类型、时间）。
   - 一键生成经典测试场景：正常准时、迟到 (>10 分钟容差)、早退、打卡不全、整周批量数据。
   - 重复打卡防御测试：连续发送完全相同打卡，验证 SHA-256 唯一约束幂等拦截。
3. **考勤记录中心 (Attendance):**
   - 每日综合工时流水表，精准记录实际上班、下班、出勤工时、迟到分钟、加班工时。
   - 支持多条件筛选（分店、日期范围、工号、出勤状态）。
   - 一键触发全员或单人「重新核算考勤」。
4. **员工管理 (Employees):**
   - 分页员工目录，展示工号、中西双语姓名、所属分店、部门、排班计划。
   - 员工当月出勤率与迟到次数动态统计。
5. **分店与设备管理 (Branches & Devices):**
   - 4 大预置分店（Centro 旗舰店、Norte 分店、Insurgentes 分店、CEDI 仓储物流中心）。
   - 设备状态与连通性测试、人员仿真同步。
6. **班次排班规则 (Schedules):**
   - 灵活配置上班/下班基准时间、工作日集合。
   - **迟到容差 (10 分钟):** 上班后 10 分钟以内算作正常出勤，超过 10 分钟开始累计迟到分钟。
   - **就餐自动扣减 (60 分钟):** 工时核算自动剔除用餐时间。
7. **异常与审批 (Incidents):**
   - 员工补签、病假、事假、年假正当理由申请。
   - 管理员一键「批准」后，系统自动重算当天考勤并纠正状态。
8. **报表中心 (Reports):**
   - **Excel (.xlsx) 原生导出:** 基于 ClosedXML 引擎，包含华龙商业集团企业表头、颜色高亮、冻结窗格与自动过滤器。
   - **PDF 汇报表原生导出:** 基于 QuestPDF 2024 引擎，生成 A4 横向排版，附带 KPI 统计框与正式签署确认栏。
   - 标准 CSV 导出支持。
9. **操作审计与变更追踪 (Audit):**
   - 自动记录操作员、时间、IP、模块、动作、记录 ID。
   - 提供 JSON Diff 查看器对比修改前（OldValues）与修改后（NewValues）。
10. **硬件对接就绪中心 (FA200 Readiness & Settings):**
    - 硬件未就绪全维醒目标识与安全解耦架构视图。
    - **30 项实操检测清单**（含物理供电、静态 IP、隔离 Wireshark 抓包、幂等测试、灰度发布）。

---

## 4. 架构与技术文档库 (Documentación Técnica)

Encuentre la documentación completa en la carpeta [`docs/`](file:///d:/Proyecto%20-%20Checador/docs):
- 📘 [Arquitectura del Sistema (docs/ARCHITECTURE.md)](file:///d:/Proyecto%20-%20Checador/docs/ARCHITECTURE.md)
- 🗄️ [Modelo de Base de Datos y Diccionario (docs/DATABASE.md)](file:///d:/Proyecto%20-%20Checador/docs/DATABASE.md)
- 🔌 [Especificación de Endpoints REST (docs/API.md)](file:///d:/Proyecto%20-%20Checador/docs/API.md)
- 🧬 [Guía de Integración Biométrica e Idempotencia (docs/BIOMETRIC-INTEGRATION.md)](file:///d:/Proyecto%20-%20Checador/docs/BIOMETRIC-INTEGRATION.md)
- 🚀 [Guía de Despliegue en VPS Linux (docs/DEPLOYMENT.md)](file:///d:/Proyecto%20-%20Checador/docs/DEPLOYMENT.md)
- 🛡️ [Protocolo de Verificación FA200 con Wireshark (docs/FA200-POC.md)](file:///d:/Proyecto%20-%20Checador/docs/FA200-POC.md)

---

## 5. 快速启动指南 (Guía de Inicio Rápido)

### 5.0 一键极速演示启动 (Arranque con 1 Solo Clic para Demostración al Cliente)
Hemos incluido un script inteligente en Python que valida dependencias, libera puertos colgados, arranca el Backend (.NET 9) y el Frontend (React 19), y **abre automáticamente el navegador** cuando todo está listo:

```bash
python start.py
```
*(En Windows también puede simplemente hacer **doble clic en `iniciar.bat`** en el explorador de archivos).*

---

### 5.1 方案 A：Inicio Manual (Desarrollo Individual)

#### 1) 启动 SQL Server 数据库
确认本地 SQL Server 运行于 `localhost:1433`。
连接字符串已预置为 Windows 身份验证或用户账号：
```
Server=localhost;Database=AttendanceDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;
```

#### 2) 编译后端并运行种子数据迁移
```bash
# 1. 运行全部单元与集成测试验证核心逻辑
dotnet test AttendanceSystem.slnx

# 2. 启动 API 服务 (监听 http://localhost:5081)
cd src/Attendance.Api
dotnet run
```
*注：API 启动时将自动执行 `AppDbContext.Database.Migrate()` 并通过 `DbSeeder` 预置 4 家分店、50 名员工、4 台模拟设备及 15 天历史考勤记录。*

#### 3) 启动前端界面
```bash
cd frontend
npm install
npm run dev
```
打开浏览器访问：`http://localhost:5173`。

#### 4) 初始登录账号
- **用户名:** `admin`
- **密码:** `Admin123!`
- **角色:** `SUPERADMIN`

---

### 5.2 方案 B：Docker Compose 一键启动 (Despliegue Completo en Contenedores)

```bash
# 复制环境变量模板
cp .env.example .env

# 构建并启动全部微服务
docker compose up -d --build
```
启动后容器包含：
- **SQL Server 2022:** `localhost:1433`
- **Web API (.NET 9):** `http://localhost:5081`
- **Background Worker:** 后台常驻
- **Frontend (Nginx):** `http://localhost:3000`

---

## 6. 硬件到货后的第二阶段工作 (Fase 2: Conexión Real FA200)

请参阅详细实操指南文档：
📄 [FA200 硬件对接与实操概念验证规范 (docs/FA200-POC.md)](file:///d:/Proyecto%20-%20Checador/docs/FA200-POC.md)

### 核心步骤提要：
1. 测试电脑与 FA200 直连专用交换机（**切勿直连生产网**）。
2. 打开 Wireshark 抓取 UDP 4370 或 TCP 报文。
3. 提取命令字与校验位，在 `src/Attendance.Biometrics/Providers/Fa200BiometricProvider.cs` 中填充实现。
4. 将 `appsettings.json` 中的 `"BiometricProviders:FA200:Enabled"` 设为 `true`。
5. 运行中央旗舰店灰度试运行 7 天，无缝过渡。
