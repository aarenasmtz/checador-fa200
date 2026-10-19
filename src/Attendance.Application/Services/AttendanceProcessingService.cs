using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Attendance.Application.Services;

public record ManualAttendanceUpdateRequest(
    TimeSpan? FirstEntry,
    TimeSpan? MealExit,
    TimeSpan? MealReturn,
    TimeSpan? LastExit,
    string? Status,
    string ModificationReason,
    string ModifiedBy
);

public interface IAttendanceProcessingService
{
    Task<AttendanceDaily> ProcessDailyAttendanceAsync(int employeeId, DateTime date, CancellationToken cancellationToken = default);
    Task<int> ReprocessAsync(int? employeeId, int? branchId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
    Task<AttendanceDaily> UpdateManualAttendanceAsync(long attendanceDailyId, ManualAttendanceUpdateRequest request, CancellationToken cancellationToken = default);
}

public class AttendanceProcessingService : IAttendanceProcessingService
{
    private readonly IAppDbContext _context;
    private readonly ILogger<AttendanceProcessingService> _logger;

    public AttendanceProcessingService(IAppDbContext context, ILogger<AttendanceProcessingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<AttendanceDaily> ProcessDailyAttendanceAsync(int employeeId, DateTime date, CancellationToken cancellationToken = default)
    {
        var targetDate = date.Date;

        var employee = await _context.Employees
            .Include(e => e.EmployeeSchedules)
                .ThenInclude(es => es.Schedule)
                    .ThenInclude(s => s.WorkDays)
            .FirstOrDefaultAsync(e => e.Id == employeeId, cancellationToken);

        if (employee == null)
        {
            throw new ArgumentException($"Empleado {employeeId} no encontrado.");
        }

        // 1. Fetch active schedule for this date
        var schedule = employee.EmployeeSchedules
            .Where(es => es.ValidFrom.Date <= targetDate && (!es.ValidTo.HasValue || es.ValidTo.Value.Date >= targetDate))
            .OrderByDescending(es => es.ValidFrom)
            .Select(es => es.Schedule)
            .FirstOrDefault();

        // Si no hay horario asignado, usar horario base por defecto
        bool isOvernight = schedule != null && (schedule.IsOvernight || schedule.StartTime > schedule.EndTime);

        // 2. Definir ventana de búsqueda de marcaciones biométricas
        DateTime searchStart;
        DateTime searchEnd;

        if (isOvernight && schedule != null)
        {
            searchStart = targetDate.Add(schedule.StartTime).AddHours(-3);
            searchEnd = targetDate.AddDays(1).Add(schedule.EndTime).AddHours(4);
        }
        else
        {
            searchStart = targetDate;
            searchEnd = targetDate.AddDays(1);
        }

        var rawEvents = await _context.BiometricEvents
            .Where(e => e.EmployeeId == employeeId && e.DeviceTimestamp >= searchStart && e.DeviceTimestamp < searchEnd)
            .OrderBy(e => e.DeviceTimestamp)
            .ToListAsync(cancellationToken);

        // 3. Verificar días festivos, permisos o incapacidades aprobadas
        var isHoliday = await _context.Holidays
            .AnyAsync(h => h.CompanyId == employee.CompanyId && h.Date == targetDate, cancellationToken);

        var approvedIncident = await _context.AttendanceIncidents
            .FirstOrDefaultAsync(i => i.EmployeeId == employeeId && i.AttendanceDate == targetDate && i.Status == IncidentStatus.Approved, cancellationToken);

        var approvedLeave = await _context.LeaveRequests
            .FirstOrDefaultAsync(l => l.EmployeeId == employeeId && l.StartDate <= targetDate && l.EndDate >= targetDate && l.Status == IncidentStatus.Approved, cancellationToken);

        // 4. Obtener o crear AttendanceDaily
        var daily = await _context.AttendanceDailies
            .FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.Date == targetDate, cancellationToken);

        if (daily == null)
        {
            daily = new AttendanceDaily
            {
                EmployeeId = employeeId,
                Date = targetDate,
                CreatedAt = DateTime.UtcNow
            };
            _context.AttendanceDailies.Add(daily);
        }

        daily.UpdatedAt = DateTime.UtcNow;

        // Si ya fue sobreescrito manualmente por un supervisor, respetar la corrección manual y no sobreescribir con el cálculo automático
        if (daily.IsManualOverride)
        {
            _logger.LogInformation("[AttendanceProcessing] Asistencia {DailyId} tiene IsManualOverride = true. Respetando decisión manual.", daily.Id);
            return daily;
        }

        // Si es Festivo
        if (isHoliday)
        {
            daily.Status = AttendanceStatus.Holiday;
            daily.RequiresReview = false;
            daily.ReviewNotes = "Día Festivo Oficial";
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // Si tiene permiso o vacaciones
        if (approvedLeave != null)
        {
            daily.Status = approvedLeave.Type == LeaveType.Vacation ? AttendanceStatus.Vacation : AttendanceStatus.Permission;
            daily.RequiresReview = false;
            daily.ReviewNotes = approvedLeave.Reason;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        if (approvedIncident != null)
        {
            if (approvedIncident.Type == IncidentType.Disability)
                daily.Status = AttendanceStatus.Disability;
            else if (approvedIncident.Type == IncidentType.Vacation)
                daily.Status = AttendanceStatus.Vacation;
            else if (approvedIncident.Type == IncidentType.JustifiedAbsence)
                daily.Status = AttendanceStatus.Permission;
        }

        // 5. Verificar si hoy es día laboral para el horario
        var dayOfWeek = targetDate.DayOfWeek;
        var workDayConfig = schedule?.WorkDays.FirstOrDefault(w => w.DayOfWeek == dayOfWeek);
        var isWorkingDay = workDayConfig?.IsWorkingDay ?? (dayOfWeek != DayOfWeek.Sunday);

        if (!isWorkingDay)
        {
            daily.Status = AttendanceStatus.RestDay;
            daily.MinutesWorked = 0;
            daily.MinutesLate = 0;
            daily.OvertimeMinutes = 0;
            daily.RequiresReview = false;
            daily.ReviewNotes = "Día de Descanso Programado";
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // 6. Horas esperadas del turno
        daily.ExpectedEntry = schedule?.StartTime ?? new TimeSpan(8, 0, 0);
        daily.ExpectedExit = schedule?.EndTime ?? new TimeSpan(18, 0, 0);
        daily.ExpectedMealStart = schedule?.HasMealBreak == true ? schedule.MealStartTime : null;
        daily.ExpectedMealEnd = schedule?.HasMealBreak == true ? schedule.MealEndTime : null;

        var tolerance = schedule?.ToleranceMinutes ?? 10;
        var hasMealBreak = schedule?.HasMealBreak ?? true;

        // 7. Filtrado de rebotes / marcaciones repetidas (Anti-Bounce: < 120 segundos)
        var validEvents = new List<BiometricEvent>();
        foreach (var ev in rawEvents)
        {
            if (validEvents.Count > 0)
            {
                var diffSeconds = Math.Abs((ev.DeviceTimestamp - validEvents.Last().DeviceTimestamp).TotalSeconds);
                if (diffSeconds < 120)
                {
                    ev.ClassifiedAs = "ADDITIONAL";
                    continue;
                }
            }
            validEvents.Add(ev);
        }

        // 8. Clasificación de las Checadas
        daily.FirstEntry = null;
        daily.MealExit = null;
        daily.MealReturn = null;
        daily.LastExit = null;
        daily.MealDurationMinutes = null;
        daily.MealMinutesLate = 0;
        daily.RequiresReview = false;
        daily.ReviewNotes = null;

        if (validEvents.Count == 0)
        {
            if (approvedIncident == null && approvedLeave == null)
            {
                daily.Status = AttendanceStatus.Absent;
                daily.ReviewNotes = "Inasistencia (Sin registros biométricos)";
            }
            daily.MinutesWorked = 0;
            daily.MinutesLate = 0;
            daily.OvertimeMinutes = 0;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // Verificar si los eventos tienen código nativo explícito (0=CheckIn, 2=BreakOut, 3=BreakIn, 1=CheckOut)
        bool hasNativeCodes = validEvents.Any(e => e.NativePunchCode >= 0 && e.NativePunchCode <= 3);

        if (hasNativeCodes)
        {
            daily.ClassificationOrigin = "DEVICE_CODE";
            foreach (var ev in validEvents)
            {
                var t = ev.DeviceTimestamp.TimeOfDay;
                switch (ev.NativePunchCode)
                {
                    case 0: // CheckIn
                        daily.FirstEntry = t;
                        ev.ClassifiedAs = "ENTRY";
                        break;
                    case 2: // BreakOut
                        daily.MealExit = t;
                        ev.ClassifiedAs = "MEAL_EXIT";
                        break;
                    case 3: // BreakIn
                        daily.MealReturn = t;
                        ev.ClassifiedAs = "MEAL_RETURN";
                        break;
                    case 1: // CheckOut
                        daily.LastExit = t;
                        ev.ClassifiedAs = "EXIT";
                        break;
                    default:
                        ev.ClassifiedAs = "ADDITIONAL";
                        break;
                }
            }
        }
        else
        {
            // Clasificación Inferencia Inteligente por Horario y Secuencia (NativePunchCode = 255 Auto)
            daily.ClassificationOrigin = "INFERRED_WINDOW";

            if (!hasMealBreak)
            {
                // Turno continuo sin comida (ej. turno de 6 u 8 horas corridas)
                if (validEvents.Count == 1)
                {
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    validEvents[0].ClassifiedAs = "ENTRY";
                    daily.RequiresReview = true;
                    daily.ReviewNotes = "Jornada incompleta: falta salida del turno";
                }
                else
                {
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    daily.LastExit = validEvents.Last().DeviceTimestamp.TimeOfDay;
                    validEvents[0].ClassifiedAs = "ENTRY";
                    validEvents.Last().ClassifiedAs = "EXIT";

                    for (int i = 1; i < validEvents.Count - 1; i++)
                    {
                        validEvents[i].ClassifiedAs = "ADDITIONAL";
                    }

                    if (validEvents.Count > 2)
                    {
                        daily.RequiresReview = true;
                        daily.ReviewNotes = $"Marcaciones intermedias detectadas ({validEvents.Count} checadas en turno continuo)";
                    }
                }
            }
            else
            {
                // Turno con salida a comer esperada
                if (validEvents.Count == 1)
                {
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    validEvents[0].ClassifiedAs = "ENTRY";
                    daily.RequiresReview = true;
                    daily.ReviewNotes = "Jornada incompleta: solo se registró el ingreso";
                }
                else if (validEvents.Count == 4)
                {
                    // Secuencia limpia estándar completa
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    daily.MealExit = validEvents[1].DeviceTimestamp.TimeOfDay;
                    daily.MealReturn = validEvents[2].DeviceTimestamp.TimeOfDay;
                    daily.LastExit = validEvents[3].DeviceTimestamp.TimeOfDay;

                    validEvents[0].ClassifiedAs = "ENTRY";
                    validEvents[1].ClassifiedAs = "MEAL_EXIT";
                    validEvents[2].ClassifiedAs = "MEAL_RETURN";
                    validEvents[3].ClassifiedAs = "EXIT";
                }
                else if (validEvents.Count == 2)
                {
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    validEvents[0].ClassifiedAs = "ENTRY";

                    var secondPunch = validEvents[1].DeviceTimestamp.TimeOfDay;
                    var expectedExitThreshold = daily.ExpectedExit.Value.Subtract(TimeSpan.FromHours(2.5));

                    if (secondPunch >= expectedExitThreshold)
                    {
                        // Omitió comer o no checó comida: checada 2 corresponde a salida
                        daily.LastExit = secondPunch;
                        validEvents[1].ClassifiedAs = "EXIT";
                        daily.RequiresReview = true;
                        daily.ReviewNotes = "Omitió checadas de comida (solo registró ingreso y salida)";
                    }
                    else
                    {
                        // La 2da checada ocurrió a mediodía: salió a comer y no regresó / no checó salida
                        daily.MealExit = secondPunch;
                        validEvents[1].ClassifiedAs = "MEAL_EXIT";
                        daily.RequiresReview = true;
                        daily.ReviewNotes = "Falta regreso de comida y salida de turno";
                    }
                }
                else if (validEvents.Count == 3)
                {
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    validEvents[0].ClassifiedAs = "ENTRY";

                    var thirdPunch = validEvents[2].DeviceTimestamp.TimeOfDay;
                    var expectedExitThreshold = daily.ExpectedExit.Value.Subtract(TimeSpan.FromHours(2.5));

                    if (thirdPunch >= expectedExitThreshold)
                    {
                        daily.LastExit = thirdPunch;
                        validEvents[2].ClassifiedAs = "EXIT";

                        // El del medio: ¿salida a comer o regreso de comer?
                        var midPunch = validEvents[1].DeviceTimestamp.TimeOfDay;
                        var mealMiddle = daily.ExpectedMealStart.HasValue && daily.ExpectedMealEnd.HasValue
                            ? TimeSpan.FromTicks((daily.ExpectedMealStart.Value.Ticks + daily.ExpectedMealEnd.Value.Ticks) / 2)
                            : new TimeSpan(14, 30, 0);

                        if (midPunch < mealMiddle)
                        {
                            daily.MealExit = midPunch;
                            validEvents[1].ClassifiedAs = "MEAL_EXIT";
                            daily.RequiresReview = true;
                            daily.ReviewNotes = "Secuencia incompleta (3 marcaciones): falta checada de regreso de comer";
                        }
                        else
                        {
                            daily.MealReturn = midPunch;
                            validEvents[1].ClassifiedAs = "MEAL_RETURN";
                            daily.RequiresReview = true;
                            daily.ReviewNotes = "Secuencia incompleta (3 marcaciones): falta checada de salida a comer";
                        }
                    }
                    else
                    {
                        // Las 3 checadas fueron matutinas/mediodía: falta salida
                        daily.MealExit = validEvents[1].DeviceTimestamp.TimeOfDay;
                        daily.MealReturn = validEvents[2].DeviceTimestamp.TimeOfDay;
                        validEvents[1].ClassifiedAs = "MEAL_EXIT";
                        validEvents[2].ClassifiedAs = "MEAL_RETURN";
                        daily.RequiresReview = true;
                        daily.ReviewNotes = "Falta checada de salida del turno";
                    }
                }
                else
                {
                    // 5 o más marcaciones
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    daily.LastExit = validEvents.Last().DeviceTimestamp.TimeOfDay;
                    validEvents[0].ClassifiedAs = "ENTRY";
                    validEvents.Last().ClassifiedAs = "EXIT";

                    daily.MealExit = validEvents[1].DeviceTimestamp.TimeOfDay;
                    daily.MealReturn = validEvents[2].DeviceTimestamp.TimeOfDay;
                    validEvents[1].ClassifiedAs = "MEAL_EXIT";
                    validEvents[2].ClassifiedAs = "MEAL_RETURN";

                    for (int i = 3; i < validEvents.Count - 1; i++)
                    {
                        validEvents[i].ClassifiedAs = "ADDITIONAL";
                    }

                    daily.RequiresReview = true;
                    daily.ReviewNotes = $"Marcaciones adicionales detectadas ({validEvents.Count} checadas): requiere validación";
                }
            }
        }

        // 9. Cálculos de Minutos y Tiempos
        // Retardo al ingreso
        if (daily.FirstEntry.HasValue)
        {
            var expectedWithTol = daily.ExpectedEntry.Value.Add(TimeSpan.FromMinutes(tolerance));
            if (daily.FirstEntry.Value > expectedWithTol)
            {
                daily.MinutesLate = (int)(daily.FirstEntry.Value - daily.ExpectedEntry.Value).TotalMinutes;
            }
            else
            {
                daily.MinutesLate = 0;
            }
        }

        // Comida y retardo en regreso de comida
        if (daily.MealExit.HasValue && daily.MealReturn.HasValue)
        {
            int mealMinutes = (int)(daily.MealReturn.Value - daily.MealExit.Value).TotalMinutes;
            daily.MealDurationMinutes = Math.Max(0, mealMinutes);

            int allowedMeal = schedule?.MealDurationMinutes ?? 60;
            int mealTol = schedule?.MealToleranceMinutes ?? 5;

            if (daily.MealDurationMinutes.Value > allowedMeal + mealTol)
            {
                daily.MealMinutesLate = daily.MealDurationMinutes.Value - allowedMeal;
            }
        }

        // Minutos trabajados netos
        if (daily.FirstEntry.HasValue && daily.LastExit.HasValue)
        {
            double grossMinutes;
            if (isOvernight && daily.LastExit.Value < daily.FirstEntry.Value)
            {
                // Cruce de medianoche
                grossMinutes = (daily.LastExit.Value.Add(TimeSpan.FromHours(24)) - daily.FirstEntry.Value).TotalMinutes;
            }
            else
            {
                grossMinutes = (daily.LastExit.Value - daily.FirstEntry.Value).TotalMinutes;
            }

            if (daily.MealDurationMinutes.HasValue)
            {
                daily.MinutesWorked = Math.Max(0, (int)(grossMinutes - daily.MealDurationMinutes.Value));
            }
            else
            {
                daily.MinutesWorked = Math.Max(0, (int)grossMinutes);
            }
        }
        else
        {
            daily.MinutesWorked = 0;
        }

        // Horas extras
        var defaultExpectedHours = (decimal)(daily.ExpectedExit.Value - daily.ExpectedEntry.Value).TotalHours;
        var expectedDecimal = (schedule != null && schedule.ExpectedHours > 0) ? schedule.ExpectedHours : defaultExpectedHours;
        var expectedMinutes = (int)(expectedDecimal * 60);

        if (daily.MinutesWorked > expectedMinutes)
        {
            daily.OvertimeMinutes = daily.MinutesWorked - expectedMinutes;
        }
        else
        {
            daily.OvertimeMinutes = 0;
        }

        // 10. Asignación de Estado de Asistencia
        if (!daily.FirstEntry.HasValue || !daily.LastExit.HasValue)
        {
            daily.Status = AttendanceStatus.Incomplete;
        }
        else if (daily.MinutesLate > 0)
        {
            daily.Status = AttendanceStatus.Late;
        }
        else if (!isOvernight && daily.LastExit.Value < daily.ExpectedExit.Value.Subtract(TimeSpan.FromMinutes(15)))
        {
            daily.Status = AttendanceStatus.EarlyExit;
        }
        else if (isOvernight && (daily.LastExit.Value < daily.ExpectedExit.Value.Subtract(TimeSpan.FromMinutes(15)) && daily.LastExit.Value > daily.FirstEntry.Value))
        {
            daily.Status = AttendanceStatus.EarlyExit;
        }
        else
        {
            daily.Status = AttendanceStatus.OnTime;
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("[AttendanceProcessing] Empleado {EmpId} @ {Date:yyyy-MM-dd} -> Estado: {Status}, Trabajado: {Worked}m, Retardo: {Late}m, Comida: {Meal}m, ReqReview: {Review} ({Notes})",
            employeeId, targetDate, daily.Status, daily.MinutesWorked, daily.MinutesLate, daily.MealDurationMinutes, daily.RequiresReview, daily.ReviewNotes);

        return daily;
    }

    public async Task<AttendanceDaily> UpdateManualAttendanceAsync(long attendanceDailyId, ManualAttendanceUpdateRequest request, CancellationToken cancellationToken = default)
    {
        var daily = await _context.AttendanceDailies.FindAsync(new object[] { attendanceDailyId }, cancellationToken);
        if (daily == null) throw new ArgumentException("Registro de asistencia no encontrado.");

        daily.OriginalStatus ??= daily.Status;
        daily.FirstEntry = request.FirstEntry;
        daily.MealExit = request.MealExit;
        daily.MealReturn = request.MealReturn;
        daily.LastExit = request.LastExit;

        daily.IsManualOverride = true;
        daily.ClassificationOrigin = "MANUAL_OVERRIDE";
        daily.ModifiedBy = request.ModifiedBy;
        daily.ModifiedAt = DateTime.UtcNow;
        daily.ModificationReason = request.ModificationReason;
        daily.RequiresReview = false;
        daily.ReviewNotes = $"Ajuste manual autorizado por {request.ModifiedBy}: {request.ModificationReason}";

        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<AttendanceStatus>(request.Status, true, out var st))
        {
            daily.Status = st;
        }

        // Recalcular minutos con los valores manuales
        if (daily.MealExit.HasValue && daily.MealReturn.HasValue)
        {
            daily.MealDurationMinutes = Math.Max(0, (int)(daily.MealReturn.Value - daily.MealExit.Value).TotalMinutes);
        }

        if (daily.FirstEntry.HasValue && daily.LastExit.HasValue)
        {
            double gross = (daily.LastExit.Value - daily.FirstEntry.Value).TotalMinutes;
            if (gross < 0) gross += 24 * 60; // cruce medianoche

            daily.MinutesWorked = Math.Max(0, (int)(gross - (daily.MealDurationMinutes ?? 0)));
        }

        await _context.SaveChangesAsync(cancellationToken);
        return daily;
    }

    public async Task<int> ReprocessAsync(int? employeeId, int? branchId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default)
    {
        var start = startDate.Date;
        var end = endDate.Date;

        var employeesQuery = _context.Employees.AsQueryable();
        if (employeeId.HasValue)
            employeesQuery = employeesQuery.Where(e => e.Id == employeeId.Value);
        if (branchId.HasValue)
            employeesQuery = employeesQuery.Where(e => e.BranchId == branchId.Value);

        var employeeIds = await employeesQuery.Select(e => e.Id).ToListAsync(cancellationToken);
        int totalProcessed = 0;

        for (var d = start; d <= end; d = d.AddDays(1))
        {
            foreach (var empId in employeeIds)
            {
                await ProcessDailyAttendanceAsync(empId, d, cancellationToken);
                totalProcessed++;
            }
        }

        return totalProcessed;
    }
}
