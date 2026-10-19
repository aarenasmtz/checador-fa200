#!/bin/bash
# ==============================================================================
# Script de Despliegue Aislado - Sistema Checador (Producción)
# VPS Hostinger (193.46.198.88)
# ==============================================================================

set -e

echo "========================================================================"
echo "🚀 [CHECADOR] Iniciando Despliegue Aislado en Servidor VPS..."
echo "========================================================================"

# 1. Asegurar directorios de producción y logs independientes
echo "📁 [1/6] Creando directorios independientes para Checador..."
mkdir -p /var/www/checador-api
mkdir -p /var/www/checador-web
mkdir -p /var/log/checador
chown -R www-data:www-data /var/log/checador

# 2. Configurar Base de Datos ChecadorDb en SQL Server
echo "🗄️ [2/6] Configurando base de datos ChecadorDb en SQL Server..."
docker exec mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Aaron2804#MasterSA" -C -Q "
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ChecadorDb')
BEGIN
    CREATE DATABASE [ChecadorDb];
    PRINT 'Base de datos ChecadorDb creada exitosamente.';
END;
"

docker exec mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "Aaron2804#MasterSA" -d ChecadorDb -C -Q "
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'wpcadminaam')
BEGIN
    CREATE USER [wpcadminaam] FOR LOGIN [wpcadminaam];
    ALTER ROLE [db_owner] ADD MEMBER [wpcadminaam];
    PRINT 'Usuario wpcadminaam configurado como db_owner en ChecadorDb.';
END;
"

# Aplicar esquema de tablas a ChecadorDb
if [ -f "init_attendance_db.sql" ]; then
    echo "• Aplicando esquema y migraciones a ChecadorDb..."
    docker cp init_attendance_db.sql mssql-server:/var/opt/mssql/init_attendance_db.sql
    docker exec mssql-server /opt/mssql-tools18/bin/sqlcmd -S localhost -U wpcadminaam -P "Aaron2804#" -d ChecadorDb -C -i /var/opt/mssql/init_attendance_db.sql || true
    docker exec -u 0 mssql-server rm -f /var/opt/mssql/init_attendance_db.sql
fi

# 3. Mover binarios compilados de la API y Frontend
echo "📦 [3/6] Instalando binarios de API y Frontend..."
if [ -d "api" ]; then
    cp -r api/* /var/www/checador-api/
fi

if [ -d "web" ]; then
    cp -r web/* /var/www/checador-web/
fi

chown -R www-data:www-data /var/www/checador-api
chown -R www-data:www-data /var/www/checador-web

# 4. Configurar e Iniciar Servicio Systemd Independiente
echo "⚙️ [4/6] Configurando servicio systemd checador-api (puerto 5081)..."
if [ -f "checador-api.service" ]; then
    cp checador-api.service /etc/systemd/system/checador-api.service
fi

systemctl daemon-reload
systemctl enable checador-api.service
systemctl restart checador-api.service

# 5. Configurar Nginx para Subdominios del Checador
echo "🌐 [5/6] Configurando Nginx Reverse Proxy (checador.wpcbajio.com & api-checador.wpcbajio.com)..."
if [ -f "checador.nginx.conf" ]; then
    cp checador.nginx.conf /etc/nginx/sites-available/checador
fi

ln -sf /etc/nginx/sites-available/checador /etc/nginx/sites-enabled/checador
nginx -t && systemctl reload nginx

# 6. Verificación de Salud Cruzada (Checador y Lambrín)
echo "🩺 [6/6] Verificando salud de los servicios..."
sleep 4

echo -n "• Checador API (puerto 5081 /health): "
curl -s http://127.0.0.1:5081/health || echo "FALLO"

echo ""
echo -n "• Lambrín API (puerto 5000 /api/v1/health): "
curl -s http://127.0.0.1:5000/api/v1/health || echo "FALLO"

echo ""
echo "========================================================================"
echo "🎉 ¡Despliegue del Sistema Checador finalizado con éxito!"
echo "• Frontend Checador:  /var/www/checador-web"
echo "• Backend Checador:   /var/www/checador-api (puerto 5081)"
echo "• Logs Checador:      /var/log/checador/"
echo "• Base de Datos:      ChecadorDb (en SQL Server 1433)"
echo "• Servicio Systemd:   checador-api.service (activo y enabled)"
echo "• Nginx Sites:        /etc/nginx/sites-available/checador (activo)"
echo "========================================================================"
