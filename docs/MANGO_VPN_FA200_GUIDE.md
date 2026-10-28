# Manual de Conexión e Instalación: Checador FA200 + Router GL.iNet GL-MT300N-V2 (Mango)
**Proyecto:** CHECADOR FA200 | **Restaurantes Bai Fen Bai (David Guan)**  
**Servidor VPS:** Hostinger (`193.46.198.88`) | **Protocolo VPN:** WireGuard

---

## 1. Resumen de la Solución y Arquitectura

El router compacto **GL.iNet GL-MT300N-V2 (Mango)** elimina por completo la necesidad de mantener una computadora encendida en cada restaurante.

```
                    SUCURSAL (RESTAURANTE)                                             NUBE (HOSTINGER VPS)
┌──────────────────┐           ┌────────────────────────┐                   ┌─────────────────────────────────┐
│  Checador FA200  │  Ethernet │ Router GL.iNet Mango   │   Internet WAN    │ Servidor Linux (193.46.198.88)  │
│  (Cara y Huella) │ ────────> │ (GL-MT300N-V2)         │ ────────────────> │                                 │
│  IP: 10.10.1.10  │  Puerto   │ WAN: DHCP del Módem    │   Túnel Privado   │ • WireGuard wg0 (10.10.0.1)     │
│  Puerto: 4370    │   LAN     │ LAN: 10.10.1.1         │     WireGuard     │ • Servicio Lector Multidispositivo│
│  Gateway: Mango  │           │ VPN IP: 10.10.0.2      │   (Puerto 51820)  │ • Backend API (.NET 9)          │
└──────────────────┘           └────────────────────────┘                   │ • Portal Web (React 19)         │
                                                                            └─────────────────────────────────┘
```

### Principios de Seguridad y Aislamiento:
1. **Puerto FA200 protegido:** El puerto 4370 del FA200 nunca se expone a internet. Solo es alcanzable por la IP privada del túnel WireGuard (`10.10.0.1`).
2. **Aislamiento entre sucursales:** El servidor bloquea el tráfico directo entre sucursales (`10.10.1.0/24` hacia `10.10.2.0/24`). Cada sucursal solo se comunica con el servidor central.
3. **Túnel dividido (Split Tunnel):** El router Mango únicamente envía por la VPN el tráfico destinado a la red `10.10.0.0/16`. Cualquier otro tráfico del restaurante continúa saliendo de manera directa por el módem local.
4. **Lectura no destructiva:** El servicio centralizado descarga las checadas y las confirma con hash SHA-256. Jamás borra registros del reloj ni altera su fecha y hora.

---

## 2. Plan Maestro de Direccionamiento de Red (Anti-Colisión)

Para evitar colisiones entre el módem del restaurante (que comúnmente usa `192.168.1.0/24` o `192.168.100.0/24`), la red LAN por defecto del Mango (`192.168.8.0/24`) y las demás sucursales, se implementa el siguiente esquema:

| Sucursal | Subred LAN Mango | IP LAN Mango (Gateway) | IP Estática FA200 | IP Túnel WireGuard | Puerto FA200 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Servidor VPS** | N/A | N/A | N/A | **`10.10.0.1/24`** | UDP 51820 |
| **Sucursal 1 (Centro)** | `10.10.1.0/24` | `10.10.1.1` | **`10.10.1.10`** | `10.10.0.2/32` | TCP 4370 |
| **Sucursal 2 (Norte)** | `10.10.2.0/24` | `10.10.2.1` | **`10.10.2.10`** | `10.10.0.3/32` | TCP 4370 |
| **Sucursal 3 (Plaza Mayor)**| `10.10.3.0/24` | `10.10.3.1` | **`10.10.3.10`** | `10.10.0.4/32` | TCP 4370 |
| **Sucursal 4 (Sur)** | `10.10.4.0/24` | `10.10.4.1` | **`10.10.4.10`** | `10.10.0.5/32` | TCP 4370 |

---

## 3. Conexión Física del Hardware en Sucursal

### Requisitos de Hardware:
- 1 Router **GL.iNet GL-MT300N-V2 (Mango)** con su cable Micro-USB y adaptador 5V / 2A.
- 1 Reloj Checador **FA200** con su adaptador de corriente 12V / 1.5A.
- 2 Cables de red Ethernet (Cat 5e o Cat 6).
- 1 Enchufe eléctrico doble (o multicontacto con supresor de picos).

### Conexiones Paso a Paso:
1. **Alimentación Eléctrica:**
   - Conecta el adaptador original de 12V al checador FA200.
   - Conecta el adaptador original de 5V al router Mango mediante el puerto Micro-USB (marcado como `Power`).
   - *Nota:* Cada dispositivo debe usar su propio adaptador eléctrico certificado.
2. **Conexión WAN (Internet):**
   - Conecta un cable Ethernet desde cualquier puerto LAN del módem del restaurante hacia el **puerto WAN** del Mango.
3. **Conexión LAN (Checador):**
   - Conecta el segundo cable Ethernet desde el **puerto LAN** del Mango hacia el puerto Ethernet del checador FA200.

---

## 4. Configuración del Router GL.iNet Mango

### Paso 4.1: Acceso Inicial
1. Conecta tu computadora a la red Wi-Fi del Mango (nombre similar a `GL-MT300N-V2-xxx`, contraseña por defecto escrita en la etiqueta trasera: `goodlife`) o por cable al puerto LAN.
2. Abre un navegador web e ingresa a: **`http://192.168.8.1`**
3. Selecciona el idioma (Español o Inglés).
4. **Seguridad Obligatoria:** Asigna una contraseña de administración robusta (mínimo 10 caracteres con letras, números y símbolos).

### Paso 4.2: Cambiar la Subred LAN del Mango
Para evitar conflictos con el módem y asignar la subred única de la sucursal:
1. En el panel lateral, ve a: **Network** -> **LAN**.
2. Modifica la **IP Address**:
   - Para Sucursal 1 (Centro): `10.10.1.1`
   - Para Sucursal 2 (Norte): `10.10.2.1`
3. Netmask: `255.255.255.0`
4. Clic en **Apply**. El router reiniciará su servicio DHCP.
5. Vuelve a ingresar al panel ahora en: **`http://10.10.1.1`**

### Paso 4.3: Habilitar Reenvío de Tráfico VPN hacia la LAN
1. Ve a **Network** -> **Firewall** (o Advanced Settings / LuCI -> Network -> Firewall).
2. Asegúrate de que la zona `WireGuard` permita el reenvío de tráfico hacia la zona `LAN` (`Allow forward to destination zones: LAN`).

### Paso 4.4: Configurar e Importar el Cliente WireGuard
1. En el menú lateral del Mango, ve a **VPN** -> **WireGuard Client**.
2. Clic en **Set Up WireGuard Manually** -> **Add New**.
3. Rellena los datos o copia el contenido de [mango-client-sucursal1.conf.example](file:///d:/Proyecto%20-%20Checador/scripts/deployment/wireguard/mango-client-sucursal1.conf.example):
   - **Name:** `VPN-BaiFenBai-Centro`
   - **Address:** `10.10.0.2/32`
   - **Private Key:** *(Generada en el Mango o provista de forma segura)*
   - **Public Key del Servidor:** *(Clave pública generada en el VPS)*
   - **Endpoint:** `193.46.198.88:51820`
   - **Allowed IPs:** `10.10.0.0/16`
   - **Persistent Keepalive:** `25`
4. Guarda y activa el túnel haciendo clic en **Connect**.
5. Debe mostrarse el punto en verde indicando que el enlace está establecido y con transferencia de bytes.

---

## 5. Configuración del Reloj Checador FA200

En la pantalla táctil o menú del reloj FA200:
1. Presiona la tecla **Menu / M/OK** e ingresa al menú con la huella o clave de administrador.
2. Ve a **Comunicaciones** -> **Red** (o Ethernet):
   - **DHCP:** `Desactivado` (Apagar DHCP)
   - **Dirección IP:** `10.10.1.10`
   - **Máscara de Subred:** `255.255.255.0`
   - **Puerta de Enlace (Gateway):** `10.10.1.1` (La IP LAN del Mango)
   - **DNS:** `1.1.1.1`
3. Ve a **Comunicaciones** -> **Ajustes de PC** (o Seguridad de Red):
   - **Clave de Comunicación (CommKey):** `0`
   - **Puerto TCP:** `4370`
4. Guarda y reinicia el checador FA200 para aplicar la IP estática.

---

## 6. Verificación de Conectividad desde el Servidor

Desde una terminal en el servidor VPS (`193.46.198.88`), ejecuta:

### 1. Comprobar que el Mango responde al ping dentro del túnel:
```bash
ping -c 3 10.10.0.2
```

### 2. Comprobar que el checador FA200 responde al ping a través del Mango:
```bash
ping -c 3 10.10.1.10
```

### 3. Verificar que el puerto biométrico 4370 del FA200 está abierto:
```bash
nc -zvw3 10.10.1.10 4370
```
*Respuesta esperada:* `Connection to 10.10.1.10 4370 port [tcp/*] succeeded!`

### 4. Prueba real de lectura biométrica en modo Solo-Lectura:
```bash
python3 scripts/test_fa200_readonly.py
```
*Debe reportar el número de serie, firmware y total de checadas sin modificar nada en el reloj.*

---

## 7. Registro en el Portal Web de Checador

1. Ingresa a **[https://checador.wpcbajio.com](https://checador.wpcbajio.com)** con tus credenciales.
2. Ve a la sección **Dispositivos** (`/devices`).
3. Clic en **"+ Registrar Checador VPN"**:
   - **Sucursal:** Selecciona `Sucursal Centro` (o la que corresponda).
   - **Código:** `FA200-CENTRO-01`
   - **Nombre:** `Reloj Entrada Principal - Bai Fen Bai Centro`
   - **Modo:** `Túnel VPN (Mango)`
   - **IP Privada FA200:** `10.10.1.10`
   - **Puerto TCP:** `4370`
   - **Subred Mango:** `10.10.1.0/24`
   - **IP Túnel WireGuard:** `10.10.0.2`
   - **Zona Horaria:** `America/Mexico_City`
   - **Intervalo de Sondeo:** `30` segundos.
4. Clic en **"Probar comunicación"**: El sistema abrirá un socket TCP de 3.5 segundos hacia `10.10.1.10:4370` y mostrará la latencia en milisegundos y el estado `En Línea / Listo`.
5. Clic en **"Sincronizar ahora"**: El servicio consultará el reloj, registrará las marcas pendientes con deduplicación SHA-256 y actualizará el contador de registros nuevos.

---

## 8. Procedimiento de Revocación de un Router Mango

Si un router Mango es extraviado, reemplazado o se desactiva una sucursal:
1. En el servidor VPS, edita `/etc/wireguard/wg0.conf`:
   - Elimina o comenta el bloque `[Peer]` correspondiente a esa sucursal.
2. Aplica los cambios en caliente sin reiniciar WireGuard:
   ```bash
   wg syncconf wg0 <(wg-quick strip wg0)
   ```
3. El router revocado perderá inmediatamente el acceso al túnel sin afectar a las demás sucursales.

---

## 9. Diagnóstico y Resolución de Problemas

| Síntoma | Causa Posible | Solución |
| :--- | :--- | :--- |
| **Punto WireGuard en Mango apagado (amarillo o gris)** | El módem de la sucursal no tiene salida a internet o bloquea paquetes UDP salientes. | Verifica que el puerto WAN del Mango tenga IP pública/local asignada por el módem. Revisa el cable WAN. |
| **Túnel VPN conectado pero `nc -zvw3 10.10.1.10 4370` da timeout** | El checador FA200 no tiene como Gateway la IP del Mango (`10.10.1.1`). | Revisa la configuración de red en el menú del FA200. La puerta de enlace debe ser exactamente `10.10.1.1`. |
| **El checador responde intermitentemente** | Conflicto de IP o adaptador de corriente insuficiente. | Asegúrate de usar los adaptadores de corriente originales provistos con cada equipo (5V/2A para Mango y 12V/1.5A para FA200). |
| **El portal muestra "Error de comunicación"** | Cable Ethernet desconectado entre Mango y FA200 o equipo apagado. | Clic en "Probar comunicación". El mensaje detallará si falló el handshake VPN o el socket TCP del equipo. |
