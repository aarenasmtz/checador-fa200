# Documentación de Base de Datos (SQL Server)

## 1. Esquema y Modelo de Datos

La base de datos del sistema está diseñada para **SQL Server** utilizando **Entity Framework Core 9**.
Soporta completamente caracteres **Unicode** (`nvarchar`) para nombres en **Chino simplificado (简体中文)** y Español.

### Tablas Principales

| Tabla | Descripción | Llaves e Índices Clave |
| :--- | :--- | :--- |
| **`Companies`** | Datos de la empresa (`华龙商业集团`) | PK `Id`, `Name` (Unicode) |
| **`Branches`** | Sucursales (`中心店`, `北区店`, etc.) con zona horaria | PK `Id`, FK `CompanyId`, Unique Index `(CompanyId, Code)` |
| **`Departments`** | Departamentos corporativos | PK `Id`, FK `CompanyId` |
| **`Positions`** | Puestos de trabajo | PK `Id`, FK `CompanyId` |
| **`Employees`** | Empleados de la empresa | PK `Id`, FK `CompanyId`, `BranchId`, Unique `EmployeeCode`, Unique `BiometricExternalId` |
| **`Schedules`** | Horarios, turnos, tolerancia y horas esperadas | PK `Id`, FK `CompanyId` |
| **`WorkDays`** | Días laborables y descansos por horario | PK `Id`, FK `ScheduleId` |
| **`EmployeeSchedules`** | Asignación de horario con vigencia | PK `Id`, FK `EmployeeId`, FK `ScheduleId` |
| **`Holidays`** | Días festivos oficiales y locales | PK `Id`, FK `CompanyId` |
| **`BiometricDevices`** | Catálogo de dispositivos biométricos | PK `Id`, FK `BranchId`, Unique `Code` |
| **`BiometricEvents`** | **Eventos inmutables de checadas** | PK `Id`, FK `DeviceId`, FK `EmployeeId`, **Unique Index `EventHash` (Idempotencia)** |
| **`AttendanceDailies`** | Resumen consolidado diario de asistencia | PK `Id`, FK `EmployeeId`, **Unique Index `(EmployeeId, Date)`** |
| **`AttendanceIncidents`**| Justificaciones, faltas justificadas y permisos | PK `Id`, FK `EmployeeId` |
| **`LeaveRequests`** | Solicitudes de vacaciones e incapacidades | PK `Id`, FK `EmployeeId` |
| **`Users`** | Usuarios del portal web | PK `Id`, Unique `Username`, Unique `Email` |
| **`Roles`** | Roles RBAC (SUPERADMIN, ADMIN, RH, etc.) | PK `Id`, Unique `Name` |
| **`Permissions`** | Permisos granulares del sistema | PK `Id`, Unique `Code` |
| **`UserRoles`** | Relación muchos a muchos Usuarios-Roles | Composite PK `(UserId, RoleId)` |
| **`RolePermissions`** | Relación muchos a muchos Roles-Permisos | Composite PK `(RoleId, PermissionId)` |
| **`AuditLogs`** | Registro inmutable de auditoría de cambios | PK `Id`, Index `Timestamp` |

---

## 2. Idempotencia y Protección contra Duplicados

Todo evento biométrico genera un hash determinista SHA-256 inmutable:
```csharp
EventHash = SHA256(deviceCode + ":" + employeeCode + ":" + timestamp_iso + ":" + method)
```
La tabla `BiometricEvents` posee un **UNIQUE INDEX** en la columna `EventHash`. En caso de reenvío de un mismo evento (por reintentos de red, reconexión de dispositivo o doble petición del simulador), la base de datos rechaza la inserción duplicada y el servicio registra la advertencia en Serilog.

---

## 3. Datos Semilla (Development Seed)

Se configuró el seeder automático en `DbSeeder.cs`:
- Empresa: `华龙商业集团 (Grupo Comercial Hualong)`
- 4 Sucursales: `中心店` (Centro), `北区店` (Norte), `南区店` (Sur), `广场店` (Plaza)
- 5 Departamentos y 6 Puestos
- 4 Dispositivos simulados FA200
- 50 Empleados bilingües (Chino/Español)
- 15 días de historial de eventos biométricos y asistencias diarias (A tiempo, Retardos, Salidas tempranas, Faltas y Horas extra).
- Usuario administrador: `admin` (Contraseña: `Admin123!`).
