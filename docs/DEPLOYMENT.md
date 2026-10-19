# Guía de Despliegue en Producción y VPS (Production Deployment Guide)
## 华龙商业集团 · FA200 考勤与门禁控制平台

---

## 1. Arquitectura de Despliegue en VPS (VPS Architecture)

El despliegue corporativo en un servidor virtual privado (VPS Linux Ubuntu 22.04 / 24.04 LTS o Windows Server 2022) se estructura en 4 capas desacopladas:

```
[ Internet / Sucursales ]
          │
          ▼ (HTTPS 443 / SSL Let's Encrypt)
┌─────────────────────────────────────────────────────────────┐
│ Nginx Reverse Proxy (Balanceador, Gzip, SSL, Rate Limiting) │
└──────┬──────────────────────────────────────────────┬───────┘
       │ :8080 (Proxy Pass)                           │ :80 (Estáticos SPA)
       ▼                                              ▼
┌───────────────────────────────┐              ┌─────────────────────────────┐
│ Attendance.Api (.NET 9 Kestrel)│             │ React 19 Frontend (Vite)    │
│ Systemd: attendance-api       │              │ /var/www/attendance-web     │
└──────────────┬────────────────┘              └─────────────────────────────┘
               │
               ├──────────────────────────────┐
               ▼                              ▼
┌───────────────────────────────┐      ┌─────────────────────────────┐
│ Attendance.Worker (.NET 9)     │      │ Microsoft SQL Server 2022   │
│ Systemd: attendance-worker    │      │ Base de datos: AttendanceDb │
└───────────────────────────────┘      └─────────────────────────────┘
```

---

## 2. Requisitos Mínimos del Servidor VPS (Hardware Specs)

- **Sistema Operativo:** Ubuntu 24.04 LTS (Recomendado) o Debian 12
- **CPU:** 4 vCPU (x86_64)
- **Memoria RAM:** 8 GB RAM (Mínimo 4 GB para SQL Server + .NET 9)
- **Disco:** 80 GB SSD NVMe (con backups configurados)
- **Red:** Dirección IP Pública Estática con puertos abiertos `80` (HTTP), `443` (HTTPS), y opcionalmente puerto VPN `51820` (WireGuard).

---

## 3. Instalación de Dependencias en Ubuntu (Paso a Paso)

### 3.1 Instalar .NET 9 Runtime
```bash
# Agregar repositorio oficial de Microsoft
sudo add-apt-repository ppa:dotnet/backports
sudo apt-get update
sudo apt-get install -y dotnet-sdk-9.0 aspnetcore-runtime-9.0
```

### 3.2 Instalar Nginx y Certbot para Certificados SSL Gratuitos
```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

---

## 4. Configuración de Systemd para Servicios Backend

### 4.1 Servicio Web API (`/etc/systemd/system/attendance-api.service`)
```ini
[Unit]
Description=Attendance API .NET 9 Service
After=network.target

[Service]
WorkingDirectory=/var/www/attendance-api
ExecStart=/usr/bin/dotnet /var/www/attendance-api/Attendance.Api.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=attendance-api
User=www-data
Environment=ASPNETCORE_ENVIRONMENT=Production
Environment=DOTNET_PRINT_TELEMETRY_MESSAGE=false
Environment=ASPNETCORE_URLS=http://127.0.0.1:5081

[Install]
WantedBy=multi-user.target
```

### 4.2 Servicio Background Worker (`/etc/systemd/system/attendance-worker.service`)
```ini
[Unit]
Description=Attendance Background Worker Service
After=network.target attendance-api.service

[Service]
WorkingDirectory=/var/www/attendance-worker
ExecStart=/usr/bin/dotnet /var/www/attendance-worker/Attendance.Worker.dll
Restart=always
RestartSec=10
KillSignal=SIGINT
SyslogIdentifier=attendance-worker
User=www-data
Environment=DOTNET_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
```

### Activar e iniciar los servicios:
```bash
sudo systemctl daemon-reload
sudo systemctl enable attendance-api attendance-worker
sudo systemctl start attendance-api attendance-worker
```

---

## 5. Configuración de Nginx con SSL y Proxy Inverso

Crear archivo `/etc/nginx/sites-available/checador.hualong.com`:

```nginx
server {
    listen 80;
    server_name checador.hualong.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name checador.hualong.com;

    # SSL Let's Encrypt
    ssl_certificate /etc/letsencrypt/live/checador.hualong.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/checador.hualong.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend SPA (React 19)
    root /var/www/attendance-web;
    index index.html;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy pass a Kestrel
    location /api/ {
        proxy_pass http://127.0.0.1:5081/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection keep-alive;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 20M;
    }

    # Health Check
    location /health {
        proxy_pass http://127.0.0.1:5081/health;
    }
}
```

Habilitar sitio y recargar Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/checador.hualong.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 6. Automatización de Copias de Seguridad (Backups)

Configurar un cron diario a las 02:00 AM para respaldo de la base de datos `AttendanceDb`:

```bash
# Crear script /opt/scripts/backup-db.sh
cat << 'EOF' > /opt/scripts/backup-db.sh
#!/bin/bash
BACKUP_DIR="/var/backups/sqlserver"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p $BACKUP_DIR

sqlcmd -S localhost -U sa -P 'TuPasswordSeguro123!' -Q "BACKUP DATABASE [AttendanceDb] TO DISK = N'$BACKUP_DIR/AttendanceDb_$TIMESTAMP.bak' WITH NOFORMAT, NOINIT, SKIP, NOREWIND, NOUNLOAD, STATS = 10"

# Eliminar respaldos mayores a 30 días
find $BACKUP_DIR -type f -name "*.bak" -mtime +30 -delete
EOF

chmod +x /opt/scripts/backup-db.sh

# Agregar al cron
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/scripts/backup-db.sh >> /var/log/backup-db.log 2>&1") | crontab -
```

---

## 7. Opciones de Conectividad para Dispositivos FA200 Remotos

Cuando lleguen los checadores físicos a cada una de las 4 sucursales:

1. **Opción A (Recomendada - Cloud ADMS PUSH):**  
   Si el firmware del FA200 soporta "Servidor de Nube / ADMS", configure la URL pública `https://checador.hualong.com/api/devices/adms` en el menú del checador. El dispositivo enviará las checadas hacia el VPS sin necesidad de abrir puertos en la sucursal.
2. **Opción B (VPN WireGuard):**  
   Si el FA200 solo soporta pull local (UDP 4370), instale un router con WireGuard o una mini-PC/Raspberry Pi como gateway en la sucursal para enlazar la LAN de la sucursal con el VPS mediante un túnel encriptado seguro.
3. **Opción C (IP Estática e IP Whitelisting):**  
   Si la sucursal dispone de IP pública fija, configure un reenvío de puertos (Port Forwarding) en el router local y aplique reglas en el firewall del VPS (`ufw allow from [IP_SUCURSAL] to any port 4370`).
