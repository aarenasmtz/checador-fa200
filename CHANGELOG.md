# Registro de Cambios (CHANGELOG)

Todas las modificaciones, fases concluidas y pruebas se documentan en este archivo.

## [1.0.0-Fase1] - 2026-09-24

### Fase 1: Arquitectura y Solución
- **Backend (.NET 9)**:
  - Creada solución modular `AttendanceSystem.slnx`.
  - Proyecto `Attendance.Domain`: Entidades base, Enums y contratos puros de dominio.
  - Proyecto `Attendance.Application`: Interfaces de servicios, DTOs, validaciones con FluentValidation.
  - Proyecto `Attendance.Infrastructure`: Entity Framework Core 9, SQL Server Provider, JWT, ClosedXML.
  - Proyecto `Attendance.Biometrics`: Abstracción `IBiometricProvider`, `MockBiometricProvider` y `Fa200BiometricProvider` (stub seguro).
  - Proyecto `Attendance.Worker`: BackgroundService para procesamiento de eventos en segundo plano.
  - Proyecto `Attendance.Api`: ASP.NET Core Web API, Serilog, Swashbuckle OpenAPI, controladores.
  - Proyecto `Attendance.UnitTests`: Pruebas unitarias con xUnit, FluentAssertions y Moq.
  - Proyecto `Attendance.IntegrationTests`: Pruebas de integración de API y base de datos.
- **Frontend (React 19 + TypeScript + Vite)**:
  - Inicializado con Vite y React 19.
  - Dependencias instaladas: React Router DOM, TanStack Query, Axios, Lucide React, Tailwind CSS v4, React Hook Form, Zod, Date-fns.
  - Configurado soporte para internacionalización (Chino simplificado 简体中文 y Español).

## [1.0.0-Fase2] - 2026-09-24

### Fase 2: Base de Datos, Modelado y Migraciones
- **Entidades de Dominio (`Attendance.Domain`)**:
  - `Company`, `Branch`, `Department`, `Position` con soporte Unicode para Chino 简体中文 y Español.
  - `Employee`, `Schedule`, `WorkDay`, `EmployeeSchedule`, `Holiday`.
  - `BiometricDevice`, `BiometricEvent` (con método canónico `ComputeHash` SHA-256 inmutable), `AttendanceDaily` (con índice único por empleado y fecha), `AttendanceIncident`, `LeaveRequest`.
  - `User`, `Role`, `Permission`, `UserRole`, `RolePermission`, `AuditLog`.
- **Infraestructura y EF Core (`Attendance.Infrastructure`)**:
  - `AppDbContext` con mapeos de llaves foráneas, índices de idempotencia `EventHash` y restricciones de integridad.
  - Migración inicial `20260924210717_InitialCreate` generada y aplicada con éxito a SQL Server (`AttendanceDb`).
  - `DbSeeder`: Poblado de datos semilla para 华龙商业集团 (4 sucursales, 5 departamentos, 6 puestos, 50 empleados, 4 dispositivos FA200 simulados, 15 días de asistencias y usuario administrador `admin` / `Admin123!`).
- **Pruebas y Compilación**:
  - Solución .NET 9 compilada con 0 Advertencias y 0 Errores.
  - Migración aplicada en SQL Server exitosamente.

## [1.0.0-Fase3] - 2026-09-24

### Fase 3: Autenticación, Usuarios y RBAC
- **Seguridad y Tokens (`Attendance.Infrastructure` & `Attendance.Application`)**:
  - `TokenService`: Emisión de JWT Access Token (24h) y Refresh Token seguro criptográfico (7 días).
  - `AuthService`: Verificación de contraseñas con BCrypt, mapeo de roles y permisos granulares.
  - `AuthController`: Endpoints `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/me`.
  - `UsersController`: CRUD paginado de usuarios con asignación de roles y sucursal.
  - `RolesController`: Consulta de catálogo de roles y permisos.
- **Pruebas**:
  - Probada autenticación con `admin` / `Admin123!`, recibiendo claims de `SUPERADMIN` y lista de 10 permisos de sistema con código 200 OK.

## [1.0.0-Fase4] - 2026-09-24

### Fase 4: Desacoplamiento Biométrico, Ingestión y Pipeline de Idempotencia
- **Contrato e Interfaz (`Attendance.Biometrics`)**:
  - `IBiometricProvider`: Contrato uniforme para hardware y simulación (`TestConnectionAsync`, `PullNewEventsAsync`, `SyncUsersAsync`, `GetDeviceInfoAsync`).
  - `MockBiometricProvider`: Driver completo de simulación que emite eventos controlados con latencias configurables y modo offline.
  - `Fa200BiometricProvider`: Implementación protegida por Feature Flag (`BiometricProviders:FA200:Enabled = false`) que lanza `NotSupportedException` evitando cualquier paquete erróneo a la red.
  - `BiometricProviderFactory`: Factoría con soporte de conmutación en caliente.
- **Servicios de Ingestión (`Attendance.Application`)**:
  - `BiometricIngestionService`: Cálculo de huella criptográfica SHA-256 (`ComputeHash`), prevención de registros duplicados y almacenamiento como evidencia inmutable en `BiometricEvents`.
  - Validación de idempotencia demostrada: checadas repetidas son ignoradas de manera transparente sin alterar el estado previo.

## [1.0.0-Fase5] - 2026-09-24

### Fase 5: Motor de Cálculo de Asistencia y Reglas de Negocio
- **Cálculo Diario (`AttendanceProcessingService`)**:
  - Comparación de primer registro (Entrada) y último registro (Salida) contra el horario del empleado.
  - **Tolerancia de 10 Minutos:** Checadas dentro de la tolerancia se clasifican como `OnTime` con 0 minutos de retardo.
  - **Descuento de Comida:** Deducción automática de 60 minutos del total trabajado para reflejar horas productivas reales.
  - **Detección de Horas Extra:** Cálculo automático para salidas posteriores al horario asignado.
  - **Estados Evaluados:** `OnTime`, `Late`, `EarlyExit`, `Incomplete`, `Absent`, `RestDay`, `Holiday`, `Vacation`.
- **Pruebas Automatizadas (`Attendance.UnitTests`)**:
  - `CalculateDailyAttendance_WhenWithinTolerance_ShouldBeOnTime`: Superada con éxito.
  - `CalculateDailyAttendance_WhenLate_ShouldCalculateMinutesLate`: Superada con éxito.
  - `CalculateDailyAttendance_WhenSinglePunch_ShouldBeIncomplete`: Superada con éxito.
  - `ComputeHash_WhenSameParameters_ShouldBeDeterministicSHA256`: Superada con éxito.
  - `AttendanceCalculationTests`: 5 pruebas ejecutadas, 5 aprobadas (100% éxito).

## [1.0.0-Fase6] - 2026-09-24

### Fase 6: Simulador de Dispositivos y Escenarios Rápidos
- **API del Simulador (`SimulatorController`)**:
  - Endpoint `/api/devices/simulator/events` para inyección de checadas individuales parametrizables.
  - Endpoint `/api/devices/simulator/scenario` para inyección masiva de casos de prueba:
    - Escenario Normal (A tiempo)
    - Escenario Retardo (>10 min tolerancia)
    - Escenario Salida Temprana
    - Escenario Checada Incompleta (Un solo marcaje)
    - Escenario Duplicado (Validación de idempotencia en vivo)
    - Escenario Semana Completa (Generación de 5 días de asistencia)

## [1.0.0-Fase7] - 2026-09-24

### Fase 7: Motor de Exportación de Reportes Nativos
- **Generación XLSX (`ReportsController` & ClosedXML v0.105)**:
  - Generación de archivos Excel `.xlsx` reales (no CSV renombrado).
  - Encabezado corporativo institucional de 华龙商业集团 (Grupo Comercial Hualong).
  - Estilos de cabecera en azul corporativo, panel congelado en fila 4 (`FreezeRows(4)`).
  - Auto-filtros integrados en columnas y ajuste automático de ancho de columna.
  - Formato condicional de celdas con colores para Presente, Retardo y Falta.
  - Endpoint de exportación en formato CSV estándar.

## [1.0.0-Fase8] - 2026-09-24

### Fase 8: Frontend Bilingüe React 19 + TypeScript + Tailwind CSS v4
- **Diseño Visual e Internacionalización**:
  - Interfaz oscura corporativa de alto impacto con paleta Obsidian / Slate / Azure Blue.
  - Idioma predeterminado: **Chino Simplificado (简体中文)** con conmutador en tiempo real a **Español (es-MX)**.
  - Soporte de rutas protegidas y persistencia de sesión JWT.
- **Páginas Implementadas**:
  - `LoginPage.tsx`: Formulario con credenciales pre-cargadas para demostración rápida.
  - `DashboardPage.tsx`: Tarjetas de KPI, gráficos de tendencia de 7 días, distribución por sucursal y feed de checadas en tiempo real.
  - `SimulatorPage.tsx`: Panel de control de simulación de FA200 con inyector manual y generador de escenarios.
  - `AttendancePage.tsx`: Visor diario de horas trabajadas, retardos y visor de eventos biométricos en crudo.
  - `EmployeesPage.tsx`: Catálogo de 50 empleados con métricas de asistencia del mes en curso.
  - `BranchesPage.tsx`: Visualización de 4 sucursales con tarjetas informativas.
  - `DevicesPage.tsx`: Estado de dispositivos con banner explícito de "MODO SIMULACIÓN", botones de prueba de conexión y sincronización.
  - `SchedulesPage.tsx`: Visualización de turnos, reglas de tolerancia y días laborales.
  - `IncidentsPage.tsx`: Gestión de permisos e incidencias con aprobación y recálculo automático de asistencia.
  - `ReportsPage.tsx`: Selector de rangos de fecha y descarga directa de Excel (.xlsx) y CSV.
  - `UsersPage.tsx`: Gestión de usuarios del sistema y roles RBAC.
  - `SettingsPage.tsx`: Checklist de 30 puntos de verificación para la llegada del FA200 físico, diagrama de desacoplamiento y banner de protección.
- **Compilación de Frontend**:
  - Compilado con `tsc -b && vite build` en 7.95 segundos con **0 Errores y 0 Advertencias**.

## [1.0.0-Fase9] - 2026-09-24

### Fase 9: Despliegue, Contenedores y Documentación Final
- **Contenedores y DevOps**:
  - `docker-compose.yml`: Orquestación de SQL Server 2022, API .NET 9, Background Worker y Nginx Frontend.
  - `Dockerfile` para Backend API, Background Worker y Frontend SPA con Nginx.
  - `nginx.conf`: Configuración de proxy inverso para API y compresión Gzip.
  - `.env.example`: Plantilla de variables de entorno seguras.
- **Documentación de Homologación de Hardware**:
  - `docs/FA200-POC.md`: Guía de 30 pasos para el análisis de red con Wireshark, captura de tramas y desarrollo seguro del driver real cuando el equipo llegue físicamente.
  - `README.md`: Documento maestro bilingüe con instrucciones de despliegue local y en Docker.

## [1.1.0-Fase15-PDF] - 2026-09-24

### Fase 15 (Ampliación): Motor de Generación y Descarga de PDF Corporativo
- **Servicio PDF con QuestPDF 2024 (`Attendance.Infrastructure` & `Attendance.Application`)**:
  - Implementado `IPdfReportService` y `PdfReportService` para generación de documentos en formato horizontal (Landscape A4).
  - Encabezado corporativo institucional de 华龙商业集团 (Grupo Comercial Hualong) con datos de sucursal y periodo.
  - Tarjetas resumen tipo KPI: Registros totales, horas trabajadas acumuladas, minutos de retardo y horas extra.
  - Tabla de asistencia con celdas formateadas y códigos de color según estatus (`OnTime`, `Late`, `Absent`).
  - Bloque inferior de firmas formales: "Elaborado por Recursos Humanos", "Autorizado por Gerente de Sucursal" y "Sello de Auditoría Operativa".
  - Endpoint `GET /api/v1/reports/export/pdf` con respuesta binaria `application/pdf` de más de 650 KB por reporte generado.
  - Botón de descarga de PDF integrado en `ReportsPage.tsx` con soporte bilingüe.

## [1.1.0-Fase16-Auditoria] - 2026-09-24

### Fase 16: Interfaz Visual de Auditoría y Trazabilidad de Cambios
- **Pantalla de Auditoría (`frontend/src/pages/AuditPage.tsx`)**:
  - Visor interactivo de registros de auditoría alimentado por el endpoint `/api/v1/audit`.
  - Filtro en tiempo real por módulo y acción.
  - Modal de inspección de cambios (Diff Viewer) para contrastar `OldValues` (antes) vs `NewValues` (después) en formato JSON estructurado con resaltado de sintaxis.
  - Enlace `/audit` incorporado en el menú de navegación (`Sidebar.tsx`) y rutas (`App.tsx`).

## [1.1.0-Fase19-Tests] - 2026-09-24

### Fase 19: Cobertura Extendida de Pruebas Unitarias
- **Casos de Borde Automatizados (`AttendanceCalculationTests.cs`)**:
  - `ProcessDailyAttendance_WhenExitedEarly_ShouldBeEarlyExit`: Detección de salidas anticipadas.
  - `ProcessDailyAttendance_WhenWorkedPastEndTime_ShouldCalculateOvertime`: Deducción de comidas y cómputo de horas extra posterior al horario límite.
  - Suite de 7 pruebas unitarias superadas al 100% en xUnit con FluentAssertions.

## [1.1.0-Fase20-21-VPS-Hardening] - 2026-09-24

### Fases 20 y 21: Guía de Despliegue VPS y Monitoreo de Salud
- **Monitoreo (`Attendance.Api`)**:
  - Endpoint `/health` habilitado con `Microsoft.AspNetCore.Diagnostics.HealthChecks`, respondiendo HTTP 200 OK "Healthy".
- **Guía Técnica de VPS (`docs/DEPLOYMENT.md`)**:
  - Arquitectura en 4 capas para Ubuntu 24.04 LTS (Nginx, Kestrel API, Worker, SQL Server).
  - Archivos de servicio Systemd listos para producción (`attendance-api.service`, `attendance-worker.service`).
  - Configuración Nginx con TLS 1.3, Let's Encrypt, compresión Gzip y headers de seguridad (CSP, nosniff, SAMEORIGIN).
  - Script bash automatizado para backups diarios en disco y purga de respaldos de más de 30 días.

