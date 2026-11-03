# CODEX.md — Guía para Asistentes de IA (Codex, Copilot, Cursor, etc.)

Este documento contiene las directrices, restricciones operativas y reglas de diseño para la modificación y evolución del frontend y backend del **Sistema Checador Biométrico FA200** (Restaurantes BAI FEN BAI / 百分百 - David Guan).

👉 **Documento Maestro Completo:** [AI_CONTEXT.md](file:///d:/Proyecto%20-%20Checador/AI_CONTEXT.md)

---

## ⚠️ 1. RESTRICCIONES CRÍTICAS (DO NOT TOUCH)

1. **VISTA PROTEGIDA DE CONTROL DE ASISTENCIA (CALENDARIO):**
   - **Archivo:** `frontend/src/components/attendance/AttendanceMatrixView.tsx` (y su integración como pestaña Calendario en `frontend/src/pages/AttendancePage.tsx`).
   - **Regla:** **PROHIBIDO MODIFICAR ESTA VISTA**. Ya fue validada y aprobada formalmente por el cliente (David Guan / Restaurantes BAI FEN BAI).
   - **Debe permanecer 100% idéntica:** Estructura de matriz por empleado y día, iconos de estados (A Tiempo, Retardo, Falta, Descanso, Permiso), filtros de sucursal y empleado, selectores de período (Semana / 2 Semanas / Mes), navegación de fechas y modal de detalle de checadas.

2. **COEXISTENCIA CON LAMBRÍN POS EN EL VPS:**
   - En el servidor VPS (`193.46.198.88`) coexiste el sistema de punto de venta **Lambrín POS** (`pos-api.service`, puerto `5000`, `api.wpcbajio.com`).
   - **NUNCA** detener, alterar ni reiniciar el servicio de Lambrín POS.
   - El checador opera exclusivamente en el puerto interno `5081` (`checador-api.service`) y dominios `checador.wpcbajio.com` y `api-checador.wpcbajio.com`.

---

## 🎨 2. DIRECTRICES DE DISEÑO PARA MODIFICACIONES FRONTEND

1. **Estilo Visual Moderno (Enterprise SaaS):**
   - Usar Tailwind CSS v4 con paleta Indigo/Slate/Emerald/Amber/Rose.
   - Esquinas redondeadas suaves (`rounded-xl` para contenedores y cards, `rounded-lg` para controles, `rounded-full` para badges).
   - Sombras ligeras y micro-interacciones hover (`shadow-xs`, `hover:shadow-md`, `transition duration-200`).
   - Tipografía sans-serif moderna, con números tabulares/monoespaciados para horas, códigos y contadores (`font-mono`).

2. **Internacionalización Obligatoria (Español / Chino Simplificado 简体中文):**
   - **NUNCA** dejar textos fijos en el JSX.
   - Todo label, botón, título o mensaje debe usar el hook `const { t } = useLanguage()` y estar registrado tanto en:
     - `frontend/src/locales/es-MX.json`
     - `frontend/src/locales/zh-CN.json`

3. **Integridad de Datos Reales:**
   - **PROHIBIDO** el uso de mock data o valores hardcodeados. Todas las pantallas deben consumir la API de ASP.NET Core (`src/Attendance.Api/Controllers/`) mediante `frontend/src/api/client.ts`.
   - Incluir estados visuales de carga (`loading`), estados de error con botón de reintento, y estados vacíos informativos (`EmptyState`).

---

## 📋 3. CATÁLOGO DE PANTALLAS Y ESPECIFICACIÓN DE REDISEÑO

| Pantalla | Archivo | Especificaciones para Codex |
| :--- | :--- | :--- |
| **Dashboard** | `frontend/src/pages/DashboardPage.tsx` | - 4 tarjetas KPI (Total Empleados, Presentes Hoy, Retardos Hoy, Faltas Hoy).<br>- Gráfico interactivo de Tendencia de 7 días con tooltip al hover y modal de desglose individual al hacer clic.<br>- Distribución por sucursales con progreso relativo.<br>- Tabla de Checadas en Tiempo Real: ordenamiento por columnas (Fecha/Hora, Nombre, Código, Sucursal, Estado) con selector asc/desc y filtro por sucursal física. |
| **Control de Asistencia** | `frontend/src/pages/AttendancePage.tsx` | - Pestaña 1: **Calendario** (`AttendanceMatrixView.tsx`) -> **PROTEGIDA / INTOCABLE**.<br>- Pestaña 2: **Bitácora Diaria**: listado con hora de entrada, salida y regreso de comida, salida de turno, minutos trabajados, retardos y estado. Incluye botón de Reprocesamiento (`/api/v1/attendance/reprocess`) y modal de corrección manual (`ManualOverride`). |
| **Dispositivos** | `frontend/src/pages/DevicesPage.tsx` | - Cards de checadores FA200 con badge Online/Offline en vivo.<br>- IP WireGuard (`10.10.1.10`), puerto `4370`, sucursal asociada y botón de prueba de ping/latencia. |
| **Empleados** | `frontend/src/pages/EmployeesPage.tsx` | - Directorio de empleados con avatar/iniciales, número de empleado, código biométrico (`userClockId`), sucursal, puesto y turno.<br>- Modal de alta/edición y filtro por sucursal/estado. |
| **Sucursales** | `frontend/src/pages/BranchesPage.tsx` | - Tarjetas de sucursales (`Centro`, `Prueba Casa`, `Norte`, `Insurgentes`, `CEDI`) con total de empleados (`employeeCount`) y dispositivos (`deviceCount`). |
| **Horarios** | `frontend/src/pages/SchedulesPage.tsx` | - Catálogo de turnos con horas de entrada/salida, tolerancia (10-15 min), ventana y descuento de comida, y días de descanso/laborales. |
| **Incidencias** | `frontend/src/pages/IncidentsPage.tsx` | - Bandeja de justificaciones (retardos, faltas médicas, permisos, incapacidades, vacaciones) con flujo de aprobación/rechazo. |
| **Reportes** | `frontend/src/pages/ReportsPage.tsx` | - Exportación de nómina por rango de fechas a Excel `.xlsx` (ClosedXML) y PDF apaisado de alta calidad (QuestPDF). |
| **Auditoría** | `frontend/src/pages/AuditPage.tsx` | - Bitácora cronológica con comparador visual de diffs JSON para cambios manuales realizados por supervisores. |
| **Homologación FA200** | `frontend/src/pages/SettingsPage.tsx` | - Protocolo interactivo de 30 pasos con persistencia local para enrolamiento y puesta a punto de relojes FA200 y routers Mango. |

---

## 🛠️ 4. COMANDOS ÚTILES PARA DESARROLLO Y VALIDACIÓN

```bash
# 1. Servidor de desarrollo frontend (Vite en puerto 5173):
cd "d:\Proyecto - Checador\frontend"
npm run dev

# 2. Validación de compilación frontend (TypeScript + Vite):
npm run build

# 3. Compilación de backend .NET 9:
cd "d:\Proyecto - Checador"
dotnet build src/Attendance.Api/Attendance.Api.csproj

# 4. Publicación al servidor VPS (Frontend):
cd "d:\Proyecto - Checador\frontend"
npm run build
scp -r dist/* root@193.46.198.88:/var/www/checador-web/
```
