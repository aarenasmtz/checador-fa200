#!/bin/bash
# ==============================================================================
# Script de Puesta en Marcha en VPS - Sistema de Control de Asistencia y Biométrico
# 华龙商业集团 (Grupo Comercial Hualong)
# ==============================================================================

set -e

echo "========================================================================"
echo "🚀 Iniciando Despliegue de Control de Asistencia en el Servidor VPS..."
echo "========================================================================"

# 1. Asegurar directorios de producción
echo "📁 [1/5] Creando carpetas de aplicación en /var/www..."
mkdir -p /var/www/attendance-api
mkdir -p /var/www/attendance-web

# 2. Configurar Base de Datos en SQL Server
echo "🗄️ [2/5] Configurando base de datos AttendanceDb en SQL Server..."

# Si SQL Server corre en contenedor Docker (como en WPC Bajío):
if docker ps | grep -q mssql-server; then
    echo "• Detectado contenedor mssql-server en ejecución."
    docker exec -i mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Aaron2804#MasterSA" -C -Q "
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'AttendanceDb')
    BEGIN
        CREATE DATABASE [AttendanceDb];
        PRINT 'Base de datos AttendanceDb creada.';
    END;
    IF EXISTS (SELECT name FROM sys.server_principals WHERE name = N'wpcadminaam')
    BEGIN
        ALTER SERVER ROLE [sysadmin] ADD MEMBER [wpcadminaam];
    END;
    " || true

    # Si existe el script SQL de inicialización, aplicarlo:
    if [ -f "init_attendance_db.sql" ]; then
        echo "• Aplicando esquema completo de tablas a AttendanceDb..."
        docker cp init_attendance_db.sql mssql-server:/tmp/init_attendance_db.sql
        docker exec -i mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U wpcadminaam -P "Aaron2804#" -d AttendanceDb -C -i /tmp/init_attendance_db.sql || true
    fi
else
    # Si SQL Server corre nativamente en Linux o Windows:
    echo "• SQL Server corriendo en host local o externo."
fi

# 3. Mover binarios si se desempaquetaron en la carpeta actual
if [ -d "api" ]; then
    echo "📦 Copiando binarios de API a /var/www/attendance-api..."
    cp -r api/* /var/www/attendance-api/
fi

if [ -d "web" ]; then
    echo "🌐 Copiando archivos del Frontend a /var/www/attendance-web..."
    cp -r web/* /var/www/attendance-web/
fi

# Ajustar permisos
chown -R www-data:www-data /var/www/attendance-api
chown -R www-data:www-data /var/www/attendance-web

# 4. Configurar e Iniciar Servicio Systemd
echo "⚙️ [3/5] Configurando servicio systemd attendance-api..."
if [ -f "attendance-api.service" ]; then
    cp attendance-api.service /etc/systemd/system/attendance-api.service
elif [ -f "scripts/deployment/attendance-api.service" ]; then
    cp scripts/deployment/attendance-api.service /etc/systemd/system/attendance-api.service
fi

systemctl daemon-reload
systemctl enable attendance-api.service
systemctl restart attendance-api.service

# 5. Configurar Nginx
echo "🌐 [4/5] Configurando Nginx Reverse Proxy..."
if [ -f "attendance.nginx.conf" ]; then
    cp attendance.nginx.conf /etc/nginx/sites-available/attendance
elif [ -f "scripts/deployment/attendance.nginx.conf" ]; then
    cp scripts/deployment/attendance.nginx.conf /etc/nginx/sites-available/attendance
fi

if [ -f "/etc/nginx/sites-available/attendance" ]; then
    ln -sf /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/attendance
    nginx -t && systemctl reload nginx
fi

# 6. Verificación de Salud
echo "🩺 [5/5] Verificando salud del servicio..."
sleep 3
if curl -s http://127.0.0.1:5081/health | grep -q "Healthy"; then
    echo "✅ API responde exitosamente: Healthy"
else
    echo "⚠️ Esperando arranque del servicio... comprobando status:"
    systemctl status attendance-api.service --no-pager -l || true
fi

echo "========================================================================"
echo "🎉 ¡Despliegue de Control de Asistencia completado!"
echo "• API Backend: http://127.0.0.1:5081 (gestionado por attendance-api.service)"
echo "• Swagger UI:  http://<IP_VPS>/swagger"
echo "• Portal Web:  http://<IP_VPS>/"
echo "========================================================================"
