using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Worker;

public class Worker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<Worker> _logger;

    public Worker(IServiceProvider serviceProvider, ILogger<Worker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("[Attendance.Worker] Servicio en segundo plano iniciado exitosamente.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var context = scope.ServiceProvider.GetRequiredService<IAppDbContext>();
                var attendanceService = scope.ServiceProvider.GetRequiredService<IAttendanceProcessingService>();

                // 1. Process pending biometric events
                var pendingEvents = await context.BiometricEvents
                    .Where(e => e.ProcessingStatus == EventProcessingStatus.Pending)
                    .OrderBy(e => e.DeviceTimestamp)
                    .Take(50)
                    .ToListAsync(stoppingToken);

                if (pendingEvents.Any())
                {
                    _logger.LogInformation("[Attendance.Worker] Procesando {Count} eventos biométricos pendientes...", pendingEvents.Count);

                    foreach (var evt in pendingEvents)
                    {
                        try
                        {
                            if (evt.EmployeeId.HasValue)
                            {
                                await attendanceService.ProcessDailyAttendanceAsync(evt.EmployeeId.Value, evt.DeviceTimestamp.Date, stoppingToken);
                                evt.ProcessingStatus = EventProcessingStatus.Processed;
                                evt.ProcessedAtUtc = DateTime.UtcNow;
                            }
                            else
                            {
                                evt.ProcessingStatus = EventProcessingStatus.PendingLink;
                            }
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "[Attendance.Worker] Error al procesar evento {EventId} para empleado {EmployeeId}", evt.Id, evt.EmployeeId);
                            evt.ProcessingStatus = EventProcessingStatus.Error;
                        }
                    }

                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                _logger.LogInformation("[Attendance.Worker] Cancelación solicitada. Apagando servicio limpiamente.");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[Attendance.Worker] Error inesperado en el ciclo del worker.");
            }

            // Sleep 5 seconds between cycles
            await Task.Delay(5000, stoppingToken);
        }

        _logger.LogInformation("[Attendance.Worker] Servicio en segundo plano detenido.");
    }
}
