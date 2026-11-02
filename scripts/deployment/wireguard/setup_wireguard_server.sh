#!/bin/bash
# ==============================================================================
# SCRIPT DE INSTALACIÓN Y PUESTA EN MARCHA DE WIREGUARD EN EL SERVIDOR VPS
# Servidor: VPS Hostinger Ubuntu (193.46.198.88)
# Red de Tránsito VPN: 10.10.0.0/24
# Puerto UDP: 51820
# ==============================================================================

set -e

if [ "$EUID" -ne 0 ]; then
  echo "❌ Este script debe ejecutarse como root."
  exit 1
fi

echo "========================================================================"
echo "🛡️ Configurando WireGuard VPN Server para Checador FA200 + Mango"
echo "========================================================================"

# 1. Instalar WireGuard y herramientas de red
echo "📦 [1/5] Instalando paquetes de WireGuard..."
apt-get update -qq
apt-get install -y -qq wireguard iptables iproute2

# 2. Habilitar Reenvío de Paquetes IPv4 (IP Forwarding)
echo "🌐 [2/5] Habilitando enrutamiento de paquetes IPv4..."
cat << 'EOF' > /etc/sysctl.d/99-wireguard-checador.conf
net.ipv4.ip_forward = 1
EOF
sysctl -p /etc/sysctl.d/99-wireguard-checador.conf > /dev/null

# Abrir puerto en UFW si está activo
if which ufw >/dev/null 2>&1; then
    echo "🛡️ Configurando regla en UFW para UDP 51820..."
    ufw allow 51820/udp comment 'WireGuard VPN Checador' > /dev/null 2>&1 || true
fi

# 3. Directorio de configuración y claves
echo "🔑 [3/5] Comprobando claves criptográficas de WireGuard..."
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [ ! -f /etc/wireguard/server_private.key ]; then
    wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
    chmod 600 /etc/wireguard/server_private.key
    chmod 644 /etc/wireguard/server_public.key
    echo "• Claves del servidor generadas exitosamente."
else
    echo "• Claves del servidor existentes detectadas."
fi

SERVER_PRIVKEY=$(cat /etc/wireguard/server_private.key)
SERVER_PUBKEY=$(cat /etc/wireguard/server_public.key)

# Generar claves para el Mango de Sucursal 1 (Casa) si no existen
if [ ! -f /etc/wireguard/mango1_private.key ]; then
    wg genkey | tee /etc/wireguard/mango1_private.key | wg pubkey > /etc/wireguard/mango1_public.key
    chmod 600 /etc/wireguard/mango1_private.key
    chmod 644 /etc/wireguard/mango1_public.key
    echo "• Claves del cliente Mango Sucursal 1 generadas exitosamente."
else
    echo "• Claves del cliente Mango Sucursal 1 ya existían."
fi

MANGO1_PRIVKEY=$(cat /etc/wireguard/mango1_private.key)
MANGO1_PUBKEY=$(cat /etc/wireguard/mango1_public.key)

# 4. Crear configuración wg0.conf
echo "⚙️ [4/5] Configurando /etc/wireguard/wg0.conf..."
cat << EOF > /etc/wireguard/wg0.conf
[Interface]
Address = 10.10.0.1/24
ListenPort = 51820
PrivateKey = ${SERVER_PRIVKEY}

# Enrutamiento y políticas de seguridad
PostUp = iptables -A FORWARD -i wg0 -o wg0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostUp = iptables -A FORWARD -s 10.10.0.1/32 -d 10.10.0.0/16 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -o wg0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostDown = iptables -D FORWARD -s 10.10.0.1/32 -d 10.10.0.0/16 -j ACCEPT

# Peer 1: Sucursal 1 (Mango Casa / Centro)
[Peer]
PublicKey = ${MANGO1_PUBKEY}
AllowedIPs = 10.10.0.2/32, 10.10.1.0/24
EOF
chmod 600 /etc/wireguard/wg0.conf

# Crear archivo de perfil para importar en el router Mango
cat << EOF > /etc/wireguard/mango_sucursal1.conf
[Interface]
Address = 10.10.0.2/32
PrivateKey = ${MANGO1_PRIVKEY}

[Peer]
PublicKey = ${SERVER_PUBKEY}
Endpoint = 193.46.198.88:51820
AllowedIPs = 10.10.0.1/32, 10.10.0.0/24
PersistentKeepalive = 25
EOF
chmod 600 /etc/wireguard/mango_sucursal1.conf

# 5. Iniciar y habilitar servicio wg-quick@wg0
echo "🚀 [5/5] Activando servicio WireGuard wg-quick@wg0..."
systemctl daemon-reload
systemctl enable wg-quick@wg0
systemctl restart wg-quick@wg0

echo ""
echo "========================================================================"
echo "✅ WireGuard Server configurado y activo en el VPS!"
echo "• Interfaz:       wg0"
echo "• IP del Servidor:10.10.0.1/24"
echo "• Puerto UDP:     51820"
echo "• Clave Pública del Servidor: ${SERVER_PUBKEY}"
echo "• Clave Pública del Mango 1:  ${MANGO1_PUBKEY}"
echo "========================================================================"
