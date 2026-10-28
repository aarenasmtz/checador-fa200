param(
    [string]$VpsHost = "",
    [string]$VpsUser = "root"
)

$ErrorActionPreference = "Stop"

$RootDir = (Resolve-Path "$PSScriptRoot\..\..").Path
$DistDir = Join-Path $RootDir "dist_vps"

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "Iniciando Empaquetado de Control de Asistencia para VPS..." -ForegroundColor Cyan
Write-Host "Directorio raiz: $RootDir" -ForegroundColor Gray
Write-Host "========================================================================" -ForegroundColor Cyan

if (Test-Path $DistDir) {
    Remove-Item -Recurse -Force $DistDir
}
New-Item -ItemType Directory -Path "$DistDir\api" | Out-Null
New-Item -ItemType Directory -Path "$DistDir\web" | Out-Null

# 1. Compilar Backend .NET 9 API en Release
Write-Host "`n[1/4] Compilando Backend .NET 9 API (Release)..." -ForegroundColor Yellow
$ApiProj = Join-Path $RootDir "src\Attendance.Api\Attendance.Api.csproj"
dotnet publish $ApiProj -c Release -o "$DistDir\api"

# Asegurar que appsettings.Production.json viaje en el paquete
$ProdSettings = Join-Path $RootDir "src\Attendance.Api\appsettings.Production.json"
if (Test-Path $ProdSettings) {
    Copy-Item $ProdSettings "$DistDir\api\appsettings.Production.json" -Force
}

# Incluir fuente CJK para reportes PDF
$FontsDir = "$DistDir\api\Fonts"
New-Item -ItemType Directory -Path $FontsDir -Force | Out-Null
if (Test-Path "C:\Windows\Fonts\msyh.ttc") {
    Copy-Item "C:\Windows\Fonts\msyh.ttc" "$FontsDir\msyh.ttc" -Force
}

# 2. Compilar Frontend React 19 + Vite
Write-Host "`n[2/4] Compilando Frontend React + Vite..." -ForegroundColor Yellow
$FrontendDir = Join-Path $RootDir "frontend"
Push-Location $FrontendDir
try {
    npm run build
} finally {
    Pop-Location
}
Copy-Item -Recurse "$FrontendDir\dist\*" "$DistDir\web\"

# 3. Incluir Scripts de Configuración y Migración SQL
Write-Host "`n[3/4] Empaquetando scripts de SQL y de Sistema..." -ForegroundColor Yellow
$SqlScript = Join-Path $RootDir "publish\init_attendance_db.sql"
if (Test-Path $SqlScript) {
    Copy-Item $SqlScript "$DistDir\init_attendance_db.sql"
}
$MigrationScript = Join-Path $RootDir "publish\migration_incidents.sql"
if (Test-Path $MigrationScript) {
    Copy-Item $MigrationScript "$DistDir\migration_incidents.sql"
}
$VpnMigrationScript = Join-Path $RootDir "publish\migration_vpn_devices.sql"
if (Test-Path $VpnMigrationScript) {
    Copy-Item $VpnMigrationScript "$DistDir\migration_vpn_devices.sql"
}
Copy-Item (Join-Path $RootDir "scripts\server_fa200_vpn_sync.py") "$DistDir\api\server_fa200_vpn_sync.py"
Copy-Item (Join-Path $RootDir "scripts\deployment\checador-api.service") "$DistDir\checador-api.service"
Copy-Item (Join-Path $RootDir "scripts\deployment\checador-sync.service") "$DistDir\checador-sync.service"
Copy-Item (Join-Path $RootDir "scripts\deployment\checador.nginx.conf") "$DistDir\checador.nginx.conf"
Copy-Item (Join-Path $RootDir "scripts\deployment\setup_vps_checador.sh") "$DistDir\setup_vps_checador.sh"

# 4. Crear Archivo Comprimido tar.gz
Write-Host "`n[4/4] Comprimiendo archivo dist_vps.tar.gz..." -ForegroundColor Yellow
$TarFile = Join-Path $RootDir "dist_vps.tar.gz"
if (Test-Path $TarFile) {
    Remove-Item -Force $TarFile
}
Push-Location $RootDir
try {
    tar -czf "dist_vps.tar.gz" -C "$DistDir" .
} finally {
    Pop-Location
}

$ArchiveSize = (Get-Item $TarFile).Length / 1MB
Write-Host "`n========================================================================" -ForegroundColor Green
Write-Host "Paquete generado exitosamente: dist_vps.tar.gz ($([math]::Round($ArchiveSize, 2)) MB)" -ForegroundColor Green
Write-Host "Ubicacion: $TarFile" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Green

if ($VpsHost) {
    Write-Host "`nSubiendo paquete al VPS $VpsHost..." -ForegroundColor Cyan
    scp $TarFile "${VpsUser}@${VpsHost}:/root/"
    
    Write-Host "`nEjecutando script de despliegue en el VPS..." -ForegroundColor Cyan
    ssh "${VpsUser}@${VpsHost}" "mkdir -p /root/attendance_deploy && tar -xzf /root/dist_vps.tar.gz -C /root/attendance_deploy && cd /root/attendance_deploy && sed -i 's/\r$//' setup_vps_checador.sh && chmod +x setup_vps_checador.sh && ./setup_vps_checador.sh"
} else {
    Write-Host "`nInstrucciones para subir al VPS:" -ForegroundColor Cyan
    Write-Host "1. Sube el paquete al VPS ejecutando:" -ForegroundColor White
    Write-Host "   scp dist_vps.tar.gz root@<TU_IP_VPS>:/root/" -ForegroundColor Yellow
    Write-Host "`n2. Conéctate y ejecuta el instalador:" -ForegroundColor White
    Write-Host "   ssh root@<TU_IP_VPS> `"mkdir -p /root/attendance_deploy && tar -xzf /root/dist_vps.tar.gz -C /root/attendance_deploy && cd /root/attendance_deploy && chmod +x setup_vps_checador.sh && ./setup_vps_checador.sh`"" -ForegroundColor Yellow
}
Write-Host "========================================================================`n" -ForegroundColor Cyan
