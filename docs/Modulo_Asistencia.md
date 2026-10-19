Quiero agregar al sistema actual de Control de Asistencia un nuevo módulo llamado:

## CONTROL DE ASISTENCIA

IMPORTANTE:
No crear un proyecto nuevo. Este módulo debe integrarse al sistema existente, respetando completamente:

- Arquitectura actual.
- Backend existente en .NET.
- Frontend existente.
- Base de datos actual.
- Sistema de autenticación.
- Roles y permisos.
- Catálogo de empleados.
- Catálogo de sucursales.
- Horarios existentes.
- Diseño visual, componentes, colores y navegación actuales.
- Auditoría existente, si ya está implementada.

Antes de realizar cambios, analiza la estructura actual del proyecto y reutiliza componentes, servicios, endpoints, DTOs, entidades y patrones existentes siempre que sea posible.

No duplicar lógica ni crear tablas innecesarias.

---

# 1. OBJETIVO

Crear una vista visual tipo calendario/matriz que permita a los dueños o administradores de las sucursales consultar rápidamente la asistencia de sus empleados.

La tabla debe mostrar empleados en filas y días en columnas.

La vista predeterminada debe mostrar 2 semanas completas, es decir, 14 días visibles.

Ejemplo conceptual:

| Empleado | L 28 | M 29 | M 30 | J 1 | V 2 | S 3 | D 4 | L 5 | M 6 | M 7 | J 8 | V 9 | S 10 | D 11 |
|----------|------|------|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|------|------|
| Aaron    | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🔵 | 🔵 | 🟢 | 🟢 | 🟢 | 🟢 | 🔴 | 🔵 | 🔵 |
| Matías   | 🟢 | 🟡 | 🟢 | 🟢 | 🟢 | 🔵 | 🔵 | 🟢 | 🟢 | 🟡 | 🟢 | 🟢 | 🔵 | 🔵 |
| David    | 🟢 | 🟢 | 🔴 | 🟢 | 🟢 | 🔵 | 🔵 | 🟢 | 🟢 | 🟢 | 🟢 | 🟢 | 🔵 | 🔵 |

---

# 2. ENCABEZADO POR SEMANA

La tabla debe agrupar visualmente los días por número de semana.

Ejemplo:

SEMANA 39
L 28 | M 29 | M 30 | J 1 | V 2 | S 3 | D 4

SEMANA 40
L 5 | M 6 | M 7 | J 8 | V 9 | S 10 | D 11

El encabezado debe mostrar:

- Número de semana.
- Día de la semana.
- Número del día.
- Diferenciar visualmente sábado y domingo.
- Resaltar el día actual.

La primera columna "Empleado" debe permanecer fija (sticky) cuando exista desplazamiento horizontal.

---

# 3. ESTADOS DE ASISTENCIA

Cada día del empleado deberá representar visualmente su estado.

Estados mínimos:

🟢 A tiempo
🟡 Retardo
🔴 Falta
🔵 Descanso
🟣 Permiso / Vacaciones

No depender exclusivamente del color. Utilizar también iconos para mejorar accesibilidad.

Crear un componente reutilizable para representar los estados.

Por ejemplo:

AttendanceStatusIcon

El componente debe recibir el estado y renderizar automáticamente:

- Icono.
- Color.
- Tooltip.
- Texto accesible.

---

# 4. EDICIÓN MANUAL

Los usuarios con permisos administrativos deben poder hacer clic sobre una celda de asistencia.

Al hacerlo, mostrar un menú contextual o modal pequeño con las opciones:

✓ A tiempo
⏱ Retardo
✕ Falta
☕ Descanso
🏖 Permiso / Vacaciones

Cuando se cambie manualmente un estado:

1. Solicitar opcionalmente una observación.
2. Guardar quién realizó el cambio.
3. Guardar fecha y hora.
4. Guardar estado anterior.
5. Guardar estado nuevo.
6. Marcar que el registro fue modificado manualmente.

Nunca eliminar el registro original generado por el dispositivo biométrico.

Las modificaciones deben funcionar como una corrección administrativa.

---

# 5. AUDITORÍA

Toda modificación manual deberá quedar registrada.

Guardar como mínimo:

- Empleado.
- Fecha afectada.
- Estado anterior.
- Estado nuevo.
- Usuario que realizó el cambio.
- Fecha/hora de modificación.
- Observación.
- Origen del registro.

Ejemplos de origen:

BIOMETRICO
MANUAL
SISTEMA

Esto permitirá posteriormente identificar si la información provino del dispositivo FA200 o fue modificada por un administrador.

---

# 6. FILTROS

Agregar encima de la tabla una barra de filtros.

Debe contener:

Sucursal:
[ Todas las sucursales ▼ ]

Periodo:
[ Septiembre 2026 ▼ ]

Vista:
[ Semana | 2 semanas | Mes ]

La vista predeterminada será:

2 semanas

Agregar navegación:

[ ← 2 semanas ] [ Hoy ] [ 2 semanas → ]

Al cambiar de periodo NO recargar toda la página.

Consultar nuevamente la API y actualizar únicamente la tabla.

---

# 7. FILTRO POR SUCURSAL

Los administradores generales podrán seleccionar cualquier sucursal.

Los usuarios que solamente administran una sucursal deberán visualizar únicamente los empleados de esa sucursal.

Respetar el sistema actual de roles/permisos.

No confiar únicamente en restricciones del frontend.

El backend debe validar que el usuario tenga acceso a la sucursal solicitada.

---

# 8. TOOLTIP / DETALLE DE ASISTENCIA

Al pasar el mouse sobre una celda, mostrar información como:

Empleado: Aaron Arenas
Fecha: 29/09/2026
Entrada: 08:13
Salida: 18:04
Retardo: 13 minutos
Estado: Retardo
Origen: Biométrico
Sucursal: Centro

Si el registro fue modificado:

Modificado por: Administrador
Fecha modificación: 29/09/2026 10:35
Motivo: Tráfico / autorización del encargado

En dispositivos móviles, esta información debe aparecer al tocar la celda.

---

# 9. RESUMEN DEL PERIODO

Antes de la tabla agregar tarjetas pequeñas de resumen.

Ejemplo:

A tiempo
42

Retardos
8

Faltas
3

Descansos
17

Permisos
2

Los valores deben calcularse utilizando el periodo y sucursal seleccionados.

---

# 10. RESPONSIVE

Desktop:

Mostrar 14 días de forma cómoda siempre que el ancho disponible lo permita.

Tablet:

Permitir desplazamiento horizontal.

Móvil:

Mostrar inicialmente 7 días.

Permitir desplazamiento horizontal o navegación semanal.

La columna del empleado debe permanecer fija.

Evitar que nombres largos rompan el diseño.

---

# 11. BACKEND .NET

Implementar los endpoints necesarios siguiendo la arquitectura actual del backend.

No crear endpoints duplicados si ya existen servicios que proporcionan parte de esta información.

Crear, si es necesario, un endpoint similar a:

GET /api/asistencia/calendario

Parámetros:

sucursalId
fechaInicio
fechaFin

Ejemplo:

GET /api/asistencia/calendario?sucursalId=1&fechaInicio=2026-09-28&fechaFin=2026-10-11

La respuesta debe estar optimizada para construir la matriz.

Ejemplo conceptual:

{
  "fechaInicio": "2026-09-28",
  "fechaFin": "2026-10-11",
  "empleados": [
    {
      "empleadoId": 1,
      "nombre": "Aaron Arenas",
      "asistencias": [
        {
          "fecha": "2026-09-28",
          "estado": "ATIEMPO",
          "entrada": "08:00",
          "salida": "18:02",
          "minutosRetardo": 0,
          "origen": "BIOMETRICO",
          "modificadoManual": false
        }
      ]
    }
  ]
}

Para modificar administrativamente:

PUT /api/asistencia/{empleadoId}/{fecha}/estado

Body:

{
  "estado": "PERMISO",
  "observacion": "Permiso autorizado por encargado"
}

El backend deberá obtener el usuario autenticado automáticamente.

Nunca recibir desde el frontend el usuario que supuestamente realizó la modificación.

---

# 12. PREPARAR INTEGRACIÓN CON FA200

Actualmente NO tengo físicamente el dispositivo FA200.

Por lo tanto:

NO intentar conectarse todavía al dispositivo.

NO bloquear el desarrollo por no tener el equipo.

La aplicación debe quedar completamente funcional utilizando datos existentes, datos manuales y/o datos simulados según la arquitectura actual.

Diseñar la lógica utilizando una abstracción para el origen de las marcaciones.

Por ejemplo:

IAttendanceProvider

Y posteriormente poder implementar:

Fa200AttendanceProvider

De esta manera, cuando llegue físicamente el FA200, solamente deberá implementarse/probarse la comunicación con el dispositivo sin rediseñar el módulo completo.

---

# 13. REGLAS DE ESTADO

Preparar el sistema para calcular automáticamente estados utilizando el horario asignado al empleado.

Ejemplo:

Horario entrada:
08:00

Tolerancia:
10 minutos

Marcación:
08:05

Resultado:
A TIEMPO

Marcación:
08:14

Resultado:
RETARDO

Si el empleado tiene configurado descanso:

DESCANSO

Si tiene permiso/vacaciones:

PERMISO

Si terminó el periodo esperado de entrada y no existe ninguna marcación válida:

FALTA

Estas reglas deben estar en backend y no únicamente en frontend.

Si actualmente el proyecto ya cuenta con reglas de horarios/tolerancias, reutilizarlas.

---

# 14. NO CONFUNDIR MARCACIÓN CON ESTADO

Mantener separados conceptualmente:

MARCACIÓN:
Evento real de entrada/salida generado por un dispositivo.

ESTADO DE ASISTENCIA:
Resultado calculado para un empleado en determinada fecha.

Ejemplo:

Marcación:
08:14

Horario:
08:00

Tolerancia:
10 minutos

Estado:
RETARDO

Esto será importante cuando posteriormente se conecte el FA200.

---

# 15. RENDIMIENTO

La consulta debe obtener el periodo completo en una sola operación.

NO realizar una petición HTTP por:

- empleado
- día
- celda

Para 30 empleados y 14 días no quiero 420 peticiones.

Realizar una sola consulta al backend que devuelva toda la información necesaria para construir la matriz.

Optimizar también las consultas a base de datos evitando problemas N+1.

---

# 16. EXPERIENCIA VISUAL

Mantener el diseño actual del sistema.

La tabla debe sentirse como un calendario administrativo moderno.

Debe ser:

- Limpia.
- Compacta.
- Fácil de leer.
- Visual.
- Responsive.
- Con encabezados sticky.
- Con columna de empleado sticky.
- Con tooltips.
- Con estados fácilmente identificables.

No convertirla en una tabla tradicional saturada de texto.

Priorizar iconos y mostrar información detallada mediante tooltip/modal.

---

# 17. EXPORTACIÓN

Dejar preparada la opción para posteriormente agregar:

Exportar Excel
Exportar PDF

No es necesario implementarlo si el sistema actual todavía no tiene infraestructura para exportaciones.

---

# 18. CRITERIOS DE ACEPTACIÓN

El módulo se considera terminado cuando:

1. Aparece dentro del menú del sistema.
2. Permite seleccionar sucursal.
3. Muestra empleados de la sucursal.
4. Muestra correctamente 14 días en la vista de 2 semanas.
5. Agrupa correctamente los días por semana.
6. Permite navegar entre periodos.
7. Permite volver rápidamente a "Hoy".
8. Muestra A tiempo, Retardo, Falta, Descanso y Permiso.
9. Permite modificar manualmente estados cuando el usuario tenga permiso.
10. Registra auditoría de modificaciones.
11. Respeta roles y sucursales.
12. Funciona correctamente sin tener conectado todavía el FA200.
13. Está preparado para integrar el FA200 posteriormente.
14. Funciona correctamente en desktop, tablet y móvil.
15. No genera una petición HTTP por cada celda.
16. No rompe funcionalidades existentes.

---

# 19. FORMA DE TRABAJO

Antes de escribir código:

1. Analiza la arquitectura existente.
2. Identifica las entidades/tablas actuales relacionadas con empleados, sucursales, horarios, usuarios y asistencia.
3. Identifica los componentes del frontend que puedan reutilizarse.
4. Identifica el sistema actual de roles/permisos.
5. Determina qué piezas ya existen y cuáles realmente necesitan crearse.

Después presenta brevemente:

- Archivos que vas a modificar.
- Archivos nuevos que necesitas crear.
- Cambios de base de datos, si son necesarios.
- Endpoints que utilizarás.
- Componentes del frontend.
- Cómo quedará preparada la integración futura con FA200.

Después de ese análisis, implementa el módulo completo.

No reemplaces archivos completos innecesariamente.
No elimines código funcional.
No cambies arquitectura existente sin necesidad.
No agregues dependencias si el proyecto ya tiene una solución equivalente.
Mantén el código limpio, tipado y consistente con las convenciones actuales del proyecto.