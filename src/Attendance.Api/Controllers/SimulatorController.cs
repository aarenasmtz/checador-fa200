using Attendance.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace Attendance.Api.Controllers;

public record BiometricEventIngestRequest(
    string DeviceCode,
    string EmployeeCode,
    DateTime Timestamp,
    string Method,
    string? EventType = "Auto",
    string? RawPayload = null
);

[ApiController]
[Route("api/devices")]
[Route("api/v1/devices")]
[Route("api/devices/simulator")]
public class SimulatorController : ControllerBase
{
    private readonly IBiometricIngestionService _ingestionService;

    public SimulatorController(IBiometricIngestionService ingestionService)
    {
        _ingestionService = ingestionService;
    }

    /// <summary>
    /// Endpoint oficial para ingesta de checadas en tiempo real del reloj FA200.
    /// Compatible con agentes locales, push y sincronizaciones.
    /// </summary>
    [HttpPost("events")]
    public async Task<IActionResult> IngestBiometricEvent([FromBody] BiometricEventIngestRequest request)
    {
        var result = await _ingestionService.IngestEventAsync(new IngestionRequest(
            request.DeviceCode,
            request.EmployeeCode,
            request.Timestamp,
            request.Method,
            request.EventType ?? "Auto",
            RawPayload: request.RawPayload ?? "{\"source\":\"FA200\",\"deviceModel\":\"FA200\"}"
        ));

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }
}
