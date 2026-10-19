using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Attendance.Application.Services;

public record IngestionRequest(
    string DeviceCode,
    string EmployeeCode, // can be employee code or userClockId
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

public record IngestionBatchItem(
    string UserClockId,
    DateTime Timestamp,
    string Method,
    string? EventType = "Punch",
    string? ExternalEventId = null,
    string? RawPayload = null
);

public record IngestionBatchRequest(
    string DeviceCode,
    int? BranchId,
    List<IngestionBatchItem> Events
);

public record IngestionItemResult(
    string UserClockId,
    DateTime Timestamp,
    string Status, // "Persisted", "Duplicate", "Failed"
    string Message,
    long? EventId,
    string EventHash,
    string? LinkedEmployeeName,
    string? LinkedEmployeeCode
);

public record BatchIngestionResult(
    bool Success,
    string DeviceCode,
    int PersistedCount,
    int DuplicateCount,
    int FailedCount,
    List<IngestionItemResult> Results,
    string Message
);

public interface IBiometricIngestionService
{
    Task<IngestionResult> IngestEventAsync(IngestionRequest request, CancellationToken cancellationToken = default);
    Task<BatchIngestionResult> IngestBatchAsync(IngestionBatchRequest request, CancellationToken cancellationToken = default);
    Task<int> ReprocessUnlinkedEventsAsync(CancellationToken cancellationToken = default);
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
        var batchResult = await IngestBatchAsync(new IngestionBatchRequest(
            request.DeviceCode,
            null,
            new List<IngestionBatchItem>
            {
                new IngestionBatchItem(
                    request.EmployeeCode,
                    request.Timestamp,
                    request.Method,
                    request.EventType ?? "Auto",
                    request.ExternalEventId,
                    request.RawPayload
                )
            }
        ), cancellationToken);

        var first = batchResult.Results.FirstOrDefault();
        if (first == null || !batchResult.Success)
        {
            return new IngestionResult(false, false, batchResult.Message, null, "");
        }

        bool isDup = first.Status == "Duplicate";
        return new IngestionResult(true, isDup, first.Message, first.EventId, first.EventHash);
    }

    public async Task<BatchIngestionResult> IngestBatchAsync(IngestionBatchRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.DeviceCode))
        {
            return new BatchIngestionResult(false, "", 0, 0, 0, new(), "El código del dispositivo es requerido.");
        }

        var device = await _context.BiometricDevices
            .Include(d => d.Branch)
            .FirstOrDefaultAsync(d => d.Code == request.DeviceCode.Trim().ToUpperInvariant(), cancellationToken);

        if (device == null)
        {
            _logger.LogWarning("[BiometricIngestion] Dispositivo desconocido: {DeviceCode}", request.DeviceCode);
            return new BatchIngestionResult(false, request.DeviceCode, 0, 0, 0, new(), $"Dispositivo con código '{request.DeviceCode}' no registrado en el sistema.");
        }

        if (request.BranchId.HasValue && device.BranchId != request.BranchId.Value)
        {
            _logger.LogWarning("[BiometricIngestion] Dispositivo {DeviceCode} no pertenece a la sucursal {BranchId}", request.DeviceCode, request.BranchId);
            return new BatchIngestionResult(false, request.DeviceCode, 0, 0, 0, new(), $"El dispositivo '{request.DeviceCode}' no pertenece a la sucursal asignada.");
        }

        var results = new List<IngestionItemResult>();
        int persistedCount = 0;
        int duplicateCount = 0;
        int failedCount = 0;

        var employeesToRecalculate = new HashSet<(int EmployeeId, DateTime Date)>();

        foreach (var item in request.Events)
        {
            try
            {
                var userClockId = item.UserClockId?.Trim() ?? "";
                if (string.IsNullOrWhiteSpace(userClockId))
                {
                    results.Add(new IngestionItemResult(
                        userClockId, item.Timestamp, "Failed", "UserClockId es requerido.", null, "", null, null));
                    failedCount++;
                    continue;
                }

                if (!Enum.TryParse<BiometricMethod>(item.Method, true, out var method))
                {
                    method = BiometricMethod.Face;
                }

                if (!Enum.TryParse<BiometricEventType>(item.EventType ?? "Punch", true, out var eventType))
                {
                    eventType = BiometricEventType.Punch;
                }

                // Compute idempotency hash (SHA-256)
                var eventHash = BiometricEvent.ComputeHash(device.Code, userClockId, item.Timestamp, method);

                // Check if already persisted
                var existingEvent = await _context.BiometricEvents
                    .AsNoTracking()
                    .FirstOrDefaultAsync(e => e.EventHash == eventHash, cancellationToken);

                if (existingEvent != null)
                {
                    duplicateCount++;
                    results.Add(new IngestionItemResult(
                        userClockId,
                        item.Timestamp,
                        "Duplicate",
                        "Checada ya persistida previamente (idempotente).",
                        existingEvent.Id,
                        eventHash,
                        null,
                        null
                    ));
                    continue;
                }

                // Match employee: prioritize BiometricExternalId then EmployeeCode
                var employee = await _context.Employees
                    .FirstOrDefaultAsync(e =>
                        (e.BiometricExternalId == userClockId || e.EmployeeCode == userClockId) &&
                        e.Status == CommonStatus.Active,
                        cancellationToken);

                var biometricEvent = new BiometricEvent
                {
                    DeviceId = device.Id,
                    UserClockId = userClockId,
                    EmployeeId = employee?.Id,
                    ExternalEventId = item.ExternalEventId,
                    DeviceTimestamp = item.Timestamp,
                    ReceivedAtUtc = DateTime.UtcNow,
                    Method = method,
                    EventType = eventType,
                    EventHash = eventHash,
                    RawPayload = item.RawPayload ?? $"{{\"userClockId\":\"{userClockId}\",\"method\":\"{method}\"}}",
                    ProcessingStatus = employee != null ? EventProcessingStatus.Processed : EventProcessingStatus.PendingLink,
                    ProcessedAtUtc = employee != null ? DateTime.UtcNow : null
                };

                _context.BiometricEvents.Add(biometricEvent);
                await _context.SaveChangesAsync(cancellationToken);

                persistedCount++;

                string? empName = employee != null ? $"{employee.FirstName} {employee.LastName}".Trim() : null;
                string? empCode = employee?.EmployeeCode;

                if (employee != null)
                {
                    employeesToRecalculate.Add((employee.Id, item.Timestamp.Date));
                }

                results.Add(new IngestionItemResult(
                    userClockId,
                    item.Timestamp,
                    "Persisted",
                    employee != null ? "Guardado y vinculado exitosamente." : "Guardado como pendiente de vinculación (empleado no registrado aún).",
                    biometricEvent.Id,
                    eventHash,
                    empName,
                    empCode
                ));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error persistiendo evento individual {UserClockId} {Timestamp}", item.UserClockId, item.Timestamp);
                failedCount++;
                results.Add(new IngestionItemResult(
                    item.UserClockId ?? "",
                    item.Timestamp,
                    "Failed",
                    $"Error al guardar: {ex.Message}",
                    null,
                    "",
                    null,
                    null
                ));
            }
        }

        // Update Device heartbeat and status
        device.LastConnectionAt = DateTime.UtcNow;
        device.Status = DeviceStatus.Online;
        if (persistedCount > 0)
        {
            device.LastEventAt = DateTime.UtcNow;
        }
        await _context.SaveChangesAsync(cancellationToken);

        // Recalculate daily attendance for affected employees
        foreach (var (empId, date) in employeesToRecalculate)
        {
            try
            {
                await _attendanceProcessingService.ProcessDailyAttendanceAsync(empId, date, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al calcular asistencia para empleado {EmployeeId} en fecha {Date:yyyy-MM-dd}", empId, date);
            }
        }

        string summaryMsg = $"Lote procesado para {device.Code}: {persistedCount} guardados, {duplicateCount} duplicados, {failedCount} con error.";
        _logger.LogInformation("[BiometricIngestion] {Summary}", summaryMsg);

        return new BatchIngestionResult(
            true,
            device.Code,
            persistedCount,
            duplicateCount,
            failedCount,
            results,
            summaryMsg
        );
    }

    public async Task<int> ReprocessUnlinkedEventsAsync(CancellationToken cancellationToken = default)
    {
        var unlinkedEvents = await _context.BiometricEvents
            .Where(e => e.ProcessingStatus == EventProcessingStatus.PendingLink && e.EmployeeId == null && !string.IsNullOrEmpty(e.UserClockId))
            .ToListAsync(cancellationToken);

        if (!unlinkedEvents.Any())
        {
            return 0;
        }

        int reprocessed = 0;
        var recalculate = new HashSet<(int EmployeeId, DateTime Date)>();

        foreach (var evt in unlinkedEvents)
        {
            var emp = await _context.Employees
                .FirstOrDefaultAsync(e =>
                    (e.BiometricExternalId == evt.UserClockId || e.EmployeeCode == evt.UserClockId) &&
                    e.Status == CommonStatus.Active,
                    cancellationToken);

            if (emp != null)
            {
                evt.EmployeeId = emp.Id;
                evt.ProcessingStatus = EventProcessingStatus.Processed;
                evt.ProcessedAtUtc = DateTime.UtcNow;
                reprocessed++;

                recalculate.Add((emp.Id, evt.DeviceTimestamp.Date));
            }
        }

        if (reprocessed > 0)
        {
            await _context.SaveChangesAsync(cancellationToken);

            foreach (var (empId, date) in recalculate)
            {
                try
                {
                    await _attendanceProcessingService.ProcessDailyAttendanceAsync(empId, date, cancellationToken);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error al reprocesar asistencia para empleado {EmployeeId} en fecha {Date:yyyy-MM-dd}", empId, date);
                }
            }
        }

        _logger.LogInformation("[BiometricIngestion] {Count} eventos no vinculados fueron reprocesados exitosamente.", reprocessed);
        return reprocessed;
    }
}
