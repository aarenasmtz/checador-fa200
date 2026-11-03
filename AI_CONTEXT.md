# AI_CONTEXT.md — Guía Maestra del Sistema Checador Biométrico FA200
> **Documento de Contexto para Modelos de IA (Codex, Copilot, Cursor, Gemini, Claude, etc.)**  
> *Este archivo condensa la arquitectura, reglas de negocio, topología de red, stack tecnológico, dependencias operativas y estado actual del proyecto para maximizar el uso de tokens y permitir la asistencia técnica autónoma sin ambigüedades.*

---

## 1. Resumen Ejecutivo del Proyecto
* **Cliente:** David Guan (Cadena de Restaurantes 百分百 - BAI FEN BAI).
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

## 6. Reglas de Negocio Clave (LFT y Operación Restaurantes BAI FEN BAI)

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
2. **Despliegue a Nuevas Sucursales:** Clonar la configuración del router Mango para las sucursales restantes de Restaurantes BAI FEN BAI (`Norte`, `Insurgentes`, `CEDI`), asignando rangos LAN diferenciados (`10.10.2.0/24`, `10.10.3.0/24`, etc.).
3. **Módulo de Nómina Automática:** Enlazar el reporte de incidencias y prenómina directamente con dispersión bancaria o formato de pago semanal.

---

## 11. Guía Maestra de Rediseño Frontend para Asistentes de IA (Codex, Copilot, Cursor, etc.)

> **INSTRUCCIÓN PARA CODEX / MODELOS DE IA:**  
> Al continuar con la implementación o modificación del rediseño visual de la aplicación web, debes apegarte estrictamente a las siguientes directrices y restricciones de arquitectura.

### 🔴 11.1 Restricción Inviolable de Diseño: `Control de Asistencia > Calendario`
- **Componente Protegido:** `frontend/src/components/attendance/AttendanceMatrixView.tsx` (o subvista Calendario en `AttendancePage.tsx`).
- **Estado de Aprobación:** Esta pantalla ya fue revisada y aprobada formalmente por el cliente (David Guan / Restaurantes BAI FEN BAI).
- **Regla Estricta:** **NO MODIFICAR, ALTERAR NI REESTRUCTURAR ESTA VISTA**.
- **Elementos que deben conservarse al 100%:**
  - Matriz bidimensional: filas por empleado, columnas por día del período seleccionado.
  - Indicadores y badges visuales: **A TIEMPO** (verde), **RETARDOS** (amarillo/ámbar), **FALTAS** (rojo), **DESCANSOS** (azul/gris), **PERMISOS** (morado).
  - Selectores de período: **Semana**, **2 Semanas**, **Mes**.
  - Controles de navegación temporal: flechas de período anterior/siguiente, botón "Hoy", etiqueta del rango mostrado y resaltado del día actual.
  - Filtros superiores por sucursal, empleado y caja de búsqueda en tiempo real.
  - Tooltip y modal interactivo por celda que detalla primer registro de entrada, salida y tiempo laborado.

---

### 🎨 11.2 Sistema de Diseño Visual Aprobado (Enterprise SaaS)
- **Framework de Estilos:** Tailwind CSS v4. Evitar estilos CSS genéricos o colores básicos sin armonía.
- **Paleta de Colores Corporativa:**
  - **Acento Primario:** Indigo moderno (`indigo-600` / `indigo-700` para botones principales, acentos y enlaces; `indigo-50` para badges o fondos activos; bordes `indigo-100` / `indigo-200`).
  - **Superficies y Fondos:** Fondos neutros limpios (`bg-slate-50` / `bg-slate-100`), contenedores y tarjetas en blanco (`bg-white`), bordes definidos (`border-slate-200` o `border-slate-100`), textos principales en `text-slate-900` / `text-slate-800` y secundarios en `text-slate-500` / `text-slate-400`.
  - **Estados de Asistencia y KPIs:**
    - *Presente / A Tiempo:* `emerald-600` / `emerald-500`, fondos suaves `bg-emerald-50`, bordes `border-emerald-200`.
    - *Retardo:* `amber-600` / `amber-500`, fondos `bg-amber-50`, bordes `border-amber-200`.
    - *Falta / Inasistencia:* `rose-600` / `rose-500`, fondos `bg-rose-50`, bordes `border-rose-200`.
    - *En Turno / Incompleto:* `purple-600` / `purple-500`, fondos `bg-purple-50`, bordes `border-purple-200`.
    - *Día de Descanso:* `slate-500` / `blue-500`, fondos `bg-slate-50`.
- **Geometría y Elevación:**
  - Tarjetas y paneles: `rounded-xl` con bordes sutiles `border border-slate-200` y sombra ligera `shadow-xs` o `shadow-sm`.
  - Botones e inputs: `rounded-lg`, padding consistente (`px-3 py-1.5` o `px-4 py-2`), transiciones suaves (`transition duration-200`).
  - Badges y estados: `rounded-full`, tipografía `text-xs font-semibold`, padding `px-2.5 py-0.5`.
- **Tipografía:**
  - Fuente sans-serif contemporánea (`Inter`, `system-ui`).
  - Números tabulares / monoespaciados para horas, códigos, minutos y contadores (`font-mono`).
- **Iconografía:** `lucide-react` con tamaños consistentes (`w-4 h-4` en botones y filas, `w-5 h-5` en barras de herramientas, `w-6 h-6` en tarjetas de métricas).

---

### 🌐 11.3 Internacionalización Obligatoria (Español / 简体中文)
- El sistema es operado activamente tanto por personal administrativo mexicano como por la dirección general china (David Guan).
- **Prohibido:** Dejar textos planos o hardcodeados en el JSX sin su respectiva traducción.
- Todo texto visible en pantallas, botones, opciones de select, placeholders de búsqueda, títulos de modales, alertas o leyendas debe utilizar el hook de idiomas:
  ```tsx
  import { useLanguage } from '../context/LanguageContext';
  const { t, language } = useLanguage();
  // Uso: {t('dashboard.presentToday')}
  ```
- Al agregar cualquier texto o clave nueva, registrarla obligatoriamente en ambos archivos:
  - `frontend/src/locales/es-MX.json`
  - `frontend/src/locales/zh-CN.json`

---

### 🔌 11.4 Reglas de Datos y Conectividad con el Backend
- **Prohibición de Datos Simulados (Mock Data):** Los datos deben provenir siempre de los endpoints reales de la API en ASP.NET Core (`src/Attendance.Api/Controllers/`).
- **Cliente HTTP:** Utilizar siempre el cliente configurado en `frontend/src/api/client.ts`, el cual inyecta automáticamente el token JWT en el encabezado `Authorization: Bearer <token>`.
- **Estados de Carga y Vacíos:**
  - Mostrar spinners o esqueletos durante peticiones (`RefreshCw className="animate-spin"`).
  - Incluir estados vacíos ilustrativos y amigables cuando una búsqueda, filtro o fecha no tenga registros.
  - Proporcionar botón de reintento en caso de fallo en la llamada HTTP.

---

### 📋 11.5 Especificación Pantalla por Pantalla para Continuar el Rediseño

| Pantalla | Archivo Fuente | Especificación y Comportamiento Esperado |
| :--- | :--- | :--- |
| **Dashboard** | `frontend/src/pages/DashboardPage.tsx` | - 4 KPI cards superiores (Total Empleados, Presentes Hoy, Retardos Hoy, Faltas Hoy).<br>- Gráfica de Tendencia (7 días): barras apiladas proporcionales con tooltip interactivo y clic que abre el modal `GetDayDetail`.<br>- Card de Distribución por Sucursal con progreso relativo.<br>- Tabla "Checadas en Tiempo Real": ordenamiento bidireccional (asc/desc) por Fecha/Hora, Nombre, Código, Sucursal y Estado; selector de filtro por sucursal física; badge interactivo del método biométrico (Face, Fingerprint, Card, PIN). |
| **Control de Asistencia** | `frontend/src/pages/AttendancePage.tsx` | - Pestaña 1: **Calendario** (`AttendanceMatrixView.tsx`) -> **INTOCABLE**.<br>- Pestaña 2: **Bitácora Diaria**: listado detallado con horas de entrada, comida (salida y regreso), salida de turno, minutos trabajados, retardos y estado. Incluye botón de Reprocesamiento (`/api/v1/attendance/reprocess`) y modal de corrección manual (`ManualOverride`). |
| **Dispositivos** | `frontend/src/pages/DevicesPage.tsx` | - Grid de tarjetas de checadores FA200 con badge de conectividad Online/Offline en tiempo real.<br>- IP asignada en VPN (`10.10.1.10`), puerto `4370`, nombre de sucursal asociada y última sincronización registrada.<br>- Botón de "Test de Conexión / Ping" para verificar latencia en milisegundos. |
| **Empleados** | `frontend/src/pages/EmployeesPage.tsx` | - Directorio de personal con avatar/iniciales, número de empleado, ID biométrico (`userClockId`), sucursal contractual, puesto y turno asignado.<br>- Modal de alta y edición con validación de ID biométrico único. Filtro por sucursal y estado activo/inactivo. |
| **Sucursales** | `frontend/src/pages/BranchesPage.tsx` | - Tarjetas visuales de cada sucursal (`Centro`, `Prueba Casa`, `Norte`, `Insurgentes`, `CEDI`).<br>- Métricas por sucursal: total de empleados (`b.employeeCount`) y total de checadores instalados (`b.deviceCount`). |
| **Horarios** | `frontend/src/pages/SchedulesPage.tsx` | - Catálogo de turnos (Diurno, Nocturno, Mixto, Turno Restaurante).<br>- Definición de hora de entrada/salida, tolerancia en minutos (10-15 min), ventana y descuento de comida, y asignación de días laborales. |
| **Incidencias** | `frontend/src/pages/IncidentsPage.tsx` | - Bandeja de solicitudes de justificación (retardos justificados, faltas médicas, vacaciones, permisos con/sin goce de sueldo).<br>- Flujo de aprobación/rechazo con recálculo automático de asistencia. |
| **Reportes** | `frontend/src/pages/ReportsPage.tsx` | - Generador de prenómina por rango de fechas (semanal, quincenal, mensual) y sucursal.<br>- Exportación oficial a Excel `.xlsx` (ClosedXML) y PDF apaisado de alta calidad (QuestPDF) con firmas de conformidad. |
| **Auditoría** | `frontend/src/pages/AuditPage.tsx` | - Historial cronológico de modificaciones manuales realizadas por supervisores.<br>- Comparador visual de cambios (diff JSON) con fecha, usuario responsable y justificación obligatoria. |
| **Homologación FA200** | `frontend/src/pages/SettingsPage.tsx` | - Protocolo interactivo de 30 pasos con persistencia local para enrolamiento y puesta a punto de nuevos relojes FA200 y routers Mango. |

---

### 🚀 11.6 Comandos de Trabajo para Codex

```bash
# 1. Ejecutar el servidor frontend en modo desarrollo:
cd "d:\Proyecto - Checador\frontend"
npm run dev

# 2. Verificar que no existan errores de TypeScript ni de bundle:
npm run build

# 3. Compilar el backend .NET (si se tocan endpoints o DTOs):
cd "d:\Proyecto - Checador"
dotnet build src/Attendance.Api/Attendance.Api.csproj

# 4. Publicar frontend hacia el servidor VPS de producción:
cd "d:\Proyecto - Checador\frontend"
npm run build
scp -r dist/* root@193.46.198.88:/var/www/checador-web/
```

