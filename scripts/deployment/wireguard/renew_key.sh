#!/bin/bash
set -e

NEW_PRIVKEY=$(wg genkey)
NEW_PUBKEY=$(echo "$NEW_PRIVKEY" | wg pubkey)
echo "$NEW_PRIVKEY" > /etc/wireguard/mango1_private.key
echo "$NEW_PUBKEY" > /etc/wireguard/mango1_public.key
chmod 600 /etc/wireguard/mango1_private.key
chmod 644 /etc/wireguard/mango1_public.key

SERVER_PUBKEY=$(cat /etc/wireguard/server_public.key)
SERVER_PRIVKEY=$(cat /etc/wireguard/server_private.key)

cat << CONF > /etc/wireguard/wg0.conf
[Interface]
Address = 10.10.0.1/24
ListenPort = 51820
PrivateKey = ${SERVER_PRIVKEY}

PostUp = iptables -A FORWARD -i wg0 -o wg0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostUp = iptables -A FORWARD -s 10.10.0.1/32 -d 10.10.0.0/16 -j ACCEPT
PostDown = iptables -D FORWARD -i wg0 -o wg0 -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT
PostDown = iptables -D FORWARD -s 10.10.0.1/32 -d 10.10.0.0/16 -j ACCEPT

# Peer 1: Sucursal 1 (Mango Casa / Centro)
[Peer]
PublicKey = ${NEW_PUBKEY}
AllowedIPs = 10.10.0.2/32, 10.10.1.0/24
CONF

wg-quick down wg0 2>/dev/null || true
wg-quick up wg0

echo "KEYPAIR_RENEWED_SUCCESSFULLY"
echo "SERVER_PUBKEY:${SERVER_PUBKEY}"
echo "MANGO_PUBKEY:${NEW_PUBKEY}"
echo "MANGO_PRIVKEY:${NEW_PRIVKEY}"
