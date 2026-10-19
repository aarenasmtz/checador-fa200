#!/bin/bash
# ==============================================================================
# Script de Puesta a Cero de Producción (Reset Total de Pruebas) — Sistema Checador
# Borra asistencias, empleados ficticios y dispositivos virtuales de prueba.
# CONSERVA: Catálogos base (Empresa, Sucursales, Departamentos, Puestos, Turnos, Horarios)
#           y Usuarios del Sistema (admin, roles y permisos).
# ==============================================================================

set -e

echo "========================================================================"
echo "🧹 [CHECADOR] Reset Total de Pruebas: Asistencias, Empleados y Dispositivos..."
echo "========================================================================"

docker exec mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U wpcadminaam -P "Aaron2804#" -d ChecadorDb -C -Q "
BEGIN TRANSACTION;
PRINT '1. Borrando eventos biométricos...';
DELETE FROM [BiometricEvents];

PRINT '2. Borrando incidencias y justificaciones...';
DELETE FROM [AttendanceIncidents];

PRINT '3. Borrando permisos y vacaciones...';
DELETE FROM [LeaveRequests];

PRINT '4. Borrando asistencias diarias...';
DELETE FROM [AttendanceDailies];

PRINT '5. Desvinculando horarios de empleados...';
DELETE FROM [EmployeeSchedules];

PRINT '6. Borrando empleados de prueba...';
DELETE FROM [Employees];

PRINT '7. Borrando dispositivos virtuales de prueba...';
DELETE FROM [BiometricDevices];

PRINT '8. Limpiando auditoría...';
DELETE FROM [AuditLogs];

COMMIT TRANSACTION;
PRINT '¡Puesta a cero completada con éxito!';
"

echo "========================================================================"
echo "✅ Sistema puesto a cero para Producción Real."
echo "   - Se conservaron: Empresa, Sucursales, Departamentos, Puestos, Turnos y Usuario Admin."
echo "   - Ahora puedes dar de alta a tus empleados reales y vincular el dispositivo FA200."
echo "========================================================================"
