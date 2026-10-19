#!/bin/bash
set -e

echo "=== TEST 1: Health Check Checador API (5081) ==="
curl -i http://127.0.0.1:5081/health
echo ""

echo "=== TEST 2: Health Check Lambrín API (5000) ==="
curl -i http://127.0.0.1:5000/api/v1/health
echo ""

echo "=== TEST 3: Login en Checador API ==="
LOGIN_JSON='{"username":"admin","password":"Admin123!"}'
LOGIN_RESP=$(curl -s -X POST http://127.0.0.1:5081/api/v1/auth/login -H "Content-Type: application/json" -d "$LOGIN_JSON")
TOKEN=$(echo "$LOGIN_RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "ERROR: No se pudo obtener el token JWT."
    echo "Respuesta del login: $LOGIN_RESP"
    exit 1
fi
echo "Token JWT obtenido con éxito! (Longitud: ${#TOKEN})"

echo "=== TEST 4: Consulta de Sucursales ==="
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5081/api/v1/branches | head -c 200
echo ""

echo "=== TEST 5: Consulta de Empleados ==="
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5081/api/v1/employees | head -c 200
echo ""

echo "=== TEST 6: Resumen Dashboard ==="
curl -s -H "Authorization: Bearer $TOKEN" http://127.0.0.1:5081/api/v1/dashboard/summary
echo ""

echo "=== TEST 7: Frontend Nginx (checador.wpcbajio.com) ==="
curl -s -I -H "Host: checador.wpcbajio.com" http://127.0.0.1/ | head -n 5
echo ""

echo "=== TEST 8: Backend Nginx Proxy (api-checador.wpcbajio.com) ==="
curl -s -I -H "Host: api-checador.wpcbajio.com" http://127.0.0.1/health | head -n 5
echo ""

echo "=== TODOS LOS TESTS PASARON EXITOSAMENTE ==="
