# Manual de Despliegue en Producción (PR) — Sistema Checador
**Dominio:** `wpcbajio.com` | **Servidor VPS:** Hostinger (`193.46.198.88`)

---

## 1. Resumen Ejecutivo y Estado de Producción

El **Sistema Checador y Control de Asistencia Biométrico** ha sido desplegado exitosamente en el servidor de producción (PR) bajo un esquema de **Aislamiento Total** que coexiste armoniosamente con el sistema existente **Lambrín (POS WPC Bajío)** sin haber causado ninguna interrupción, modificación ni riesgo operativo sobre este último.

### Estado Actual de Servicios (Validado)
- **Lambrín POS API (`api.wpcbajio.com`):** `200 OK - Operativo` (Totalmente intacto)
- **Checador API (`5081`):** `200 OK - Healthy` (Activo y sirviendo peticiones)
- **Base de Datos `ChecadorDb`:** Creada e inicializada con datos semilla (usuarios, sucursales, roles)
- **Base de Datos `PosLambrinDb`:** 28 tablas preservadas al 100% (Respaldada en `/root/backups_pre_checador/`)
- **Nginx Reverse Proxy:** Sintaxis validada, subdominios configurados y activos para `checador.wpcbajio.com` y `api-checador.wpcbajio.com`

---

## 2. Matriz de Aislamiento Estricto de Infraestructura

| Componente | Sistema Existente (Lambrín) | Nuevo Sistema (Checador) | Aislamiento / Garantía |
| :--- | :--- | :--- | :--- |
| **Subdominios** | `wpcbajio.com`<br>`api.wpcbajio.com` | `checador.wpcbajio.com`<br>`api-checador.wpcbajio.com` | Virtual Hosts independientes en Nginx |
| **Directorio Web** | `/var/www/ecommerce`<br>(o app Lambrín) | `/var/www/checador-web/` | Carpetas físicas separadas con permisos `www-data` |
| **Directorio API** | `/var/www/pos-api/` | `/var/www/checador-api/` | Binarios independientes .NET 9 Release |
| **Puerto Kestrel** | `5000` | `5081` | Puertos TCP de loopback independientes |
| **Servicio Systemd** | `pos-api.service` | `checador-api.service` | Daemons aislados con reinicio automático |
| **Base de Datos** | `PosLambrinDb` | `ChecadorDb` | Catálogos de base de datos separados en MSSQL 1433 |
| **Archivos de Logs** | `/var/log/pos-api/` | `/var/log/checador/` | Directorio de logs rotativos dedicados |
| **CORS / Seguridad** | Orígenes Lambrín | Orígenes restringidos a `checador.wpcbajio.com` | Políticas CORS no cruzadas |

---

## 3. Respaldos Preventivos Realizados (Pre-Despliegue)

Antes de cualquier alteración en el VPS, se ejecutó una copia de seguridad forense almacenada en `/root/backups_pre_checador/`:
- **Base de datos Lambrín:** `/root/backups_pre_checador/PosLambrinDb_pre_checador.bak` (46 MB)
- **Configuración de Nginx:** `/root/backups_pre_checador/nginx/` (`sites-available`, `sites-enabled`, `nginx.conf`)
- **Servicios Systemd:** `/root/backups_pre_checador/systemd/pos-api.service`

---

## 4. Configuración de DNS en Cloudflare para `wpcbajio.com`

Para que el sistema responda en **`https://checador.wpcbajio.com`** y su API en **`https://api-checador.wpcbajio.com`**, agrega los siguientes 2 registros DNS en Cloudflare (en la zona de **`wpcbajio.com`**):

### Registros DNS Requeridos:

| Tipo | Nombre (Host) | Contenido (Destino IP) | Proxy Status (Nube) | TTL |
| :---: | :---: | :---: | :---: | :---: |
| **A** | `checador` | `193.46.198.88` | **Proxied (Nube Naranja 🟧)** | Auto |
| **A** | `api-checador` | `193.46.198.88` | **Proxied (Nube Naranja 🟧)** | Auto |

### Pasos en Cloudflare Dashboard:
1. Iniciar sesión en [dash.cloudflare.com](https://dash.cloudflare.com).
2. Seleccionar la zona **`wpcbajio.com`**.
3. Ir a **DNS** -> **Records**.
4. Clic en **Add record**:
   - **Type:** `A`
   - **Name:** `checador`
   - **IPv4 address:** `193.46.198.88`
   - **Proxy status:** Activo (Nube Naranja / Proxied)
   - Clic en **Save**.
5. Clic en **Add record**:
   - **Type:** `A`
   - **Name:** `api-checador`
   - **IPv4 address:** `193.46.198.88`
   - **Proxy status:** Activo (Nube Naranja / Proxied)
   - Clic en **Save**.

> [!NOTE]
> Una vez guardados los registros, la propagación tomará entre 1 a 5 minutos. Cloudflare proveerá automáticamente certificados SSL/TLS (HTTPS) para ambos subdominios.

---

## 5. URLs de Acceso en Producción

Una vez configurado Cloudflare, los accesos serán:
- **Plataforma Web (Frontend):** [https://checador.wpcbajio.com](https://checador.wpcbajio.com)
- **API Backend:** [https://api-checador.wpcbajio.com](https://api-checador.wpcbajio.com)
- **Swagger UI:** [https://api-checador.wpcbajio.com/swagger](https://api-checador.wpcbajio.com/swagger)
- **Health Check API:** [https://api-checador.wpcbajio.com/health](https://api-checador.wpcbajio.com/health)

### Credenciales Administrativas Iniciales:
- **Usuario:** `admin`
- **Contraseña:** `Admin123!`
- **Rol:** `SUPERADMIN` (Acceso total a todos los módulos: Asistencias, Empleados, Dispositivos, Simulador, Sucursales, Auditoría)

---

## 6. Manual de Operaciones y Mantenimiento

### Ver Estado del Servicio Checador:
```bash
systemctl status checador-api
```

### Reiniciar o Detener Checador (Sin Afectar Lambrín):
```bash
# Reiniciar API del Checador
systemctl restart checador-api

# Detener API del Checador
systemctl stop checador-api
```

### Inspeccionar Logs en Tiempo Real:
```bash
# Logs del servicio systemd
journalctl -u checador-api -f

# Logs del archivo de Serilog
tail -f /var/log/checador/attendance-api-*.txt
```

### Comprobación Rápida de Salud Interna:
```bash
/root/test_checador_api.sh
```

---

## 7. Procedimiento de Rollback (En caso de emergencia)

Si en algún momento se desea remover o suspender el Checador sin tocar Lambrín:
1. Detener y deshabilitar el servicio:
   ```bash
   systemctl stop checador-api
   systemctl disable checador-api
   ```
2. Desactivar el Virtual Host de Nginx:
   ```bash
   rm -f /etc/nginx/sites-enabled/checador
   nginx -t && systemctl reload nginx
   ```
*(La base de datos `ChecadorDb` y la de Lambrín `PosLambrinDb` permanecerán intactas).*

---

## 8. Limpieza de Datos de Prueba y Puesta en Marcha del Dispositivo FA200

Actualmente el sistema cuenta con datos de prueba generados por el inicializador (`DbSeeder`) para permitir la visualización de la matriz de asistencias, gráficas y simulador.

Cuando llegue el dispositivo biométrico físico **FA200**, puedes limpiar la base de datos de manera inmediata utilizando los scripts que dejamos listos en el servidor:

### Opción A: Limpiar Solo Asistencias (Recomendado si quieres conservar los empleados configurados)
Borra únicamente los marcajes, asistencias calculadas, incidencias y logs de auditoría de prueba:
```bash
ssh root@193.46.198.88 "/root/clean_attendance_test_data.sh"
```
*Conserva:* Empleados, Catálogos (Empresas, Sucursales, Departamentos, Puestos, Turnos) y Usuario Administrador.

### Opción B: Puesta a Cero Total (Para empezar 100% en blanco)
Borra asistencias, incidencias, los 50 empleados de prueba y los dispositivos simuladores:
```bash
ssh root@193.46.198.88 "/root/clean_all_test_data.sh"
```
*Conserva:* Catálogos base (Empresa, Sucursales, Departamentos, Puestos, Horarios) y Usuario Administrador `admin`.

### Pasos al recibir el FA200 Físico:
1. Conectar el FA200 a la red local (LAN) por cable de red Ethernet.
2. Asignarle una IP fija en el menú del biométrico (ej. `192.168.1.201`, puerto `4370`).
3. Ejecutar uno de los scripts de limpieza arriba indicados.
4. Ingresar al sistema web [https://checador.wpcbajio.com](https://checador.wpcbajio.com), ir a **Dispositivos** y registrar el dispositivo FA200 con su IP real y sucursal asignada.
5. Empezar a enrolar rostros/huellas y checar en tiempo real.

