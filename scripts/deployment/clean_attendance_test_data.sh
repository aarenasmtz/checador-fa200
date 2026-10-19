#!/bin/bash
# ==============================================================================
# Script de Limpieza de Asistencias de Prueba — Sistema Checador
# Borra únicamente los registros de asistencias, checadas e incidencias de prueba.
# CONSERVA: Empleados, Catálogos, Sucursales, Turnos y Usuarios Administradores.
# ==============================================================================

set -e

echo "========================================================================"
echo "🧹 [CHECADOR] Limpiando asistencias, checadas e incidencias de prueba..."
echo "========================================================================"

docker exec mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U wpcadminaam -P "Aaron2804#" -d ChecadorDb -C -Q "
BEGIN TRANSACTION;
PRINT 'Borrando eventos biométricos de prueba...';
DELETE FROM [BiometricEvents];

PRINT 'Borrando incidencias y justificaciones...';
DELETE FROM [AttendanceIncidents];

PRINT 'Borrando solicitudes de permisos/vacaciones...';
DELETE FROM [LeaveRequests];

PRINT 'Borrando cálculo diario de asistencias (AttendanceDailies)...';
DELETE FROM [AttendanceDailies];

PRINT 'Limpiando logs de auditoría de prueba...';
DELETE FROM [AuditLogs];

COMMIT TRANSACTION;
PRINT '¡Limpieza de asistencias completada con éxito!';
"

echo "========================================================================"
echo "✅ Las asistencias y checadas simuladas han sido eliminadas."
echo "   Tus empleados, sucursales y turnos se mantienen intactos."
echo "   El sistema está listo para registrar checadas en tiempo real."
echo "========================================================================"
