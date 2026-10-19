using Attendance.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace Attendance.Api.Controllers;

public record SimulatorEventRequest(
    string DeviceCode,
    string EmployeeCode,
    DateTime Timestamp,
    string Method,
    string? EventType = "Auto"
);

public record SimulatorScenarioRequest(
    string DeviceCode,
    string EmployeeCode,
    string Scenario, // "NormalDay", "Late", "EarlyExit", "Incomplete", "Duplicate", "Week"
    DateTime? Date = null
);

[ApiController]
[Route("api/devices/simulator")]
public class SimulatorController : ControllerBase
{
    private readonly IBiometricIngestionService _ingestionService;

    public SimulatorController(IBiometricIngestionService ingestionService)
    {
        _ingestionService = ingestionService;
    }

    /// <summary>
    /// Endpoint oficial para simular checadas biométricas del FA200.
    /// Pasa exactamente por el mismo pipeline que los eventos reales.
    /// </summary>
    [HttpPost("events")]
    public async Task<IActionResult> IngestSimulatedEvent([FromBody] SimulatorEventRequest request)
    {
        var result = await _ingestionService.IngestEventAsync(new IngestionRequest(
            request.DeviceCode,
            request.EmployeeCode,
            request.Timestamp,
            request.Method,
            request.EventType ?? "Auto",
            RawPayload: "{\"source\":\"SIMULATOR\",\"deviceModel\":\"FA200\"}"
        ));

        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    /// <summary>
    /// Generador de escenarios de prueba para validación rápida.
    /// </summary>
    [HttpPost("scenario")]
    public async Task<IActionResult> GenerateScenario([FromBody] SimulatorScenarioRequest request)
    {
        var targetDate = (request.Date ?? DateTime.UtcNow).Date;
        var results = new List<IngestionResult>();

        switch (request.Scenario.ToLowerInvariant())
        {
            case "normalday":
                // 07:56 FACE entry, 18:04 FINGERPRINT exit
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, targetDate.Add(new TimeSpan(7, 56, 12)), "FACE", "Entry")));
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, targetDate.Add(new TimeSpan(18, 4, 30)), "FINGERPRINT", "Exit")));
                break;

            case "late":
                // 08:22 FACE entry, 18:01 FINGERPRINT exit
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, targetDate.Add(new TimeSpan(8, 22, 15)), "FACE", "Entry")));
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, targetDate.Add(new TimeSpan(18, 1, 10)), "FINGERPRINT", "Exit")));
                break;

            case "earlyexit":
                // 07:58 entry, 16:30 exit
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, targetDate.Add(new TimeSpan(7, 58, 0)), "FACE", "Entry")));
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, targetDate.Add(new TimeSpan(16, 30, 0)), "FINGERPRINT", "Exit")));
                break;

            case "incomplete":
                // Only 08:02 entry
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, targetDate.Add(new TimeSpan(8, 2, 5)), "FACE", "Entry")));
                break;

            case "duplicate":
                // Send exactly the same timestamp twice to test idempotency
                var dt = targetDate.Add(new TimeSpan(8, 0, 0));
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, dt, "FACE", "Entry")));
                results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                    request.DeviceCode, request.EmployeeCode, dt, "FACE", "Entry")));
                break;

            case "week":
                // Monday to Friday
                for (int i = 0; i < 5; i++)
                {
                    var day = targetDate.AddDays(i);
                    results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                        request.DeviceCode, request.EmployeeCode, day.Add(new TimeSpan(7, 55, 0)), "FACE", "Entry")));
                    results.Add(await _ingestionService.IngestEventAsync(new IngestionRequest(
                        request.DeviceCode, request.EmployeeCode, day.Add(new TimeSpan(18, 5, 0)), "FINGERPRINT", "Exit")));
                }
                break;

            default:
                return BadRequest(new { message = $"Escenario desconocido: {request.Scenario}. Disponibles: NormalDay, Late, EarlyExit, Incomplete, Duplicate, Week" });
        }

        return Ok(new
        {
            scenario = request.Scenario,
            deviceCode = request.DeviceCode,
            employeeCode = request.EmployeeCode,
            date = targetDate,
            generatedEvents = results
        });
    }
}
