# Rediseño CHECADOR WPC: implementación y validación

Fecha: 2026-11-02. Rama local: `codex/continuacion-rediseno-checador`, basada en `047e262`.

## Contexto y alcance

Se leyeron completos AGENTS.md, CODEX.md, AI_CONTEXT.md y el texto adjunto de la solicitud. El estado inicial de Git estaba limpio. Los cambios permanecen locales, sin commit, push, merge ni despliegue.

No se localizó `CHECADOR_Entrega_Codex.zip` ni sus archivos extraídos en el repositorio, D: o las ubicaciones de usuario revisadas. Por tanto, **no se ha leído ni comparado/aplicado** `CHECADOR_Continuacion_Codex.patch`, `Prompt_Continuacion_Codex.md` o `LEEME.md`. Se necesita la ruta del paquete para cerrar esa parte; no se asumió que hubiera una rama de continuación en GitHub.

La paleta y composición «Tarjetas claras» del texto adjunto se aplicaron de forma optativa. El Calendario sigue usando su contenedor original; el resto recibe estilos acotados y barra lateral de 192 px. No se cambió `index.css`, ningún manifiesto/lock de dependencias, ni backend.

## Cobertura por pantalla

| Pantalla | Implementación conservando API y operaciones existentes | Validación realizada |
| --- | --- | --- |
| Inicio | KPI, proporciones de gráfica basadas en valores reales, gráfico accesible por teclado, desglose diario con resumen reutilizable, tarjetas móviles de checadas; ordenamiento/filtro conservados | Datos reales; escritorio ES/ZH y cuatro anchos móviles; carga/error/vacío |
| Asistencia / Resumen | Cuatro marcas, horas, retardo y estado; tabla de escritorio y tarjetas móviles; detalle con cuatro bloques horizontales o 2×2; acceso a corrección autorizado | Datos reales; detalle en ambos idiomas; cinco tamaños; Escape y formularios; motivo obligatorio |
| Asistencia / Registros Reloj | Acceso y datos originales conservados; añadido error con reintento | Revisión de código; no se modificó la ingesta ni la deduplicación |
| Asistencia / Calendario | Sin cambios al componente, modal original, integración, filtros o presentación aprobada | Comparación contra frontend original `047e262` a 390 y 1440 px; misma geometría de 81 elementos |
| Dispositivos | Estados reportados por API, sin latencia inventada ni sustitutos de serial/firmware/IP; diagnóstico secundario; formularios existentes | Datos reales; estados visuales y apertura del formulario; sin ping, sincronización ni guardado |
| Empleados | Catálogo reutilizable mosaico/lista, iniciales, código, biometría, sucursal, puesto y turno; preferencia por usuario | Paridad de registros entre vistas y persistencia al recargar; filtro real de sucursal y búsqueda vacía; validación de código numérico positivo |
| Sucursales | Mosaico/lista con conteos reales y datos secundarios desplegables | Paridad/persistencia; formulario vacío bloqueado antes de API |
| Horarios | Mosaico/lista con jornada, tolerancia y configuración secundaria; formulario original conservado | Paridad/persistencia; requerido vacío; conmutación de comida fija/flexible sin guardar |
| Incidencias | Tarjetas móviles, estados y tipos localizados, acciones según permisos; flujo original conservado | Lecturas reales y vacío; apertura y requerido del formulario; sin aprobar/rechazar/registrar |
| Reportes | Filtros y exportación existentes; títulos localizados, errores/reintento, error de descarga visible, liberación de URL de blobs; «Incompleto» no recibe color de «Completo» | Vista real; fallo controlado de exportación; recuperación de vista previa; GET de PDF/Excel/CSV válidos |
| Auditoría | Diferencias antes/después legibles, JSON técnico desplegable, filtro de acción; origen distingue IP de dispositivo, usuario y transporte interno sin mapear globalmente loopback a un reloj | Lecturas reales; ES/ZH, escritorio/móvil y estados controlados |
| Configuración FA200 | Conectividad consultada por API separada del piloto histórico; 30 pasos originales en seis grupos, mismos identificadores y almacenamiento local | Lecturas reales; escritorio/móvil; traducciones; carga/error/vacío |
| Usuarios | Directorio mosaico/lista con estado reportado por API y preferencia por usuario | Paridad/persistencia; búsqueda y estados; no se añadió CRUD inexistente |

### Evidencia biométrica del detalle

El listado `/v1/attendance` no devuelve `punches`. La nueva variante del modal consulta `/v1/dashboard/day-detail` mediante `client.ts` cuando falta esa evidencia y busca el mismo identificador de jornada. Solo incorpora marcas originales; no reemplaza horas, estado ni clasificación del registro seleccionado.

El servidor devuelve una ventana ampliada que puede abarcar límites nocturnos. Cada marca conserva fecha completa, dispositivo y sucursal física; un aviso distingue esa ventana de las cuatro marcas elegidas de la jornada. Se comprobó una jornada con nueve marcas en la ventana y cinco en la nota de revisión diaria, sin reclasificar ninguna. Los métodos se derivan de esas marcas, sin inventarlos. Fallo de consulta y reintento probados conservando visibles los totales diarios.

## Pruebas y evidencia

- `npm run build`: aprobado (TypeScript + Vite). Advertencia de bundle principal de aproximadamente 755 kB; no se cambiaron dependencias ni el empaquetado del Calendario.
- `npm run lint`: salida 0, con advertencias de imports/variables sin uso, efectos y dependencias de hooks, incluyendo deuda previa en la vista protegida. No se presenta como lint sin advertencias.
- `dotnet test tests/Attendance.UnitTests/Attendance.UnitTests.csproj --no-restore --logger "console;verbosity=minimal"`: 38/38 aprobadas; compiló también los proyectos .NET. No se modificó backend.
- `git diff --check`: aprobado.
- Locales ES/ZH con las mismas claves y sin claves estáticas `t('...')` faltantes. Los nombres y mensajes históricos provenientes de API no se reescriben como datos traducidos.
- 44 casos móviles finales ES (11 pantallas × 320/375/390/430 px) y 44 ZH sin desbordamiento de página en las vistas rediseñadas. El viewport puede reservar 6 px para la barra de desplazamiento. No se confunde este resultado con iPhone/Android físicos.
- 22 casos de escritorio, 11 pantallas × ambos idiomas. En Asistencia se verificó Resumen; el Calendario tiene comparación propia.
- 11 errores y 11 vacíos por idioma usando respuestas controladas exclusivamente en el servidor local de QA. Reintento de Reportes y de evidencia del detalle comprobado al restaurar lecturas reales.
- Modal diario: cuatro bloques en una fila a 1440 px y dos filas a 320/375/390/430 px; sin desbordamiento, cierre con Escape, datos reales y valores ausentes como raya, no horas ficticias.
- Exportaciones reales consultadas para 2026-11-02 a 2026-11-08: PDF 200 / 266355 bytes / una página; Excel 200 / 9845 bytes / libro válido; CSV 200 / 541 bytes / cuatro líneas. Se inspeccionó visualmente el PDF con Poppler y se abrieron Excel/CSV con bibliotecas locales. El PDF **ya** llega sin las cinco tarjetas: no se hizo una modificación backend innecesaria.
- El clic de descarga PDF se ejercitó, pero el navegador integrado no entregó un evento de descarga verificable. Los archivos se verificaron mediante GET autenticado; queda pendiente confirmar la descarga de blobs en navegadores finales. El error controlado de exportación sí fue visible en UI.

Resultados detallados: `docs/qa-redesign/*.json`. Son registros de esta sesión de QA, no una nueva suite E2E desatendida.

### Capturas

- [Detalle escritorio ES](qa-redesign/daily-detail-desktop-es.jpg) / [móvil ES](qa-redesign/daily-detail-mobile-es.jpg).
- [Detalle escritorio ZH](qa-redesign/daily-detail-desktop-zh.jpg) / [móvil ZH](qa-redesign/daily-detail-mobile-zh.jpg).
- [Evidencia original móvil](qa-redesign/daily-evidence-mobile-es.jpg).
- Calendario escritorio: [antes](qa-redesign/calendar-desktop-before.jpg) / [después](qa-redesign/calendar-desktop-after.jpg).
- Calendario móvil: [antes](qa-redesign/calendar-mobile-before.jpg) / [después](qa-redesign/calendar-mobile-after.jpg).
- Hay capturas por pantalla e idioma en la misma carpeta. Algunas preceden los últimos ajustes menores; las capturas ES del detalle se actualizaron al cierre.

## Protección y límites

`frontend/src/components/AttendanceMatrixView.tsx` conserva el blob `382293d73f733cbdb498fe4e830e0188169bee3e`; `DailyAttendanceDetailModal.tsx`, `AttendanceStatusIcon.tsx`, `index.css`, manifiestos/lock y backend no se editaron. La integración como Calendario y su presentación original se conservaron. No se afirma igualdad píxel a píxel: se compararon capturas y geometría DOM.

No se accedió a servicios, puertos ni base de datos de Lambrín POS. No se modificó FA200, WireGuard, VPN, sincronización, checadas originales ni reglas de deduplicación. No hay checadas por WhatsApp. Las lecturas reales se hicieron a través del proxy existente; no se ejecutaron operaciones de negocio que escriban en producción.

## Entorno para revisar

- Desarrollo: `http://192.168.100.19:5173/`.
- Revisión local de solo lectura: `http://192.168.100.19:5175/?qaState=real`.
- Inicio del servidor de QA: `npx vite --config vite.qa.config.ts`. El archivo no es importado por la aplicación ni por el build de producción. Bloquea escrituras salvo autenticación. Los modos `error` y `empty` son de prueba y afectan ese servidor completo; usar `qaState=real` para restaurar lecturas.

## Pendientes explícitos

1. Recibir ruta del paquete y comparar/aplicar su parche según sus instrucciones, preservando este trabajo local.
2. Aceptación visual del cliente y revisión en navegadores/dispositivos físicos, incluido comportamiento de descarga, teclado móvil y lectores de pantalla.
3. Validar escrituras, aprobación/rechazo, eliminación, permisos con cuentas no administrativas, paginación multipágina y sincronización en un entorno aislado con datos de prueba. No se ejecutan contra producción para cerrar una lista de QA.
4. Validación física del FA200 y conectividad actual VPN en operación autorizada. Los estados consultados de API, el piloto documentado y las respuestas controladas no equivalen a esta validación.
5. Reducir las advertencias de lint y evaluar división del bundle en un cambio separado que mantenga la vista protegida. No se ejecutaron pruebas de integración cuya configuración pudiera alcanzar una base real.
