#!/bin/bash
set -e

echo "1. Realizando backup de configuraciones Nginx y Systemd..."
mkdir -p /root/backups_pre_checador/nginx /root/backups_pre_checador/systemd
cp -r /etc/nginx/sites-available /root/backups_pre_checador/nginx/
cp -r /etc/nginx/sites-enabled /root/backups_pre_checador/nginx/
cp /etc/nginx/nginx.conf /root/backups_pre_checador/nginx/
cp /etc/systemd/system/pos-api.service /root/backups_pre_checador/systemd/

echo "2. Realizando backup de base de datos PosLambrinDb..."
docker exec mssql-server /opt/mssql-tools18/bin/sqlcmd \
    -S localhost \
    -U wpcadminaam \
    -P 'Aaron2804#' \
    -C \
    -Q "BACKUP DATABASE PosLambrinDb TO DISK = '/var/opt/mssql/data/PosLambrinDb_pre_checador.bak' WITH FORMAT, INIT;"

echo "3. Extrayendo archivo de backup al host..."
docker cp mssql-server:/var/opt/mssql/data/PosLambrinDb_pre_checador.bak /root/backups_pre_checador/PosLambrinDb_pre_checador.bak
docker exec mssql-server rm -f /var/opt/mssql/data/PosLambrinDb_pre_checador.bak

echo "4. Verificando respaldos en /root/backups_pre_checador/:"
ls -lh /root/backups_pre_checador/
ls -lh /root/backups_pre_checador/nginx/
ls -lh /root/backups_pre_checador/systemd/
echo "=== BACKUP PREVENTIVO FINALIZADO EXITOSAMENTE ==="
