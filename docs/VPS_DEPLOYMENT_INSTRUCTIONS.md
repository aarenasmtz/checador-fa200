# 🚀 Despliegue en VPS - Sistema de Control de Asistencia y Biométrico
## 华龙商业集团 (Grupo Comercial Hualong)

Siguiendo la arquitectura y configuración probada en **WPC Bajío**, hemos generado el paquete completo de despliegue `dist_vps.tar.gz` (45.88 MB) que contiene:
- **Backend API:** Compilada en .NET 9 Release con `appsettings.Production.json`.
- **Frontend SPA:** Compilado con React 19 + Vite + Tailwind CSS v4 en `/web`.
- **Base de Datos:** Script SQL completo `init_attendance_db.sql` para `AttendanceDb`.
- **Servicio Systemd:** `attendance-api.service` para arranque continuo en background.
- **Reverse Proxy:** `attendance.nginx.conf` para Nginx en el puerto 80/443.
- **Script Instalador:** `setup_vps_attendance.sh` para ejecución en 1 solo comando.

---

### 📋 Credenciales Configuradas para el VPS

- **Base de Datos:** `AttendanceDb`
- **Usuario SQL Server:** `wpcadminaam`
- **Contraseña SQL:** `Aaron2804#`
- **Puerto Interno API Kestrel:** `5081` (`http://127.0.0.1:5081`)
- **Puerto Nginx:** `80` (proxy a `/api/` y estáticos en `/`)

---

### 🛠️ Pasos para Subir y Poner en Marcha en el VPS

#### Paso 1: Subir el Paquete al VPS vía SCP

Abre tu terminal de PowerShell en `D:\Proyecto - Checador` y ejecuta:

```powershell
scp dist_vps.tar.gz root@<TU_IP_VPS>:/root/
```
*(Reemplaza `<TU_IP_VPS>` por la IP pública de tu VPS)*

---

#### Paso 2: Conectar al VPS por SSH y Ejecutar el Instalador

Ejecuta el siguiente comando para descomprimir y configurar todo automáticamente:

```powershell
ssh root@<TU_IP_VPS> "mkdir -p /root/attendance_deploy && tar -xzf /root/dist_vps.tar.gz -C /root/attendance_deploy && cd /root/attendance_deploy && chmod +x setup_vps_attendance.sh && ./setup_vps_attendance.sh"
```

El script automatizado:
1. Crea la base de datos `AttendanceDb` en SQL Server y le otorga permisos al usuario `wpcadminaam`.
2. Aplica las tablas e índices si no existen.
3. Copia la API a `/var/www/attendance-api`.
4. Copia el Frontend a `/var/www/attendance-web`.
5. Activa e inicia el servicio `attendance-api.service`.
6. Configura y recarga Nginx.
7. Comprueba la salud del endpoint `/health`.

---

#### Paso 3: Verificación Inmediata en el VPS

Una vez finalizado, puedes verificar:

1. **Salud de la API:**
   ```bash
   curl http://127.0.0.1:5081/health
   # Respuesta esperada: Healthy
   ```

2. **Estado del Servicio:**
   ```bash
   systemctl status attendance-api.service
   ```

3. **Ver en el Navegador:**
   - **Frontend Web:** `http://<TU_IP_VPS>/`
   - **Swagger API:** `http://<TU_IP_VPS>/swagger`
   - **Login inicial:** `admin` / `Admin123!`

---

#### 🔄 Para Futuras Actualizaciones

Cada vez que hagas cambios en el código y quieras volver a compilar y empaquetar para el VPS, simplemente ejecuta:

```powershell
.\scripts\deployment\deploy_to_vps.ps1
```
y repite los comandos `scp` y `ssh` anteriores.
