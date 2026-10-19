# Guía de Integración Biométrica y Abstracción de Hardware (BIOMETRIC-INTEGRATION.md)
## 华龙商业集团 · Control de Asistencia FA200

---

## 1. Principio Fundamental de Aislamiento de Hardware

El sistema sigue estrictamente el **Principio de Inversión de Dependencias (DIP)**. La lógica central del negocio (asistencia, retardos, horas extra, reportes y nómina) **nunca interactúa directamente con puertos, sockets TCP o comandos específicos del dispositivo**.

```
                           ┌────────────────────────┐
                           │   IBiometricProvider   │  ◄── Contrato Único
                           └───────────┬────────────┘
                                       │
                ┌──────────────────────┴──────────────────────┐
                ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│     MockBiometricProvider    │              │    Fa200BiometricProvider    │
│ (Activo - Simulación Segura) │              │ (Fase 2 - Hardware Físico)   │
└──────────────────────────────┘              └──────────────────────────────┘
```

---

## 2. Contrato de la Interfaz (`IBiometricProvider`)

```csharp
namespace Attendance.Biometrics.Interfaces;

public interface IBiometricProvider
{
    string ProviderName { get; }

    Task<bool> TestConnectionAsync(Device device, CancellationToken ct = default);

    Task<IReadOnlyList<RawBiometricRecord>> PullNewEventsAsync(Device device, DateTime since, CancellationToken ct = default);

    Task<bool> SyncUsersAsync(Device device, IReadOnlyList<Employee> employees, CancellationToken ct = default);

    Task<BiometricDeviceInfo> GetDeviceInfoAsync(Device device, CancellationToken ct = default);
}
```

---

## 3. Pipeline Criptográfico y Garantía de Idempotencia

Cada registro de entrada o salida pasa por una función hash SHA-256 canónica antes de ingresar a la base de datos:

```csharp
public static string ComputeHash(string deviceCode, string employeeCode, DateTime timestamp, BiometricMethod method)
{
    var raw = $"{deviceCode.Trim().ToUpperInvariant()}:{employeeCode.Trim().ToUpperInvariant()}:{timestamp:yyyy-MM-ddTHH:mm:ss}:{method}";
    using var sha256 = SHA256.Create();
    var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(raw));
    return Convert.ToHexString(bytes).ToLowerInvariant();
}
```

### Reglas de Idempotencia:
1. **Índice Único en Base de Datos:** La columna `EventHash` en la tabla `BiometricEvents` cuenta con un índice único estricto (`IX_BiometricEvents_EventHash`).
2. **Filtrado en Memoria:** El servicio `BiometricIngestionService` verifica si el hash ya existe antes de persistir.
3. **Respuesta Transparente:** Si llega un evento repetido (por ejemplo, el usuario pasó el rostro 3 veces seguidas o el dispositivo retransmitió logs tras reconexión), el sistema responde `isDuplicate = true` y no genera registros duplicados ni altera la jornada.

---

## 4. Gestión de Tiempos y Zonas Horarias

- **Zona Horaria del Corporativo:** `America/Mexico_City` (UTC-6 sin horario de verano según la legislación mexicana vigente).
- **Campos de Auditoría Temporal:**
  - `DeviceTimestamp`: Hora local reportada por el reloj de tiempo real (RTC) del checador.
  - `ReceivedAtUtc`: Marca de tiempo UTC registrada por el servidor en el momento exacto de recibir el paquete.
  - `ProcessedAtUtc`: Marca de tiempo UTC en que el motor calculó `AttendanceDaily`.
- **Detección de Desviación de Reloj (Clock Drift):** Si `|DeviceTimestamp - ReceivedAtUtc| > 15 minutos`, el sistema emite una advertencia de severidad media para sincronizar el reloj del equipo vía NTP.

---

## 5. Simulador FA200 para Pruebas Completas

El simulador permite generar cualquier escenario operativo sin contar físicamente con el equipo:

| Escenario | Comportamiento Simulado |
| :--- | :--- |
| **NormalDay** | Entrada a tiempo (07:56), salida a tiempo (18:04). |
| **Late** | Entrada a las 08:24 (>10 min de tolerancia), salida 18:05. Calcula 24 min de retardo. |
| **EarlyExit** | Entrada a las 07:58, salida anticipada a las 15:30 (estado `EarlyExit`). |
| **Incomplete** | Un solo marcaje a las 08:02 sin salida (estado `Incomplete`). |
| **Duplicate** | Envío de marcajes idénticos en el mismo segundo para certificar el bloqueo SHA-256. |
| **Week** | Generación masiva de 5 días de asistencia completa para pruebas de reportes. |

---

## 6. Procedimiento para la Fase 2 (Llegada del FA200 Físico)

1. Conectar el FA200 a una red aislada con switch de prueba.
2. Ejecutar la lista de verificación de 30 pasos documentada en [FA200-POC.md](file:///d:/Proyecto%20-%20Checador/docs/FA200-POC.md).
3. Capturar el tráfico con Wireshark para identificar el protocolo (Push HTTP ADMS o Pull UDP 4370).
4. Implementar los métodos de socket o HTTP en `Fa200BiometricProvider.cs`.
5. Activar el Feature Flag `"BiometricProviders:FA200:Enabled": true` en `appsettings.json`.
