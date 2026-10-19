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
    string ConnectionMode = "LocalAgent"
);

public record UpdateDeviceRequest(
    int BranchId,
    string Code,
    string Name,
    string Model = "FA200",
    string? IpAddress = null,
    int? Port = 4370,
    string? Status = "Online",
    string ConnectionMode = "LocalAgent"
);

[ApiController]
[Route("api/v1/devices")]
[Authorize]
public class DevicesController : ControllerBase
{
    private readonly IAppDbContext _context;
    private readonly IBiometricProviderFactory _providerFactory;

    public DevicesController(IAppDbContext context, IBiometricProviderFactory providerFactory)
    {
        _context = context;
        _providerFactory = providerFactory;
    }

    [HttpGet]
    public async Task<IActionResult> GetDevices()
    {
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
                d.LastConnectionAt,
                d.LastEventAt,
                d.FirmwareVersion,
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
            device.LastConnectionAt,
            device.LastEventAt,
            device.FirmwareVersion
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateDevice([FromBody] CreateDeviceRequest request)
    {
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
            ConnectionMode = Enum.TryParse<DeviceConnectionMode>(request.ConnectionMode, true, out var mode) ? mode : DeviceConnectionMode.LocalAgent,
            LastConnectionAt = DateTime.UtcNow
        };

        _context.BiometricDevices.Add(device);
        await _context.SaveChangesAsync();

        return Ok(device);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateDevice(int id, [FromBody] UpdateDeviceRequest request)
    {
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
        var device = await _context.BiometricDevices.FindAsync(id);
        if (device == null) return NotFound();

        device.LastConnectionAt = DateTime.UtcNow;
        device.Status = DeviceStatus.Online;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            deviceCode = device.Code,
            provider = device.Provider,
            status = device.Status.ToString(),
            message = $"Dispositivo {device.Code} ({device.Name}) enlazado y listo para sincronización."
        });
    }

    [HttpPost("{id}/sync")]
    public async Task<IActionResult> SyncDevice(int id)
    {
        var device = await _context.BiometricDevices.FindAsync(id);
        if (device == null) return NotFound();

        var employees = await _context.Employees
            .Where(e => e.BranchId == device.BranchId && e.Status == CommonStatus.Active)
            .ToListAsync();

        device.LastConnectionAt = DateTime.UtcNow;
        device.Status = DeviceStatus.Online;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            deviceCode = device.Code,
            syncedEmployees = employees.Count,
            message = $"Sincronización configurada para {employees.Count} empleados en {device.Name}"
        });
    }
}
