using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Attendance.Application.Services;

public record IngestionRequest(
    string DeviceCode,
    string EmployeeCode,
    DateTime Timestamp,
    string Method,
    string? EventType = "Auto",
    string? ExternalEventId = null,
    string? RawPayload = null
);

public record IngestionResult(
    bool Success,
    bool IsDuplicate,
    string Message,
    long? EventId,
    string EventHash
);

public interface IBiometricIngestionService
{
    Task<IngestionResult> IngestEventAsync(IngestionRequest request, CancellationToken cancellationToken = default);
}

public class BiometricIngestionService : IBiometricIngestionService
{
    private readonly IAppDbContext _context;
    private readonly IAttendanceProcessingService _attendanceProcessingService;
    private readonly ILogger<BiometricIngestionService> _logger;

    public BiometricIngestionService(
        IAppDbContext context,
        IAttendanceProcessingService attendanceProcessingService,
        ILogger<BiometricIngestionService> logger)
    {
        _context = context;
        _attendanceProcessingService = attendanceProcessingService;
        _logger = logger;
    }

    public async Task<IngestionResult> IngestEventAsync(IngestionRequest request, CancellationToken cancellationToken = default)
    {
        // 1. Resolve Device
        var device = await _context.BiometricDevices
            .FirstOrDefaultAsync(d => d.Code == request.DeviceCode, cancellationToken);

        if (device == null)
        {
            _logger.LogWarning("[BiometricIngestion] Dispositivo desconocido: {DeviceCode}", request.DeviceCode);
            return new IngestionResult(false, false, $"Dispositivo con código '{request.DeviceCode}' no encontrado.", null, "");
        }

        // 2. Resolve Employee
        var employee = await _context.Employees
            .FirstOrDefaultAsync(e => e.EmployeeCode == request.EmployeeCode || e.BiometricExternalId == request.EmployeeCode, cancellationToken);

        if (employee == null)
        {
            _logger.LogWarning("[BiometricIngestion] Empleado desconocido: {EmployeeCode}", request.EmployeeCode);
            return new IngestionResult(false, false, $"Empleado con código '{request.EmployeeCode}' no encontrado.", null, "");
        }

        // 3. Parse Method & EventType
        if (!Enum.TryParse<BiometricMethod>(request.Method, true, out var method))
        {
            method = BiometricMethod.Face;
        }

        if (!Enum.TryParse<BiometricEventType>(request.EventType ?? "Auto", true, out var eventType))
        {
            eventType = BiometricEventType.Auto;
        }

        // 4. Compute Idempotency Hash (SHA-256)
        var eventHash = BiometricEvent.ComputeHash(device.Code, employee.EmployeeCode, request.Timestamp, method);

        // 5. Check Idempotency: Has this exact event already been recorded?
        var existingEvent = await _context.BiometricEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(e => e.EventHash == eventHash, cancellationToken);

        if (existingEvent != null)
        {
            _logger.LogWarning("[BiometricIngestion] Idempotencia activada: Evento duplicado ignorado. Hash: {Hash}, Dispositivo: {Device}, Empleado: {Employee}, Timestamp: {Timestamp:yyyy-MM-dd HH:mm:ss}",
                eventHash, device.Code, employee.EmployeeCode, request.Timestamp);

            return new IngestionResult(true, true, "Evento biométrico duplicado. Ignorado por idempotencia.", existingEvent.Id, eventHash);
        }

        // 6. Create immutable BiometricEvent
        var biometricEvent = new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = employee.Id,
            ExternalEventId = request.ExternalEventId,
            DeviceTimestamp = request.Timestamp,
            ReceivedAtUtc = DateTime.UtcNow,
            Method = method,
            EventType = eventType,
            EventHash = eventHash,
            RawPayload = request.RawPayload,
            ProcessingStatus = EventProcessingStatus.Processed,
            ProcessedAtUtc = DateTime.UtcNow
        };

        _context.BiometricEvents.Add(biometricEvent);

        // Update Device last connection and event timestamps
        device.LastConnectionAt = DateTime.UtcNow;
        device.LastEventAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("[BiometricIngestion] Evento biométrico registrado exitosamente. Id: {EventId}, Hash: {Hash}", biometricEvent.Id, eventHash);

        // 7. Trigger immediate Attendance calculation
        try
        {
            await _attendanceProcessingService.ProcessDailyAttendanceAsync(employee.Id, request.Timestamp.Date, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al calcular asistencia inmediata para empleado {EmployeeId} en fecha {Date:yyyy-MM-dd}", employee.Id, request.Timestamp.Date);
        }

        return new IngestionResult(true, false, "Evento biométrico registrado y procesado exitosamente.", biometricEvent.Id, eventHash);
    }
}
