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

    /// <summary>
    /// Shared calculation logic for minutes worked, lunch break, late minutes, and overtime.
    /// Used by both automated ingestion and manual supervisor adjustments.
    /// </summary>
    public static void RecalculateDailyMetrics(
        AttendanceDaily daily,
        Schedule? schedule,
        bool isOvernight)
    {
        var expectedEntry = daily.ExpectedEntry ?? schedule?.StartTime ?? new TimeSpan(8, 0, 0);
        var expectedExit = daily.ExpectedExit ?? schedule?.EndTime ?? new TimeSpan(18, 0, 0);
        int tolerance = schedule?.ToleranceMinutes ?? 10;
        int allowedMealMinutes = schedule?.MealDurationMinutes ?? 60;
        int mealTolerance = schedule?.MealToleranceMinutes ?? 5;

        // 1. Minutes Late at Entry
        if (daily.FirstEntry.HasValue)
        {
            var expectedWithTol = expectedEntry.Add(TimeSpan.FromMinutes(tolerance));
            if (daily.FirstEntry.Value > expectedWithTol)
            {
                daily.MinutesLate = (int)(daily.FirstEntry.Value - expectedEntry).TotalMinutes;
            }
            else
            {
                daily.MinutesLate = 0;
            }
        }
        else
        {
            daily.MinutesLate = 0;
        }

        // 2. Meal duration and Meal Return Late Minutes
        if (daily.MealExit.HasValue && daily.MealReturn.HasValue)
        {
            double mealMinutes;
            if (daily.MealReturn.Value < daily.MealExit.Value)
            {
                // Crossing midnight during lunch
                mealMinutes = (daily.MealReturn.Value.Add(TimeSpan.FromHours(24)) - daily.MealExit.Value).TotalMinutes;
            }
            else
            {
                mealMinutes = (daily.MealReturn.Value - daily.MealExit.Value).TotalMinutes;
            }

            daily.MealDurationMinutes = Math.Max(0, (int)mealMinutes);

            if (daily.MealDurationMinutes.Value > allowedMealMinutes + mealTolerance)
            {
                daily.MealMinutesLate = daily.MealDurationMinutes.Value - allowedMealMinutes;
            }
            else
            {
                daily.MealMinutesLate = 0;
            }
        }
        else
        {
            // Reset derived fields when meal punches are cleared/absent
            daily.MealDurationMinutes = null;
            daily.MealMinutesLate = 0;
        }

        // 3. Effective Worked Minutes
        if (daily.FirstEntry.HasValue && daily.LastExit.HasValue)
        {
            double grossMinutes;
            if (isOvernight && daily.LastExit.Value < daily.FirstEntry.Value)
            {
                grossMinutes = (daily.LastExit.Value.Add(TimeSpan.FromHours(24)) - daily.FirstEntry.Value).TotalMinutes;
            }
            else
            {
                grossMinutes = (daily.LastExit.Value - daily.FirstEntry.Value).TotalMinutes;
                if (grossMinutes < 0) grossMinutes += 24 * 60; // Defensive check
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

        // 4. Overtime Calculation
        decimal expectedHoursDecimal;
        if (schedule != null && schedule.ExpectedHours > 0)
        {
            expectedHoursDecimal = schedule.ExpectedHours;
        }
        else
        {
            double grossExpected = isOvernight && expectedExit < expectedEntry
                ? (expectedExit.Add(TimeSpan.FromHours(24)) - expectedEntry).TotalMinutes
                : (expectedExit - expectedEntry).TotalMinutes;

            if (schedule?.HasMealBreak == true)
            {
                grossExpected -= allowedMealMinutes;
            }
            expectedHoursDecimal = Math.Max(0, (decimal)grossExpected / 60m);
        }

        int expectedMinutes = (int)(expectedHoursDecimal * 60m);

        if (daily.MinutesWorked > expectedMinutes)
        {
            daily.OvertimeMinutes = daily.MinutesWorked - expectedMinutes;
        }
        else
        {
            daily.OvertimeMinutes = 0;
        }
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

        var approvedIncidents = await _context.AttendanceIncidents
            .Where(i => i.EmployeeId == employeeId && i.AttendanceDate == targetDate && i.Status == IncidentStatus.Approved)
            .OrderBy(i => i.Id)
            .ToListAsync(cancellationToken);

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

        // Si es Festivo oficial
        if (isHoliday)
        {
            daily.Status = AttendanceStatus.Holiday;
            daily.RequiresReview = false;
            daily.ReviewNotes = "Día Festivo Oficial";
            daily.MinutesWorked = 0;
            daily.MinutesLate = 0;
            daily.OvertimeMinutes = 0;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // Si tiene permiso o vacaciones aprobadas por LeaveRequest
        if (approvedLeave != null)
        {
            daily.Status = approvedLeave.Type == LeaveType.Vacation ? AttendanceStatus.Vacation : AttendanceStatus.Permission;
            daily.RequiresReview = false;
            daily.ReviewNotes = approvedLeave.Reason;
            daily.MinutesWorked = 0;
            daily.MinutesLate = 0;
            daily.OvertimeMinutes = 0;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
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

        var hasMealBreak = schedule?.HasMealBreak ?? true;

        // 7. Filtrado antirrebote inteligente (120 segundos)
        // Solo descarta si es el MISMO movimiento repetido o duplicado en < 120s
        var validEvents = new List<BiometricEvent>();
        foreach (var ev in rawEvents)
        {
            if (validEvents.Count > 0)
            {
                var prev = validEvents.Last();
                var diffSeconds = Math.Abs((ev.DeviceTimestamp - prev.DeviceTimestamp).TotalSeconds);
                if (diffSeconds < 120)
                {
                    // Si ambos tienen el mismo código nativo o ambos son Auto, es un rebote / doble marcación
                    if (ev.NativePunchCode == prev.NativePunchCode || (ev.NativePunchCode == 255 && prev.NativePunchCode == 255))
                    {
                        ev.ClassifiedAs = "ADDITIONAL";
                        continue;
                    }
                }
            }
            validEvents.Add(ev);
        }

        // 8. Inicialización de checadas del día
        daily.FirstEntry = null;
        daily.MealExit = null;
        daily.MealReturn = null;
        daily.LastExit = null;
        daily.RequiresReview = false;
        daily.ReviewNotes = null;

        if (validEvents.Count == 0)
        {
            daily.Status = AttendanceStatus.Absent;
            daily.ReviewNotes = "Inasistencia (Sin registros biométricos)";
            daily.MinutesWorked = 0;
            daily.MinutesLate = 0;
            daily.OvertimeMinutes = 0;

            // Si hay incidencias aprobadas para un día sin checadas (ej. JustifiedAbsence, Vacation, Disability)
            ApplyApprovedIncidents(daily, approvedIncidents, schedule, isOvernight);

            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // Clasificación de checadas:
        // Distinguir y combinar códigos nativos (0=CheckIn, 1=CheckOut, 2=BreakOut, 3=BreakIn) con códigos automáticos (255)
        var nativePunches = validEvents.Where(e => e.NativePunchCode >= 0 && e.NativePunchCode <= 3).ToList();
        var autoPunches = validEvents.Where(e => e.NativePunchCode == 255 || e.NativePunchCode > 3).ToList();

        if (nativePunches.Count > 0)
        {
            daily.ClassificationOrigin = "DEVICE_CODE";

            foreach (var ev in nativePunches)
            {
                var t = ev.DeviceTimestamp.TimeOfDay;
                switch (ev.NativePunchCode)
                {
                    case 0: // CheckIn
                        // Conservar el primer CheckIn del día (evitar que un 2do código 0 sobrescriba la entrada original)
                        if (!daily.FirstEntry.HasValue)
                        {
                            daily.FirstEntry = t;
                            ev.ClassifiedAs = "ENTRY";
                        }
                        else
                        {
                            ev.ClassifiedAs = "ADDITIONAL";
                        }
                        break;

                    case 2: // BreakOut
                        if (!daily.MealExit.HasValue)
                        {
                            daily.MealExit = t;
                            ev.ClassifiedAs = "MEAL_EXIT";
                        }
                        else
                        {
                            ev.ClassifiedAs = "ADDITIONAL";
                        }
                        break;

                    case 3: // BreakIn
                        daily.MealReturn = t;
                        ev.ClassifiedAs = "MEAL_RETURN";
                        break;

                    case 1: // CheckOut
                        // Tomar la última salida registrada con código 1
                        daily.LastExit = t;
                        ev.ClassifiedAs = "EXIT";
                        break;

                    default:
                        ev.ClassifiedAs = "ADDITIONAL";
                        break;
                }
            }

            // Si quedaron huecos y hay checadas automáticas (255) mezcladas:
            if (!daily.FirstEntry.HasValue && autoPunches.Count > 0)
            {
                var firstAuto = autoPunches.First();
                daily.FirstEntry = firstAuto.DeviceTimestamp.TimeOfDay;
                firstAuto.ClassifiedAs = "ENTRY";
                autoPunches.RemoveAt(0);
            }

            if (!daily.LastExit.HasValue && autoPunches.Count > 0)
            {
                var lastAuto = autoPunches.Last();
                var expectedThreshold = daily.ExpectedExit.Value.Subtract(TimeSpan.FromHours(2.5));
                if (lastAuto.DeviceTimestamp.TimeOfDay >= expectedThreshold)
                {
                    daily.LastExit = lastAuto.DeviceTimestamp.TimeOfDay;
                    lastAuto.ClassifiedAs = "EXIT";
                    autoPunches.Remove(lastAuto);
                }
            }

            foreach (var remaining in autoPunches)
            {
                remaining.ClassifiedAs = "ADDITIONAL";
            }
        }
        else
        {
            // Inferencia inteligente secuencial por horario (todos los eventos son Auto = 255)
            daily.ClassificationOrigin = "INFERRED_WINDOW";

            if (!hasMealBreak)
            {
                // Turno continuo sin comida
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
                        daily.ReviewNotes = $"Marcaciones intermedias detectadas ({validEvents.Count} checadas)";
                    }
                }
            }
            else
            {
                // Turno con descanso de comida esperado
                if (validEvents.Count == 1)
                {
                    daily.FirstEntry = validEvents[0].DeviceTimestamp.TimeOfDay;
                    validEvents[0].ClassifiedAs = "ENTRY";
                    daily.RequiresReview = true;
                    daily.ReviewNotes = "Jornada incompleta: solo se registró el ingreso (sin salida visible)";
                }
                else if (validEvents.Count == 4)
                {
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
                        // La 2da checada ocurrió al final del turno: omitió comida
                        daily.LastExit = secondPunch;
                        validEvents[1].ClassifiedAs = "EXIT";
                        daily.RequiresReview = true;
                        daily.ReviewNotes = "Omitió checadas de comida (ingreso y salida directa)";
                    }
                    else
                    {
                        // Ambas checadas ocurrieron temprano o a mediodía (ej. 09:44 y 09:55)
                        // No asumir que 09:55 es salida definitiva; clasificar como intermedia e incompleta
                        validEvents[1].ClassifiedAs = "ADDITIONAL";
                        daily.RequiresReview = true;
                        daily.ReviewNotes = "Jornada incompleta: marcaciones concentradas al ingreso sin salida del turno";
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

                        var midPunch = validEvents[1].DeviceTimestamp.TimeOfDay;
                        var mealMiddle = daily.ExpectedMealStart.HasValue && daily.ExpectedMealEnd.HasValue
                            ? TimeSpan.FromTicks((daily.ExpectedMealStart.Value.Ticks + daily.ExpectedMealEnd.Value.Ticks) / 2)
                            : new TimeSpan(14, 30, 0);

                        if (midPunch < mealMiddle)
                        {
                            daily.MealExit = midPunch;
                            validEvents[1].ClassifiedAs = "MEAL_EXIT";
                            daily.RequiresReview = true;
                            daily.ReviewNotes = "Secuencia incompleta (3 marcaciones): falta checada de regreso de comer (comida)";
                        }
                        else
                        {
                            daily.MealReturn = midPunch;
                            validEvents[1].ClassifiedAs = "MEAL_RETURN";
                            daily.RequiresReview = true;
                            daily.ReviewNotes = "Secuencia incompleta (3 marcaciones): falta checada de salida a comer (comida)";
                        }
                    }
                    else
                    {
                        // Las 3 marcaciones fueron matutinas/mediodía: falta salida
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
                    daily.ReviewNotes = $"Marcaciones adicionales detectadas ({validEvents.Count} checadas)";
                }
            }
        }

        // 9. Cálculo unificado de métricas
        RecalculateDailyMetrics(daily, schedule, isOvernight);

        // 10. Asignación inicial de estado
        if (!daily.FirstEntry.HasValue || !daily.LastExit.HasValue)
        {
            daily.Status = AttendanceStatus.Incomplete;
        }
        else
        {
            bool isEarlyExit = (!isOvernight && daily.LastExit.Value < daily.ExpectedExit.Value.Subtract(TimeSpan.FromMinutes(15)))
                || (isOvernight && daily.LastExit.Value < daily.ExpectedExit.Value.Subtract(TimeSpan.FromMinutes(15)) && daily.LastExit.Value > daily.FirstEntry.Value);

            if (daily.MinutesLate > 0 && isEarlyExit)
            {
                // Ambos coexisten: asignar Late y registrar observación de salida anticipada sin perder ninguna condición
                daily.Status = AttendanceStatus.Late;
                daily.ReviewNotes = string.IsNullOrEmpty(daily.ReviewNotes)
                    ? $"Retardo de {daily.MinutesLate} min y salida anticipada a las {daily.LastExit:hh\\:mm}"
                    : $"{daily.ReviewNotes} | Retardo ({daily.MinutesLate}m) y salida anticipada";
            }
            else if (daily.MinutesLate > 0)
            {
                daily.Status = AttendanceStatus.Late;
            }
            else if (isEarlyExit)
            {
                daily.Status = AttendanceStatus.EarlyExit;
            }
            else
            {
                daily.Status = AttendanceStatus.OnTime;
            }
        }

        // 11. Aplicación real de TODAS las incidencias aprobadas
        ApplyApprovedIncidents(daily, approvedIncidents, schedule, isOvernight);

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("[AttendanceProcessing] Empleado {EmpId} @ {Date:yyyy-MM-dd} -> Estado: {Status}, Trabajado: {Worked}m, Retardo: {Late}m, ReqReview: {Review}",
            employeeId, targetDate, daily.Status, daily.MinutesWorked, daily.MinutesLate, daily.RequiresReview);

        return daily;
    }

    /// <summary>
    /// Aplica el efecto de todas las incidencias aprobadas para la jornada según su tipo.
    /// </summary>
    private static void ApplyApprovedIncidents(
        AttendanceDaily daily,
        List<AttendanceIncident> approvedIncidents,
        Schedule? schedule,
        bool isOvernight)
    {
        if (approvedIncidents.Count == 0) return;

        bool metricsNeedRecalculation = false;

        foreach (var incident in approvedIncidents)
        {
            switch (incident.Type)
            {
                case IncidentType.PunchMiss:
                    // Omisión de checada: si se especificó hora y tipo de movimiento, aplicarla
                    if (incident.PunchTime.HasValue && incident.PunchMovementType.HasValue)
                    {
                        switch (incident.PunchMovementType.Value)
                        {
                            case BiometricEventType.Entry:
                                daily.FirstEntry = incident.PunchTime.Value;
                                break;
                            case BiometricEventType.MealExit:
                                daily.MealExit = incident.PunchTime.Value;
                                break;
                            case BiometricEventType.MealReturn:
                                daily.MealReturn = incident.PunchTime.Value;
                                break;
                            case BiometricEventType.Exit:
                                daily.LastExit = incident.PunchTime.Value;
                                break;
                        }
                        metricsNeedRecalculation = true;
                        daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Checada {incident.PunchMovementType} omitida justificada por {incident.ApprovedBy} ({incident.PunchTime:hh\\:mm})");
                    }
                    break;

                case IncidentType.JustifiedLate:
                    // Retardo justificado: exonerar penalización de retardo
                    daily.MinutesLate = Math.Max(0, daily.MinutesLate - (incident.Minutes > 0 ? incident.Minutes : daily.MinutesLate));
                    if (daily.Status == AttendanceStatus.Late && daily.MinutesLate == 0)
                    {
                        daily.Status = AttendanceStatus.OnTime;
                    }
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Retardo justificado por {incident.ApprovedBy}: {incident.Description}");
                    break;

                case IncidentType.JustifiedAbsence:
                    daily.Status = AttendanceStatus.Permission;
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Falta justificada por {incident.ApprovedBy}: {incident.Description}");
                    break;

                case IncidentType.Permission:
                    daily.Status = AttendanceStatus.Permission;
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Permiso autorizado por {incident.ApprovedBy}: {incident.Description}");
                    break;

                case IncidentType.Vacation:
                    daily.Status = AttendanceStatus.Vacation;
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Vacaciones autorizadas por {incident.ApprovedBy}: {incident.Description}");
                    break;

                case IncidentType.Disability:
                    daily.Status = AttendanceStatus.Disability;
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Incapacidad médica aprobada por {incident.ApprovedBy}: {incident.Description}");
                    break;

                case IncidentType.HomeOffice:
                    daily.Status = AttendanceStatus.OnTime;
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Home Office autorizado por {incident.ApprovedBy}: {incident.Description}");
                    break;

                case IncidentType.FieldWork:
                    daily.Status = AttendanceStatus.OnTime;
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Trabajo en campo autorizado por {incident.ApprovedBy}: {incident.Description}");
                    break;

                case IncidentType.ScheduleCorrection:
                    metricsNeedRecalculation = true;
                    daily.ReviewNotes = AppendNote(daily.ReviewNotes, $"Corrección de horario autorizada por {incident.ApprovedBy}: {incident.Description}");
                    break;
            }
        }

        if (metricsNeedRecalculation)
        {
            RecalculateDailyMetrics(daily, schedule, isOvernight);

            // Re-evaluar estado si se completaron las checadas
            if (daily.FirstEntry.HasValue && daily.LastExit.HasValue && daily.Status == AttendanceStatus.Incomplete)
            {
                daily.Status = daily.MinutesLate > 0 ? AttendanceStatus.Late : AttendanceStatus.OnTime;
            }
        }
    }

    private static string AppendNote(string? current, string addition)
    {
        if (string.IsNullOrWhiteSpace(current)) return addition;
        return $"{current} | {addition}";
    }

    public async Task<AttendanceDaily> UpdateManualAttendanceAsync(long attendanceDailyId, ManualAttendanceUpdateRequest request, CancellationToken cancellationToken = default)
    {
        var daily = await _context.AttendanceDailies
            .Include(a => a.Employee)
                .ThenInclude(e => e.EmployeeSchedules)
                    .ThenInclude(es => es.Schedule)
            .FirstOrDefaultAsync(a => a.Id == attendanceDailyId, cancellationToken);

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

        var schedule = daily.Employee?.EmployeeSchedules
            .Where(es => es.ValidFrom.Date <= daily.Date.Date && (!es.ValidTo.HasValue || es.ValidTo.Value.Date >= daily.Date.Date))
            .OrderByDescending(es => es.ValidFrom)
            .Select(es => es.Schedule)
            .FirstOrDefault();

        bool isOvernight = schedule != null && (schedule.IsOvernight || schedule.StartTime > schedule.EndTime);

        // Recalcular métricas de forma integral con la lógica compartida
        RecalculateDailyMetrics(daily, schedule, isOvernight);

        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<AttendanceStatus>(request.Status, true, out var st))
        {
            daily.Status = st;
        }
        else
        {
            // Auto-asignar estado adecuado con base en los nuevos valores manuales
            if (!daily.FirstEntry.HasValue || !daily.LastExit.HasValue)
            {
                daily.Status = AttendanceStatus.Incomplete;
            }
            else if (daily.MinutesLate > 0)
            {
                daily.Status = AttendanceStatus.Late;
            }
            else
            {
                daily.Status = AttendanceStatus.OnTime;
            }
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
