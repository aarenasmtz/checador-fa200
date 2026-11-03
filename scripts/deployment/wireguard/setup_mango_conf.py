import subprocess
import base64
import sys

# 1. Ejecutar renew_key.sh en el VPS
res = subprocess.run(
    ["ssh", "root@193.46.198.88", "sed -i 's/\\r$//' /root/renew_key.sh && chmod +x /root/renew_key.sh && /root/renew_key.sh"],
    capture_output=True,
    text=True,
    check=True
)

lines = res.stdout.strip().splitlines()
server_pubkey = None
mango_pubkey = None
mango_privkey = None

for line in lines:
    if line.startswith("SERVER_PUBKEY:"):
        server_pubkey = line.split(":", 1)[1].strip()
    elif line.startswith("MANGO_PUBKEY:"):
        mango_pubkey = line.split(":", 1)[1].strip()
    elif line.startswith("MANGO_PRIVKEY:"):
        mango_privkey = line.split(":", 1)[1].strip()

assert server_pubkey, "No se obtuvo SERVER_PUBKEY"
assert mango_pubkey, "No se obtuvo MANGO_PUBKEY"
assert mango_privkey, "No se obtuvo MANGO_PRIVKEY"

# 2. Validar que las claves sean Base64 válido de exactamente 32 bytes
priv_bytes = base64.b64decode(mango_privkey)
pub_bytes = base64.b64decode(server_pubkey)
mango_pub_bytes = base64.b64decode(mango_pubkey)

print(f"Validación criptográfica local:")
print(f"• Longitud clave privada Mango decodificada: {len(priv_bytes)} bytes (Esperado: 32) -> {'OK' if len(priv_bytes) == 32 else 'FALLO'}")
print(f"• Longitud clave pública Mango decodificada:  {len(mango_pub_bytes)} bytes (Esperado: 32) -> {'OK' if len(mango_pub_bytes) == 32 else 'FALLO'}")
print(f"• Longitud clave pública Servidor decodificada: {len(pub_bytes)} bytes (Esperado: 32) -> {'OK' if len(pub_bytes) == 32 else 'FALLO'}")

# 3. Construir el contenido de mango_cliente_casa.conf
# Con Address = 10.10.0.2/32, Endpoint = 193.46.198.88:51820, AllowedIPs = 10.10.0.1/32, PersistentKeepalive = 25
# En GL.iNet firmware 4.x, el importador valida la presencia de DNS. Incluimos DNS = 1.1.1.1 para que el validador de GL.iNet no rechace el archivo.
conf_content = f"""[Interface]
Address = 10.10.0.2/32
PrivateKey = {mango_privkey}
DNS = 1.1.1.1

[Peer]
PublicKey = {server_pubkey}
Endpoint = 193.46.198.88:51820
AllowedIPs = 10.10.0.1/32
PersistentKeepalive = 25
"""

# Guardar estrictamente en UTF-8 sin BOM y con saltos de línea LF (\n)
with open("mango_cliente_casa.conf", "wb") as f:
    f.write(conf_content.encode("utf-8"))

# Verificar archivo escrito
with open("mango_cliente_casa.conf", "rb") as f:
    written = f.read()

assert not written.startswith(b"\xef\xbb\xbf"), "Error: Contiene BOM"
assert b"\r\n" not in written, "Error: Contiene CRLF"
assert b"\n" in written, "Error: No contiene saltos LF"

print(f"\nArchivo 'mango_cliente_casa.conf' generado exitosamente ({len(written)} bytes).")
print(f"• Codificación: UTF-8 sin BOM")
print(f"• Saltos de línea: LF (Unix)")
print(f"• Clave pública registrada en VPS: {mango_pubkey}")
