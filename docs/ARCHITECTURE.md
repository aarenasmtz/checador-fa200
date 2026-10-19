# Arquitectura del Sistema de Control de Asistencia y Checador Biométrico

## 1. Principio Fundamental: Desacoplamiento del Hardware

El sistema no depende directamente de ningún dispositivo biométrico específico (incluyendo el checador FA200). La capa de comunicación con hardware se aísla a través de la interfaz canónica `IBiometricProvider`:

```
┌─────────────────────────────────┐
│        Frontend (React)         │
└────────────────┬────────────────┘
                 │ HTTP REST (JSON)
                 ▼
┌─────────────────────────────────┐
│     Attendance.Api (.NET 9)     │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│     Attendance.Application      │
│  - AttendanceProcessingService  │
│  - Idempotencia (EventHash)     │
└────────────────┬────────────────┘
                 │
         ┌───────┴────────┐
         ▼                ▼
┌─────────────────┐ ┌─────────────────────────┐
│ Attendance.     │ │ Attendance.Infrastructure│
│ Biometrics      │ │ - EF Core / SQL Server   │
│ - MockProvider  │ │ - ClosedXML / Reportes  │
│ - FA200Provider │ └─────────────────────────┘
│   (stub seguro) │
└─────────────────┘
```

---

## 2. Proyectos de la Solución

- **`Attendance.Domain`**: Entidades maestras (`Company`, `Branch`, `Department`, `Position`, `Employee`, `Schedule`, `WorkDay`, `Holiday`, `BiometricDevice`, `BiometricEvent`, `AttendanceDaily`, `AttendanceIncident`, `LeaveRequest`, `User`, `Role`, `Permission`, `AuditLog`).
- **`Attendance.Application`**: DTOs, validaciones con FluentValidation, interfaces de repositorios, motor de asistencia.
- **`Attendance.Infrastructure`**: DbContext de Entity Framework Core 9, mapeo a SQL Server, JWT Token Provider, hasher BCrypt, exportadores XLSX (ClosedXML).
- **`Attendance.Biometrics`**: Contratos `IBiometricProvider` e implementaciones (`MockBiometricProvider`, `Fa200BiometricProvider` preparado con feature flag).
- **`Attendance.Worker`**: Worker service en segundo plano para procesar de forma continua eventos biométricos y actualizar `AttendanceDaily`.
- **`Attendance.Api`**: API REST ASP.NET Core con autenticación JWT, Swagger OpenAPI, logging Serilog, controladores de negocio y simulador.
- **`Attendance.UnitTests`**: Pruebas unitarias de cálculo de retardo, horas extra, cruces de medianoche e idempotencia.
- **`Attendance.IntegrationTests`**: Pruebas de integración de endpoints.
- **`frontend/`**: Portal web React 19 + TypeScript + Vite + Tailwind CSS v4, con soporte bilingüe (Chino 简体中文 y Español).
