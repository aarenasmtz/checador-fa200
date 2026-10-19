using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

public record DeviceHeartbeatRequest(
    string DeviceCode,
    bool IsOnline,
    string? Firmware = null,
    string? SerialNumber = null,
    int PendingQueueCount = 0,
    DateTime? LastSyncAt = null,
    string? LastError = null
);

public record SingleEventIngestRequest(
    string DeviceCode,
    string UserClockId,
    DateTime Timestamp,
    string Method,
    string? EventType = "Punch",
    string? ExternalEventId = null,
    string? RawPayload = null
);

[ApiController]
[Route("api/devices")]
[Route("api/v1/devices")]
public class DeviceEventsController : ControllerBase
{
    private readonly IAppDbContext _context;
    private readonly IBiometricIngestionService _ingestionService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DeviceEventsController> _logger;

    public DeviceEventsController(
        IAppDbContext context,
        IBiometricIngestionService ingestionService,
        IConfiguration configuration,
        ILogger<DeviceEventsController> logger)
    {
        _context = context;
        _ingestionService = ingestionService;
        _configuration = configuration;
        _logger = logger;
    }

    private bool IsAuthorized(out string failureReason)
    {
        // 1. Authorized via JWT (Admin / Web Dashboard)
        if (User?.Identity?.IsAuthenticated == true)
        {
            failureReason = "";
            return true;
        }

        // 2. Authorized via X-Agent-Key or X-Api-Key header
        var configuredKey = _configuration["SyncAgent:ApiKey"] ?? "fa200-sync-agent-secret-key-2026";
        if (Request.Headers.TryGetValue("X-Agent-Key", out var headerKey) ||
            Request.Headers.TryGetValue("X-Api-Key", out headerKey))
        {
            if (string.Equals(headerKey.ToString().Trim(), configuredKey.Trim(), StringComparison.Ordinal))
            {
                failureReason = "";
                return true;
            }
        }

        failureReason = "Credencial de agente inválida o no proporcionada. Use el encabezado X-Agent-Key.";
        return false;
    }

    /// <summary>
    /// Ingesta en lote de eventos biométricos desde el agente local del reloj FA200.
    /// Responde cuáles fueron persistidos, cuáles ya existían (idempotencia) y cuáles fallaron.
    /// </summary>
    [HttpPost("events/batch")]
    public async Task<IActionResult> IngestBatch([FromBody] IngestionBatchRequest request)
    {
        if (!IsAuthorized(out var reason))
        {
            return Unauthorized(new { message = reason });
        }

        var result = await _ingestionService.IngestBatchAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Ingesta de un evento individual (soporta retrocompatibilidad y simuladores).
    /// </summary>
    [HttpPost("events")]
    public async Task<IActionResult> IngestSingleEvent([FromBody] SingleEventIngestRequest request)
    {
        if (!IsAuthorized(out var reason))
        {
            return Unauthorized(new { message = reason });
        }

        var result = await _ingestionService.IngestBatchAsync(new IngestionBatchRequest(
            request.DeviceCode,
            null,
            new List<IngestionBatchItem>
            {
                new IngestionBatchItem(
                    request.UserClockId,
                    request.Timestamp,
                    request.Method,
                    request.EventType ?? "Punch",
                    request.ExternalEventId,
                    request.RawPayload
                )
            }
        ));

        var first = result.Results.FirstOrDefault();
        if (first == null || !result.Success)
        {
            return BadRequest(new { success = false, message = result.Message });
        }

        return Ok(new
        {
            success = true,
            isDuplicate = first.Status == "Duplicate",
            status = first.Status,
            message = first.Message,
            eventId = first.EventId,
            eventHash = first.EventHash,
            linkedEmployeeName = first.LinkedEmployeeName,
            linkedEmployeeCode = first.LinkedEmployeeCode
        });
    }

    /// <summary>
    /// Heartbeat y estado de comunicación enviado periódicamente por el agente local.
    /// </summary>
    [HttpPost("heartbeat")]
    public async Task<IActionResult> DeviceHeartbeat([FromBody] DeviceHeartbeatRequest request)
    {
        if (!IsAuthorized(out var reason))
        {
            return Unauthorized(new { message = reason });
        }

        if (string.IsNullOrWhiteSpace(request.DeviceCode))
        {
            return BadRequest(new { message = "DeviceCode es requerido." });
        }

        var device = await _context.BiometricDevices
            .FirstOrDefaultAsync(d => d.Code == request.DeviceCode.Trim().ToUpperInvariant());

        if (device == null)
        {
            return NotFound(new { message = $"Dispositivo con código '{request.DeviceCode}' no registrado." });
        }

        device.LastConnectionAt = DateTime.UtcNow;
        device.Status = request.IsOnline ? DeviceStatus.Online : DeviceStatus.Offline;

        if (!string.IsNullOrWhiteSpace(request.Firmware))
        {
            device.FirmwareVersion = request.Firmware;
        }

        if (!string.IsNullOrWhiteSpace(request.SerialNumber))
        {
            device.SerialNumber = request.SerialNumber;
        }

        device.PendingQueueCount = request.PendingQueueCount;

        if (request.LastSyncAt.HasValue)
        {
            device.LastSyncAt = request.LastSyncAt.Value;
        }

        device.LastErrorMessage = request.LastError;

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            deviceCode = device.Code,
            status = device.Status.ToString(),
            serverTimeUtc = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Reprocesa checadas que quedaron en estado 'PendingLink' (usuario en reloj sin empleado previo).
    /// </summary>
    [HttpPost("events/reprocess-unlinked")]
    public async Task<IActionResult> ReprocessUnlinkedEvents()
    {
        if (!IsAuthorized(out var reason))
        {
            return Unauthorized(new { message = reason });
        }

        int count = await _ingestionService.ReprocessUnlinkedEventsAsync();
        return Ok(new
        {
            success = true,
            reprocessedCount = count,
            message = $"{count} eventos huérfanos fueron vinculados exitosamente a empleados."
        });
    }
}
