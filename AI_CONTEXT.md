# AI_CONTEXT.md — Guía Maestra del Sistema Checador Biométrico FA200
> **Documento de Contexto para Modelos de IA (Codex, Copilot, Cursor, Gemini, Claude, etc.)**  
> *Este archivo condensa la arquitectura, reglas de negocio, topología de red, stack tecnológico, dependencias operativas y estado actual del proyecto para maximizar el uso de tokens y permitir la asistencia técnica autónoma sin ambigüedades.*

---

## 1. Resumen Ejecutivo del Proyecto
* **Cliente:** David Guan (Grupo Hualong / Cadena de Restaurantes 百分百 - Bai Fen Bai).
* **Propósito:** Sistema empresarial de **Control de Asistencia, Prenómina y Gestión Biométrica Distribuida** para cadenas de tiendas y restaurantes en México.
* **Problema Resuelto:** Eliminar la necesidad de tener una computadora dedicada encendida en cada sucursal para leer el reloj checador. En su lugar, un mini router portátil **GL.iNet GL-MT300N-V2 (Mango)** conecta el checador vía VPN **WireGuard** directamente al servidor VPS en la nube, donde un servicio daemon consulta las checadas y las procesa en tiempo real.
* **Dominio Laboral:** Legislación Laboral Mexicana (**Ley Federal del Trabajo - LFT**) con soporte bilingüe nativo (**Español y Chino Simplificado 简体中文**).
* **Rama Activa de Git:** `feature/prueba-fa200-mango-wireguard`
* **Repositorio Remoto:** `https://github.com/aarenasmtz/checador-fa200.git`

---

## 2. Reglas de Oro y Restricciones Críticas (DO NOT TOUCH)
1. **COEXISTENCIA CON LAMBRÍN POS:**  
   En el mismo servidor VPS (`193.46.198.88`) corre el sistema de punto de venta **Lambrín POS**:
   * API en puerto `5000` (servicio systemd: `pos-api.service`).
   * Dominio público: `api.wpcbajio.com`.
   * **PROHIBIDO tocar, reiniciar, alterar el Nginx, puertos o base de datos de Lambrín POS**.
2. **SEGURIDAD BIOMÉTRICA Y DE RED:**
   * El puerto `4370` del checador FA200 **NUNCA** debe exponerse a la IP pública ni por Port Forwarding en módems residenciales/comerciales. Todo el tráfico viaja cifrado dentro del túnel privado WireGuard (`10.10.0.0/24`).
   * La base de datos SQL Server (`ChecadorDb` puerto `1433`) solo escucha en `127.0.0.1` o VPN privada.
3. **POLÍTICA DE LECTURA DE HARDWARE (READ-ONLY ON CLOCK):**
   * El servicio de sincronización **NUNCA borra** los registros de asistencia en la memoria física del FA200 (`clear_attendance` prohibido).
   * No alterar la fecha/hora interna del reloj de forma automática para evitar desfasar checadas biométricas no descargadas.
   * La deduplicación se realiza exclusivamente a nivel de base de datos mediante hash `SHA-256`.

---

## 3. Topología de Red y Arquitectura de Conectividad

```
+-----------------------------------------------------------------------------------+
| SUCURSAL / TIENDA (Ej. PRUEBA CASA / CENTRO / INSURGENTES / NORTE / CEDI)         |
|                                                                                   |
|   +----------------------------+             +-------------------------------+    |
|   |   Checador ZKTeco FA200    |   Ethernet  |     GL.iNet GL-MT300N-V2      |    |
|   |   IP: 10.10.1.10 / 24      | <=========> |     (Router Mango OpenWrt)    |    |
|   |   Gateway: 10.10.1.1       |   (br-lan)  |     LAN: 10.10.1.1 / 24       |    |
|   |   Puerto: 4370 TCP/UDP     |             |     WireGuard: 10.10.0.2 / 32 |    |
|   +----------------------------+             +---------------+---------------+    |
+--------------------------------------------------------------|--------------------+
                                                               |
                                                  Túnel WireGuard Cifrado
                                                  (Internet WAN UDP 51820)
                                                               |
+--------------------------------------------------------------v--------------------+
| SERVIDOR NUBE VPS HOSTINGER (Ubuntu 24.04 LTS - 193.46.198.88)                    |
|                                                                                   |
|   +---------------------------------------------------------------------------+   |
|   | WireGuard wg0: 10.10.0.1/24 (AllowedIPs = 10.10.0.2/32, 10.10.1.0/24)      |   |
|   +-------------------------------------+-------------------------------------+   |
|                                         |                                         |
|   +-------------------------------------v-------------------------------------+   |
|   | checador-sync.service (Python pyzk + SQLite /var/www/data/vpn_sync_queue) |   |
|   | - Lee 10.10.1.10:4370 cada 20 seg.                                       |   |
|   | - Ingiere vía HTTP POST local con clave X-Agent-Key                       |   |
|   +-------------------------------------+-------------------------------------+   |
|                                         |                                         |
|   +-------------------------------------v-------------------------------------+   |
|   | checador-api.service (.NET 9 Kestrel en 127.0.0.1:5081)                   |   |
|   | - Valida idempotencia SHA-256 en BiometricEvents                          |   |
|   | - Registra asistencias en SQL Server (ChecadorDb)                         |   |
|   +-------------------------------------+-------------------------------------+   |
|                                         |                                         |
|   +-------------------------------------v-------------------------------------+   |
|   | Nginx Reverse Proxy (SSL Let's Encrypt):                                  |   |
|   | - Web Frontend: https://checador.wpcbajio.com (/var/www/checador-web)     |   |
|   | - Backend API:  https://api-checador.wpcbajio.com (Proxy a 5081)          |   |
|   +---------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------+
```

### Datos de Hardware y Firmware Homologado:
* **Modelo:** ZKTeco FA200 (Facial, Huella dactilar, Tarjeta RFID, Teclado numérico PIN).
* **Número de Serie:** `PHZ6092608717`
* **Versión de Firmware:** `Ver 6.60 Sep 19 2019`
* **Capacidad:** 1,200 rostros, 1,500 huellas, 100,000 eventos de asistencia.
* **Puerto:** `4370` (Modo preferente: TCP con fallback a UDP).
* **Particularidad de Firmware (IMPORTANTE):** Cuando se cambia la IP o el Gateway (`10.10.1.1`) en el menú del FA200, la configuración se guarda en flash pero el kernel Linux interno **no recarga la tabla de rutas activa hasta que el aparato se apaga y se vuelve a encender físicamente**.

---

## 4. Stack Tecnológico Detallado

### A. Backend (`src/`)
* **Framework:** ASP.NET Core Web API en **.NET 9.0 (C# 13)**.
* **Arquitectura:** Clean Architecture (DDD ligero).
  * `src/Attendance.Domain`: Entidades del dominio, enums (`AttendanceStatus`, `PunchType`, `VerificationMethod`, `IncidentType`, `IncidentStatus`), objetos de valor.
  * `src/Attendance.Application`: Interfaces (`IAppDbContext`, `IBiometricProvider`), DTOs, lógica de cálculo de retardos, horas extras y nómina.
  * `src/Attendance.Infrastructure`: Implementación de EF Core (`AppDbContext`), migraciones, proveedores de biométrico (`Fa200BiometricProvider`, `MockBiometricProvider`), generación de reportes ClosedXML y QuestPDF.
  * `src/Attendance.Api`: Controladores REST autenticados con JWT y Swagger/OpenAPI.
  * `src/Attendance.Worker`: `BackgroundService` para recálculos diarios y monitoreo de salud.
* **Base de Datos:** Microsoft SQL Server (`ChecadorDb`) con EF Core 9.
* **Motor de Reportes:**
  * `ClosedXML` (v0.105): Hojas de cálculo Excel `.xlsx` formateadas con estilos corporativos.
  * `QuestPDF` (v2024.12): PDFs apaisados (Landscape) con métricas, gráficos y firmas de recibido.

### B. Frontend (`frontend/`)
* **Framework:** React 19 + TypeScript + Vite.
* **Estilos:** Tailwind CSS v4 con paleta moderna indigo/slate/emerald y efectos sutiles.
* **Iconografía:** Lucide React (`lucide-react`).
* **Estado y Peticiones:** TanStack React Query (`@tanstack/react-query`) + Axios (`api/client.ts`).
* **Enrutamiento:** React Router DOM v7 (`BrowserRouter`, `Routes`, `Route`, `Navigate`).
* **Internacionalización (i18n):** `src/context/LanguageContext.tsx` con diccionarios completos en Español y Chino Simplificado (`zh-CN`).

### C. Agente y Daemons de Sincronización
* **VPN Poller en Producción:** `/var/www/checador-sync/venv` en VPS corriendo script `vpn_sync_daemon.py` bajo servicio `checador-sync.service`.
* **Herramientas de Diagnóstico Local:**
  * `scripts/test_fa200_readonly.py`: Conexión de solo lectura al FA200 para leer firmware, serial, usuarios y eventos sin alterar nada.
  * `scripts/sync_punch_to_cloud.py`: Script para probar ingestión manual de checadas hacia el endpoint de la API.

---

## 5. Módulos y Rutas de la Aplicación Web

| Ruta URL | Componente Frontend | Controlador Backend | Propósito y Descripción |
| :--- | :--- | :--- | :--- |
| `/login` | `LoginPage.tsx` | `AuthController.cs` | Acceso con JWT, recordatorio de sesión y selector de idioma. |
| `/` (Inicio) | `DashboardPage.tsx` | `DashboardController.cs` | Métricas del día (asistencias, retardos, faltas, checadas en tiempo real y gráficas). |
| `/attendance` | `AttendancePage.tsx` | `AttendanceController.cs` | Bitácora diaria y recálculo de horas trabajadas, retardos y horas extras. |
| `/devices` | `DevicesPage.tsx` | `DevicesController.cs` | Gestión de relojes FA200, IP, puerto, latencia en ms, estado Online/Offline y test de ping. |
| `/employees` | `EmployeesPage.tsx` | `EmployeesController.cs` | Directorio de empleados, código biométrico (`userClockId`), turno asignado y sucursal. |
| `/branches` | `BranchesPage.tsx` | `BranchesController.cs` | ABC de sucursales (`Centro`, `Prueba Casa`, `Insurgentes`, `Norte`, `CEDI`), conteo de dispositivos y plantilla. |
| `/schedules` | `SchedulesPage.tsx` | `SchedulesController.cs` | Catálogo de turnos, hora de entrada/salida, tolerancia (10-15 min) y descuento de comida. |
| `/incidents` | `IncidentsPage.tsx` | `IncidentsController.cs` | Solicitudes y justificaciones de faltas, permisos médicos, vacaciones y aprobaciones. |
| `/reports` | `ReportsPage.tsx` | `ReportsController.cs` | Exportación de prenómina a Excel (`.xlsx`) y PDF oficial por rango de fechas y sucursal. |
| `/audit` | `AuditPage.tsx` | `AuditController.cs` | Bitácora de trazabilidad de cambios manuales (`ManualOverride`) con comparador visual de diffs JSON. |
| `/users` | `UsersPage.tsx` | `UsersController.cs` | Administración de usuarios administrativos y roles (`SUPERADMIN`, `ADMIN_SUCURSAL`). |
| `/settings` | `SettingsPage.tsx` | - | Protocolo de homologación de hardware FA200 en 30 pasos con persistencia local. |

---

## 6. Reglas de Negocio Clave (LFT y Operación Hualong)

### A. Idempotencia y Prevención de Duplicados (SHA-256)
Cada evento biométrico genera un hash criptográfico único:
```csharp
EventHash = SHA256($"{DeviceCode}_{UserClockId}_{Timestamp:yyyyMMddHHmmss}_{PunchType}_{VerifyMode}");
```
* La tabla `BiometricEvents` en SQL Server cuenta con un índice único sobre `EventHash`.
* Si un empleado pasa la huella 5 veces en 10 segundos, o si el servicio de sincronización lee eventos repetidos de la memoria del reloj, el API descarta los duplicados sin generar error HTTP ni duplicar horas.

### B. Sucursal Física vs. Sucursal Contractual (Movilidad de Personal)
* En el Dashboard de checadas en vivo, la columna **Sucursal** indica el **lugar físico donde se ubicó el reloj** (`PRUEBA CASA (Mango)`).
* En la lista de asistencia y reportes de nómina, la **Sucursal** corresponde a la **sucursal contractual asignada al empleado** (`Centro`).
* **Motivo:** Permite que empleados de apoyo o supervisores chequen en cualquier restaurante de la cadena mientras su sueldo se carga contablemente a su sucursal de origen.

### C. Tolerancias y Horas Extras (LFT)
* **Tolerancia:** 10 minutos de cortesía tras la hora oficial de entrada.
* **Retardo:** Llegada entre minuto 11 y 30.
* **Falta por Retardo Mayor:** Llegada posterior al minuto 30 (configurable por turno).
* **Deducción de Comida:** Descuento automático de 60 minutos en jornadas mayores a 7 horas.
* **Jornadas LFT:** Diurna (8 hrs), Nocturna (7 hrs), Mixta (7.5 hrs). Horas excedentes se clasifican en dobles (hasta 9h semanales) y triples (>9h).

---

## 7. Estructura de Directorios del Repositorio

```
d:\Proyecto - Checador\
├── .env / .env.example              # Variables de entorno y llaves secretas
├── mango_cliente_casa.conf          # Configuración WireGuard cliente para el router Mango
├── AttendanceSystem.slnx            # Solución .NET 9
├── src/
│   ├── Attendance.Domain/           # Entidades, Enums, Interfaces del Dominio
│   ├── Attendance.Application/      # DTOs, Casos de Uso, Lógica de Negocio
│   ├── Attendance.Infrastructure/   # EF Core, SQL Server, Drivers ZKTeco, QuestPDF, ClosedXML
│   ├── Attendance.Api/              # ASP.NET Core Controllers, Middlewares, Program.cs
│   └── Attendance.Worker/           # BackgroundService para recálculos y polling interno
├── frontend/
│   ├── src/
│   │   ├── api/client.ts            # Cliente Axios con interceptor JWT
│   │   ├── context/                 # AuthContext y LanguageContext (i18n)
│   │   ├── pages/                   # Vistas de React (Dashboard, Attendance, Reports, etc.)
│   │   └── components/              # Componentes visuales y layout
│   └── package.json / vite.config.ts
├── scripts/
│   ├── test_fa200_readonly.py       # Diagnóstico de solo lectura al checador físico
│   ├── sync_punch_to_cloud.py       # Envío de checadas por API con autenticación
│   └── deployment/wireguard/        # Scripts de generación de llaves y túnel WireGuard
└── docs/                            # Documentación técnica extendida
```

---

## 8. Rutas y Comandos de Despliegue en el Servidor VPS

* **Acceso SSH:** `ssh -p 22 root@193.46.198.88`
* **Directorio Web Frontend:** `/var/www/checador-web/`
* **Directorio API Backend:** `/var/www/checador-api/`
* **Directorio Sync Daemon:** `/var/www/checador-sync/`
* **Base de datos SQLite Buffer:** `/var/www/data/vpn_sync_queue.db`

### Comandos de Compilación y Publicación:

#### Frontend:
```powershell
cd "d:\Proyecto - Checador\frontend"
npm run build
tar -czf frontend_dist.tar.gz -C dist .
scp -P 22 frontend_dist.tar.gz root@193.46.198.88:/tmp/
ssh -p 22 root@193.46.198.88 "tar -xzf /tmp/frontend_dist.tar.gz -C /var/www/checador-web/ && rm /tmp/frontend_dist.tar.gz && chown -R www-data:www-data /var/www/checador-web"
```

#### Backend API (.NET 9):
```powershell
cd "d:\Proyecto - Checador"
dotnet publish src/Attendance.Api/Attendance.Api.csproj -c Release -o publish-api
# Transferir publish-api/ a /var/www/checador-api/ y reiniciar:
# ssh root@193.46.198.88 "systemctl restart checador-api"
```

#### Comandos de Monitoreo en VPS:
```bash
# Ver estado del túnel WireGuard y peers conectados:
wg show

# Ver logs en vivo del servicio de sincronización biométrica:
journalctl -u checador-sync -f

# Probar conectividad TCP al FA200 desde el VPS:
nc -zvw3 10.10.1.10 4370
ping -c 3 10.10.1.10
```

---

## 9. Registro de Problemas Conocidos y Soluciones (Troubleshooting)

1. **Error "Fallido" al importar perfil WireGuard en GL.iNet Firmware 4.3.28:**
   * *Causa:* El firmware de GL.iNet rechaza perfiles sin DNS o con subredes solapadas en `AllowedIPs`.
   * *Solución:* Incluir `DNS = 1.1.1.1` bajo `[Interface]` y simplificar `AllowedIPs = 10.10.0.1/32` con saltos de línea LF (Unix) sin BOM UTF-8.
2. **Timeout conectando al FA200 (`10.10.1.10:4370`) desde el VPS tras configurar Gateway:**
   * *Causa:* El hardware ZKTeco FA200 no aplica la puerta de enlace predeterminada en su tabla de enrutamiento del kernel hasta que se apaga y enciende físicamente.
   * *Solución:* Reiniciar físicamente el FA200 (desconectar y conectar fuente de 12V).
3. **Mapeo de propiedades de conteo en sucursales (`BranchesPage.tsx`):**
   * *Causa:* El backend devuelve `deviceCount` y `employeeCount` (singular), mientras el frontend buscaba `devicesCount` y `employeesCount` (plural).
   * *Solución:* Usar fallback `b.deviceCount ?? b.devicesCount ?? 0`.

---

## 10. Próximos Pasos y Roadmap Inmediato
1. **Prueba Piloto de Aceptación:** Realizar checadas en el FA200 con la computadora apagada y verificar que el daemon del VPS ingiera los eventos en menos de 30 segundos.
2. **Despliegue a Nuevas Sucursales:** Clonar la configuración del router Mango para las sucursales restantes de Grupo Hualong (`Norte`, `Insurgentes`, `CEDI`), asignando rangos LAN diferenciados (`10.10.2.0/24`, `10.10.3.0/24`, etc.).
3. **Módulo de Nómina Automática:** Enlazar el reporte de incidencias y prenómina directamente con dispersión bancaria o formato de pago semanal.
