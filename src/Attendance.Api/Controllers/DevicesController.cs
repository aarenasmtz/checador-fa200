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
                IsSimulated = d.Status == DeviceStatus.Simulated || d.Provider == "Mock",
                d.LastConnectionAt,
                d.LastEventAt,
                d.FirmwareVersion,
                PunchesToday = d.Events.Count(e => e.DeviceTimestamp >= today)
            })
            .ToListAsync();

        return Ok(devices);
    }

    [HttpPost]
    public async Task<IActionResult> CreateDevice([FromBody] CreateDeviceRequest request)
    {
        if (await _context.BiometricDevices.AnyAsync(d => d.Code == request.Code))
        {
            return BadRequest(new { message = "El código de dispositivo ya existe" });
        }

        var branch = await _context.Branches.FindAsync(request.BranchId);
        if (branch == null) return BadRequest(new { message = "Sucursal no encontrada" });

        var device = new BiometricDevice
        {
            BranchId = request.BranchId,
            Code = request.Code.Trim().ToUpperInvariant(),
            Name = request.Name.Trim(),
            Model = request.Model,
            Provider = "Mock", // Mock while physical device is pending
            Status = DeviceStatus.Simulated,
            IpAddress = request.IpAddress,
            Port = request.Port,
            ConnectionMode = Enum.TryParse<DeviceConnectionMode>(request.ConnectionMode, true, out var mode) ? mode : DeviceConnectionMode.LocalAgent
        };

        _context.BiometricDevices.Add(device);
        await _context.SaveChangesAsync();

        return Ok(device);
    }

    [HttpPost("{id}/test-connection")]
    public async Task<IActionResult> TestConnection(int id)
    {
        var device = await _context.BiometricDevices.FindAsync(id);
        if (device == null) return NotFound();

        var provider = _providerFactory.GetProvider(device.Provider);
        try
        {
            var success = await provider.TestConnectionAsync(device);
            device.LastConnectionAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success,
                deviceCode = device.Code,
                provider = device.Provider,
                status = device.Status.ToString(),
                message = success ? "Conexión simulada verificada exitosamente (Modo Simulación Activo)" : "Fallo de conexión"
            });
        }
        catch (NotSupportedException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    [HttpPost("{id}/sync")]
    public async Task<IActionResult> SyncDevice(int id)
    {
        var device = await _context.BiometricDevices.FindAsync(id);
        if (device == null) return NotFound();

        var provider = _providerFactory.GetProvider(device.Provider);
        var employees = await _context.Employees
            .Where(e => e.BranchId == device.BranchId && e.Status == CommonStatus.Active)
            .ToListAsync();

        int syncedCount = 0;
        foreach (var emp in employees)
        {
            try
            {
                await provider.SyncEmployeeAsync(device, emp);
                syncedCount++;
            }
            catch
            {
                // Continue with next
            }
        }

        device.LastConnectionAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new
        {
            deviceCode = device.Code,
            syncedEmployees = syncedCount,
            message = $"Sincronización simulada completada para {syncedCount} empleados en {device.Name}"
        });
    }
}
