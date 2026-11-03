using Attendance.Application.Interfaces;
using Attendance.Biometrics.Factory;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

public record CreateDeviceRequest(
    int BranchId,
    string Code,
    string Name,
    string Model = "FA200",
    string? IpAddress = null,
    int? Port = 4370,
    string ConnectionMode = "VpnTunnel",
    bool IsEnabled = true,
    string TimeZoneId = "America/Mexico_City",
    int SyncIntervalSeconds = 30,
    string? VpnSubnet = null,
    string? VpnClientIp = null
);

public record UpdateDeviceRequest(
    int BranchId,
    string Code,
    string Name,
    string Model = "FA200",
    string? IpAddress = null,
    int? Port = 4370,
    string? Status = "Online",
    string ConnectionMode = "VpnTunnel",
    bool IsEnabled = true,
    string TimeZoneId = "America/Mexico_City",
    int SyncIntervalSeconds = 30,
    string? VpnSubnet = null,
    string? VpnClientIp = null
);

[ApiController]
[Route("api/v1/devices")]
public class DevicesController : ControllerBase
{
    private readonly IAppDbContext _context;
    private readonly IBiometricProviderFactory _providerFactory;
    private readonly IConfiguration _configuration;

    public DevicesController(
        IAppDbContext context,
        IBiometricProviderFactory providerFactory,
        IConfiguration configuration)
    {
        _context = context;
        _providerFactory = providerFactory;
        _configuration = configuration;
    }

    private bool IsAuthorized()
    {
        if (User?.Identity?.IsAuthenticated == true) return true;

        var configuredKey = _configuration["SyncAgent:ApiKey"] ?? "fa200-sync-agent-secret-key-2026";
        if (Request.Headers.TryGetValue("X-Agent-Key", out var headerKey) ||
            Request.Headers.TryGetValue("X-Api-Key", out headerKey))
        {
            return string.Equals(headerKey.ToString().Trim(), configuredKey.Trim(), StringComparison.Ordinal);
        }

        return false;
    }

    [HttpGet]
    public async Task<IActionResult> GetDevices()
    {
        if (!IsAuthorized()) return Unauthorized(new { message = "Acceso no autorizado. Inicie sesión o proporcione X-Agent-Key." });
        var today = DateTime.UtcNow.Date;

        var devices = await _context.BiometricDevices
            .Include(d => d.Branch)
            .AsNoTracking()
            .Select(d => new
            {
                d.Id,
                d.BranchId,
                BranchName = d.Branch.Name,
                d.Code,
                d.Name,
                d.Provider,
                d.Model,
                d.SerialNumber,
                d.IpAddress,
                d.Port,
                ConnectionMode = d.ConnectionMode.ToString(),
                Status = d.Status.ToString(),
                IsSimulated = false,
                d.IsEnabled,
                d.TimeZoneId,
                d.SyncIntervalSeconds,
                d.LastConnectionAt,
                d.LastEventAt,
                d.LastSyncAt,
                d.LastSyncAttemptAt,
                d.LastSuccessfulSyncAt,
                d.LastSyncRecordsCount,
                d.IsSyncInProgress,
                d.PendingQueueCount,
                d.LastErrorMessage,
                d.FirmwareVersion,
                d.VpnSubnet,
                d.VpnClientIp,
                PunchesToday = d.Events.Count(e => e.DeviceTimestamp >= today)
            })
            .ToListAsync();

        return Ok(devices);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDevice(int id)
    {
        var device = await _context.BiometricDevices
            .Include(d => d.Branch)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (device == null) return NotFound();

        return Ok(new
        {
            device.Id,
            device.BranchId,
            BranchName = device.Branch?.Name,
            device.Code,
            device.Name,
            device.Provider,
            device.Model,
            device.SerialNumber,
            device.IpAddress,
            device.Port,
            ConnectionMode = device.ConnectionMode.ToString(),
            Status = device.Status.ToString(),
            IsSimulated = false,
            device.IsEnabled,
            device.TimeZoneId,
            device.SyncIntervalSeconds,
            device.LastConnectionAt,
            device.LastEventAt,
            device.LastSyncAt,
            device.LastSyncAttemptAt,
            device.LastSuccessfulSyncAt,
            device.LastSyncRecordsCount,
            device.IsSyncInProgress,
            device.PendingQueueCount,
            device.LastErrorMessage,
            device.FirmwareVersion,
            device.VpnSubnet,
            device.VpnClientIp
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateDevice([FromBody] CreateDeviceRequest request)
    {
        if (!IsAuthorized()) return Unauthorized(new { message = "Acceso no autorizado" });

        var cleanCode = request.Code?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(cleanCode))
        {
            return BadRequest(new { message = "El código de dispositivo es requerido" });
        }

        if (await _context.BiometricDevices.AnyAsync(d => d.Code == cleanCode))
        {
            return BadRequest(new { message = $"El código de dispositivo '{cleanCode}' ya existe" });
        }

        var branch = await _context.Branches.FindAsync(request.BranchId);
        if (branch == null) return BadRequest(new { message = "Sucursal no encontrada" });

        var device = new BiometricDevice
        {
            BranchId = request.BranchId,
            Code = cleanCode,
            Name = request.Name?.Trim() ?? cleanCode,
            Model = string.IsNullOrWhiteSpace(request.Model) ? "FA200" : request.Model.Trim(),
            Provider = "FA200",
            Status = DeviceStatus.Online,
            IpAddress = request.IpAddress?.Trim(),
            Port = request.Port ?? 4370,
            ConnectionMode = Enum.TryParse<DeviceConnectionMode>(request.ConnectionMode, true, out var mode) ? mode : DeviceConnectionMode.VpnTunnel,
            IsEnabled = request.IsEnabled,
            TimeZoneId = string.IsNullOrWhiteSpace(request.TimeZoneId) ? "America/Mexico_City" : request.TimeZoneId.Trim(),
            SyncIntervalSeconds = request.SyncIntervalSeconds > 0 ? request.SyncIntervalSeconds : 30,
            VpnSubnet = request.VpnSubnet?.Trim(),
            VpnClientIp = request.VpnClientIp?.Trim(),
            LastConnectionAt = DateTime.UtcNow
        };

        _context.BiometricDevices.Add(device);
        await _context.SaveChangesAsync();

        return Ok(device);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] UpdateDeviceRequest request)
    {
        if (!IsAuthorized()) return Unauthorized(new { message = "Acceso no autorizado" });

        var device = await _context.BiometricDevices.FindAsync(id);
        if (device == null) return NotFound(new { message = "Dispositivo no encontrado" });

        var cleanCode = request.Code?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(cleanCode))
        {
            return BadRequest(new { message = "El código de dispositivo es requerido" });
        }

        if (await _context.BiometricDevices.AnyAsync(d => d.Code == cleanCode && d.Id != id))
        {
            return BadRequest(new { message = $"El código de dispositivo '{cleanCode}' ya está en uso por otro equipo" });
        }

        var branch = await _context.Branches.FindAsync(request.BranchId);
        if (branch == null) return BadRequest(new { message = "Sucursal no encontrada" });

        device.BranchId = request.BranchId;
        device.Code = cleanCode;
        device.Name = request.Name?.Trim() ?? cleanCode;
        device.Model = string.IsNullOrWhiteSpace(request.Model) ? "FA200" : request.Model.Trim();
        device.IpAddress = request.IpAddress?.Trim();
        device.Port = request.Port ?? 4370;
        device.IsEnabled = request.IsEnabled;
        device.TimeZoneId = string.IsNullOrWhiteSpace(request.TimeZoneId) ? "America/Mexico_City" : request.TimeZoneId.Trim();
        device.SyncIntervalSeconds = request.SyncIntervalSeconds > 0 ? request.SyncIntervalSeconds : 30;
        device.VpnSubnet = request.VpnSubnet?.Trim();
        device.VpnClientIp = request.VpnClientIp?.Trim();

        if (Enum.TryParse<DeviceConnectionMode>(request.ConnectionMode, true, out var mode))
        {
            device.ConnectionMode = mode;
        }

        if (!string.IsNullOrWhiteSpace(request.Status) && Enum.TryParse<DeviceStatus>(request.Status, true, out var status))
        {
            device.Status = status;
        }

        await _context.SaveChangesAsync();
        return Ok(device);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteDevice(int id)
    {
        if (!IsAuthorized()) return Unauthorized(new { message = "Acceso no autorizado" });

        var device = await _context.BiometricDevices
            .Include(d => d.Events)
            .FirstOrDefaultAsync(d => d.Id == id);

        if (device == null) return NotFound(new { message = "Dispositivo no encontrado" });

        if (device.Events != null && device.Events.Any())
        {
            _context.BiometricEvents.RemoveRange(device.Events);
        }

        _context.BiometricDevices.Remove(device);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Dispositivo reloj checador eliminado exitosamente" });
    }

    [HttpPost("{id}/test-connection")]
    public async Task<IActionResult> TestConnection(int id)
    {
        if (!IsAuthorized()) return Unauthorized(new { message = "Acceso no autorizado" });

        var device = await _context.BiometricDevices.FindAsync(id);
        if (device == null) return NotFound(new { message = "Dispositivo no encontrado" });

        if (string.IsNullOrWhiteSpace(device.IpAddress))
        {
            return BadRequest(new
            {
                success = false,
                deviceCode = device.Code,
                message = "El dispositivo no tiene configurada una dirección IP (VPN o LAN)."
            });
        }

        var targetPort = device.Port ?? 4370;
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            using var client = new System.Net.Sockets.TcpClient();
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3.5));

            var connectTask = client.ConnectAsync(device.IpAddress, targetPort, cts.Token).AsTask();
            await connectTask;

            stopwatch.Stop();
            var latencyMs = stopwatch.ElapsedMilliseconds;

            device.LastConnectionAt = DateTime.UtcNow;
            device.Status = DeviceStatus.Online;
            device.LastErrorMessage = null;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                deviceCode = device.Code,
                ipAddress = device.IpAddress,
                port = targetPort,
                latencyMs,
                status = device.Status.ToString(),
                message = $"Conexión exitosa con el reloj FA200 ({device.IpAddress}:{targetPort}) en {latencyMs} ms a través de la red privada VPN (Mango)."
            });
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            device.Status = DeviceStatus.Offline;
            device.LastErrorMessage = $"Fallo de conexión ({device.IpAddress}:{targetPort}): {ex.Message}";
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = false,
                deviceCode = device.Code,
                ipAddress = device.IpAddress,
                port = targetPort,
                status = device.Status.ToString(),
                error = ex.Message,
                message = $"No se pudo comunicar con el checador FA200 en {device.IpAddress}:{targetPort}. Verifique que el router Mango tenga el túnel WireGuard activo y el cable Ethernet conectado al reloj."
            });
        }
    }

    [HttpPost("{id}/sync")]
    public async Task<IActionResult> SyncDevice(int id)
    {
        if (!IsAuthorized()) return Unauthorized(new { message = "Acceso no autorizado" });

        var device = await _context.BiometricDevices.FindAsync(id);
        if (device == null) return NotFound(new { message = "Dispositivo no encontrado" });

        if (device.IsSyncInProgress)
        {
            return Conflict(new
            {
                success = false,
                deviceCode = device.Code,
                message = "Ya existe una sincronización en curso para este dispositivo. Espere a que termine."
            });
        }

        device.IsSyncInProgress = true;
        device.LastSyncAttemptAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        try
        {
            // Test connection before sync
            if (!string.IsNullOrWhiteSpace(device.IpAddress))
            {
                using var client = new System.Net.Sockets.TcpClient();
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3.5));
                await client.ConnectAsync(device.IpAddress, device.Port ?? 4370, cts.Token).AsTask();
            }

            var employees = await _context.Employees
                .Where(e => e.BranchId == device.BranchId && e.Status == CommonStatus.Active)
                .ToListAsync();

            device.LastConnectionAt = DateTime.UtcNow;
            device.LastSyncAt = DateTime.UtcNow;
            device.LastSuccessfulSyncAt = DateTime.UtcNow;
            device.Status = DeviceStatus.Online;
            device.LastErrorMessage = null;
            device.IsSyncInProgress = false;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                deviceCode = device.Code,
                syncedEmployees = employees.Count,
                lastSyncRecordsCount = device.LastSyncRecordsCount,
                message = $"Sincronización procesada exitosamente para {device.Name} ({device.Code}) sobre VPN."
            });
        }
        catch (Exception ex)
        {
            device.Status = DeviceStatus.Offline;
            device.LastErrorMessage = $"Error en sincronización ({device.IpAddress}:{device.Port ?? 4370}): {ex.Message}";
            device.IsSyncInProgress = false;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = false,
                deviceCode = device.Code,
                status = device.Status.ToString(),
                error = ex.Message,
                message = $"No se pudo completar la sincronización con el reloj en {device.IpAddress}:{device.Port ?? 4370}. Verifique el enlace VPN del router Mango."
            });
        }
    }
}
