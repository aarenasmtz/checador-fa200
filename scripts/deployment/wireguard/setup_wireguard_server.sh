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

# 3. Directorio de configuración y claves
echo "🔑 [3/5] Comprobando claves criptográficas de WireGuard..."
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard

if [ ! -f /etc/wireguard/server_private.key ]; then
    wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key
    chmod 600 /etc/wireguard/server_private.key
    chmod 644 /etc/wireguard/server_public.key
    echo "• Claves generadas exitosamente en /etc/wireguard/"
else
    echo "• Claves del servidor existentes detectadas."
fi

SERVER_PRIVKEY=$(cat /etc/wireguard/server_private.key)
SERVER_PUBKEY=$(cat /etc/wireguard/server_public.key)

# 4. Crear configuración wg0.conf base si no existe
if [ ! -f /etc/wireguard/wg0.conf ]; then
    echo "⚙️ [4/5] Creando archivo /etc/wireguard/wg0.conf..."
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

# Peer 1: Sucursal Centro (Mango)
# Descomentar y rellenar PublicKey del Mango al conectar el equipo físico:
#[Peer]
#PublicKey = <PEER_PUBLIC_KEY_MANGO_SUCURSAL1>
#AllowedIPs = 10.10.0.2/32, 10.10.1.0/24

EOF
    chmod 600 /etc/wireguard/wg0.conf
fi

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
echo "• Clave Pública del Servidor:"
echo "  ${SERVER_PUBKEY}"
echo "========================================================================"
echo "Instrucciones para dar de alta un Mango:"
echo "1. Agrega el bloque [Peer] del Mango en /etc/wireguard/wg0.conf"
echo "2. Ejecuta: wg syncconf wg0 <(wg-quick strip wg0)"
echo "3. En el Mango, usa como Endpoint: 193.46.198.88:51820"
echo "   y como PublicKey la clave mostrada arriba."
echo "========================================================================"
