using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;
using System.Security.Claims;
using System.Text.Json;

namespace Attendance.Api.Controllers;

public record ReprocessRequest(
    int? EmployeeId = null,
    int? BranchId = null,
    DateTime? StartDate = null,
    DateTime? EndDate = null,
    DateTime? Date = null
);

public class UpdateAttendanceStatusRequest
{
    public string Estado { get; set; } = string.Empty;
    public string? Observacion { get; set; }

    public UpdateAttendanceStatusRequest() { }
    public UpdateAttendanceStatusRequest(string estado, string? observacion = null)
    {
        Estado = estado;
        Observacion = observacion;
    }
}

[ApiController]
[Route("api/v1/attendance")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly IAppDbContext _context;
    private readonly IAttendanceProcessingService _attendanceProcessingService;

    public AttendanceController(IAppDbContext context, IAttendanceProcessingService attendanceProcessingService)
    {
        _context = context;
        _attendanceProcessingService = attendanceProcessingService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAttendanceRecords(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null)
    {
        var query = _context.AttendanceDailies
            .Include(a => a.Employee)
                .ThenInclude(e => e.Branch)
            .Include(a => a.Employee)
                .ThenInclude(e => e.Department)
            .AsNoTracking();

        if (startDate.HasValue)
            query = query.Where(a => a.Date >= startDate.Value.Date);

        if (endDate.HasValue)
            query = query.Where(a => a.Date <= endDate.Value.Date);

        if (branchId.HasValue)
            query = query.Where(a => a.Employee.BranchId == branchId.Value);

        if (departmentId.HasValue)
            query = query.Where(a => a.Employee.DepartmentId == departmentId.Value);

        if (employeeId.HasValue)
            query = query.Where(a => a.EmployeeId == employeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<AttendanceStatus>(status, true, out var attStatus))
            query = query.Where(a => a.Status == attStatus);

        var totalRecords = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.Date)
                .ThenBy(a => a.Employee.EmployeeCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.EmployeeId,
                a.Employee.EmployeeCode,
                EmployeeName = $"{a.Employee.FirstName} {a.Employee.LastName}",
                BranchName = a.Employee.Branch.Name,
                DepartmentName = a.Employee.Department != null ? a.Employee.Department.Name : null,
                Date = a.Date.ToString("yyyy-MM-dd"),
                FirstEntry = a.FirstEntry.HasValue ? a.FirstEntry.Value.ToString(@"hh\:mm") : null,
                MealExit = a.MealExit.HasValue ? a.MealExit.Value.ToString(@"hh\:mm") : null,
                MealReturn = a.MealReturn.HasValue ? a.MealReturn.Value.ToString(@"hh\:mm") : null,
                LastExit = a.LastExit.HasValue ? a.LastExit.Value.ToString(@"hh\:mm") : null,
                ExpectedEntry = a.ExpectedEntry.HasValue ? a.ExpectedEntry.Value.ToString(@"hh\:mm") : null,
                ExpectedExit = a.ExpectedExit.HasValue ? a.ExpectedExit.Value.ToString(@"hh\:mm") : null,
                a.MinutesLate,
                a.MinutesWorked,
                a.OvertimeMinutes,
                Status = a.Status.ToString()
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize)
        });
    }

    [HttpGet("today")]
    public async Task<IActionResult> GetTodaySummary()
    {
        var today = DateTime.UtcNow.Date;

        var records = await _context.AttendanceDailies
            .Where(a => a.Date == today)
            .ToListAsync();

        return Ok(new
        {
            date = today.ToString("yyyy-MM-dd"),
            total = records.Count,
            onTime = records.Count(r => r.Status == AttendanceStatus.OnTime),
            late = records.Count(r => r.Status == AttendanceStatus.Late),
            earlyExit = records.Count(r => r.Status == AttendanceStatus.EarlyExit),
            absent = records.Count(r => r.Status == AttendanceStatus.Absent),
            incomplete = records.Count(r => r.Status == AttendanceStatus.Incomplete)
        });
    }

    [HttpGet("raw-events")]
    public async Task<IActionResult> GetRawEvents(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? deviceId = null)
    {
        var query = _context.BiometricEvents
            .Include(e => e.Employee)
            .Include(e => e.Device)
                .ThenInclude(d => d.Branch)
            .AsNoTracking();

        if (employeeId.HasValue)
            query = query.Where(e => e.EmployeeId == employeeId.Value);

        if (deviceId.HasValue)
            query = query.Where(e => e.DeviceId == deviceId.Value);

        var totalRecords = await query.CountAsync();
        var items = await query
            .OrderByDescending(e => e.DeviceTimestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new
            {
                e.Id,
                e.DeviceId,
                DeviceCode = e.Device.Code,
                DeviceName = e.Device.Name,
                BranchName = e.Device.Branch.Name,
                e.EmployeeId,
                EmployeeCode = e.Employee != null ? e.Employee.EmployeeCode : (e.UserClockId ?? "PENDIENTE"),
                EmployeeName = e.Employee != null ? $"{e.Employee.FirstName} {e.Employee.LastName}" : $"Sin vincular (ID Reloj: {e.UserClockId})",
                Timestamp = e.DeviceTimestamp.ToString("yyyy-MM-dd HH:mm:ss"),
                Method = e.Method.ToString(),
                EventType = e.EventType.ToString(),
                e.EventHash,
                ProcessingStatus = e.ProcessingStatus.ToString()
            })
            .ToListAsync();

        return Ok(new
        {
            items,
            page,
            pageSize,
            totalRecords,
            totalPages = (int)Math.Ceiling((double)totalRecords / pageSize)
        });
    }

    [HttpPost("reprocess")]
    public async Task<IActionResult> ReprocessAttendance([FromBody] ReprocessRequest request)
    {
        var startDate = request.Date ?? request.StartDate ?? DateTime.UtcNow.Date;
        var endDate = request.Date ?? request.EndDate ?? startDate;

        int processed = await _attendanceProcessingService.ReprocessAsync(
            request.EmployeeId,
            request.BranchId,
            startDate,
            endDate
        );

        return Ok(new
        {
            message = $"Reprocesamiento completado para {processed} registros de asistencia.",
            processedCount = processed,
            startDate = startDate.ToString("yyyy-MM-dd"),
            endDate = endDate.ToString("yyyy-MM-dd")
        });
    }

    [HttpGet("calendar")]
    [HttpGet("/api/asistencia/calendario")]
    public async Task<IActionResult> GetAttendanceCalendar(
        [FromQuery(Name = "sucursalId")] int? sucursalId = null,
        [FromQuery(Name = "branchId")] int? branchId = null,
        [FromQuery(Name = "fechaInicio")] string? fechaInicio = null,
        [FromQuery(Name = "startDate")] string? startDate = null,
        [FromQuery(Name = "fechaFin")] string? fechaFin = null,
        [FromQuery(Name = "endDate")] string? endDate = null,
        [FromQuery(Name = "dias")] int dias = 14)
    {
        var effectiveBranchId = sucursalId ?? branchId;
        var startStr = fechaInicio ?? startDate;
        var endStr = fechaFin ?? endDate;

        // Security check for branch restriction
        var restrictedBranchId = GetUserRestrictedBranchId();
        if (restrictedBranchId.HasValue)
        {
            if (effectiveBranchId.HasValue && effectiveBranchId.Value != restrictedBranchId.Value)
            {
                return StatusCode(403, new { message = "Acceso denegado: No tiene permisos para consultar información de otra sucursal." });
            }
            effectiveBranchId = restrictedBranchId.Value;
        }

        var today = DateTime.UtcNow.Date;
        DateTime start;
        if (!string.IsNullOrWhiteSpace(startStr) && DateTime.TryParse(startStr, out var parsedStart))
        {
            start = parsedStart.Date;
        }
        else
        {
            // Default to Monday of current week
            int diff = (7 + (int)today.DayOfWeek - (int)DayOfWeek.Monday) % 7;
            start = today.AddDays(-diff);
        }

        DateTime end;
        if (!string.IsNullOrWhiteSpace(endStr) && DateTime.TryParse(endStr, out var parsedEnd))
        {
            end = parsedEnd.Date;
        }
        else
        {
            end = start.AddDays(Math.Max(1, dias) - 1);
        }

        if (end < start)
        {
            (start, end) = (end, start);
        }

        // 1. Single query for active employees in branch/company
        var empQuery = _context.Employees
            .Include(e => e.Branch)
            .Include(e => e.Department)
            .Where(e => e.Status == CommonStatus.Active);

        if (effectiveBranchId.HasValue)
        {
            empQuery = empQuery.Where(e => e.BranchId == effectiveBranchId.Value);
        }

        var employees = await empQuery
            .OrderBy(e => e.Branch.Name)
            .ThenBy(e => e.EmployeeCode)
            .ToListAsync();

        var employeeIds = employees.Select(e => e.Id).ToList();

        // 2. Single query for all attendance records in the entire period
        var dailies = await _context.AttendanceDailies
            .Where(a => employeeIds.Contains(a.EmployeeId) && a.Date >= start && a.Date <= end)
            .AsNoTracking()
            .ToListAsync();

        var dailyLookup = dailies
            .GroupBy(a => (a.EmployeeId, a.Date.Date))
            .ToDictionary(g => g.Key, g => g.First());

        // 3. Holidays in range
        var holidays = await _context.Holidays
            .Where(h => h.Date >= start && h.Date <= end)
            .Select(h => h.Date.Date)
            .ToListAsync();
        var holidaySet = holidays.ToHashSet();

        // 4. Header days list
        var diasHeader = new List<object>();
        for (var d = start; d <= end; d = d.AddDays(1))
        {
            diasHeader.Add(new
            {
                fecha = d.ToString("yyyy-MM-dd"),
                numeroDia = d.Day,
                diaSemana = GetShortDayName(d.DayOfWeek),
                diaSemanaNombre = GetFullDayName(d.DayOfWeek),
                numeroSemana = ISOWeek.GetWeekOfYear(d),
                esFinDeSemana = d.DayOfWeek == DayOfWeek.Saturday || d.DayOfWeek == DayOfWeek.Sunday,
                esHoy = d.Date == today
            });
        }

        // 5. Build employees matrix & calculate summary counts
        int totalOnTime = 0;
        int totalLate = 0;
        int totalAbsent = 0;
        int totalRest = 0;
        int totalPermission = 0;

        var empleadosMatrix = new List<object>();

        foreach (var emp in employees)
        {
            var asistencias = new List<object>();

            for (var d = start; d <= end; d = d.AddDays(1))
            {
                var curDate = d.Date;
                var hasRecord = dailyLookup.TryGetValue((emp.Id, curDate), out var rec);

                string estadoCode;
                string displayEstado;
                string rawStatus;
                string? entrada = null;
                string? salida = null;
                int minutosRetardo = 0;
                int minutosTrabajados = 0;
                string origen;
                bool modificadoManual = false;
                string? modificadoPor = null;
                string? fechaModificacion = null;
                string? motivoModificacion = null;

                if (hasRecord && rec != null)
                {
                    rawStatus = rec.Status.ToString();
                    estadoCode = MapToStandardStatusCode(rec.Status);
                    displayEstado = GetDisplayStatus(rec.Status);
                    entrada = rec.FirstEntry.HasValue ? rec.FirstEntry.Value.ToString(@"hh\:mm") : null;
                    salida = rec.LastExit.HasValue ? rec.LastExit.Value.ToString(@"hh\:mm") : null;
                    minutosRetardo = rec.MinutesLate;
                    minutosTrabajados = rec.MinutesWorked;
                    origen = string.IsNullOrWhiteSpace(rec.Origin) ? (rec.FirstEntry.HasValue ? "BIOMETRICO" : "SISTEMA") : rec.Origin;
                    modificadoManual = rec.IsManualOverride;
                    modificadoPor = rec.ModifiedBy;
                    fechaModificacion = rec.ModifiedAt?.ToString("yyyy-MM-dd HH:mm:ss");
                    motivoModificacion = rec.ModificationReason;
                }
                else
                {
                    // Fallback based on schedule / calendar
                    if (holidaySet.Contains(curDate))
                    {
                        rawStatus = AttendanceStatus.Holiday.ToString();
                        estadoCode = "DESCANSO";
                        displayEstado = "Día Festivo";
                        origen = "SISTEMA";
                    }
                    else if (curDate.DayOfWeek == DayOfWeek.Sunday)
                    {
                        rawStatus = AttendanceStatus.RestDay.ToString();
                        estadoCode = "DESCANSO";
                        displayEstado = "Descanso";
                        origen = "SISTEMA";
                    }
                    else if (curDate > today)
                    {
                        rawStatus = "Scheduled";
                        estadoCode = "PROGRAMADO";
                        displayEstado = "Programado";
                        origen = "SISTEMA";
                    }
                    else
                    {
                        rawStatus = AttendanceStatus.Absent.ToString();
                        estadoCode = "FALTA";
                        displayEstado = "Falta";
                        origen = "SISTEMA";
                    }
                }

                // Tally summary for days up to today (or completed records)
                if (curDate <= today || hasRecord)
                {
                    switch (estadoCode)
                    {
                        case "ATIEMPO": totalOnTime++; break;
                        case "RETARDO": totalLate++; break;
                        case "FALTA": totalAbsent++; break;
                        case "DESCANSO": totalRest++; break;
                        case "PERMISO": totalPermission++; break;
                    }
                }

                asistencias.Add(new
                {
                    fecha = curDate.ToString("yyyy-MM-dd"),
                    numeroDia = curDate.Day,
                    diaSemana = GetShortDayName(curDate.DayOfWeek),
                    numeroSemana = ISOWeek.GetWeekOfYear(curDate),
                    estado = estadoCode,
                    displayEstado,
                    rawStatus,
                    entrada,
                    salida,
                    minutosRetardo,
                    minutosTrabajados,
                    origen,
                    modificadoManual,
                    modificadoPor,
                    fechaModificacion,
                    motivoModificacion
                });
            }

            empleadosMatrix.Add(new
            {
                empleadoId = emp.Id,
                codigo = emp.EmployeeCode,
                nombre = $"{emp.FirstName} {emp.LastName}".Trim(),
                sucursalId = emp.BranchId,
                sucursal = emp.Branch.Name,
                departamento = emp.Department?.Name ?? "General",
                asistencias
            });
        }

        string? sucursalNombre = null;
        if (effectiveBranchId.HasValue)
        {
            var branch = await _context.Branches.FindAsync(effectiveBranchId.Value);
            sucursalNombre = branch?.Name;
        }

        return Ok(new
        {
            fechaInicio = start.ToString("yyyy-MM-dd"),
            fechaFin = end.ToString("yyyy-MM-dd"),
            totalDias = (int)(end - start).TotalDays + 1,
            sucursalId = effectiveBranchId,
            sucursalNombre,
            dias = diasHeader,
            resumen = new
            {
                aTiempo = totalOnTime,
                retardos = totalLate,
                faltas = totalAbsent,
                descansos = totalRest,
                permisos = totalPermission
            },
            empleados = empleadosMatrix
        });
    }

    [HttpPut("{employeeId:int}/{date}/status")]
    [HttpPut("/api/asistencia/{employeeId:int}/{date}/estado")]
    public async Task<IActionResult> UpdateAttendanceStatus(
        int employeeId,
        string date,
        [FromBody] UpdateAttendanceStatusRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Estado))
        {
            return BadRequest(new { message = "El estado es requerido." });
        }

        if (!DateTime.TryParse(date, out var targetDate))
        {
            return BadRequest(new { message = "Formato de fecha inválido. Utilice AAAA-MM-DD." });
        }

        targetDate = targetDate.Date;

        var employee = await _context.Employees
            .Include(e => e.Branch)
            .FirstOrDefaultAsync(e => e.Id == employeeId);

        if (employee == null)
        {
            return NotFound(new { message = $"Empleado con ID {employeeId} no encontrado." });
        }

        // Branch permission check
        var restrictedBranchId = GetUserRestrictedBranchId();
        if (restrictedBranchId.HasValue && employee.BranchId != restrictedBranchId.Value)
        {
            return StatusCode(403, new { message = "Acceso denegado: No tiene permisos para modificar la asistencia de empleados de otra sucursal." });
        }

        AttendanceStatus newStatus;
        try
        {
            newStatus = ParseStatus(request.Estado);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var daily = await _context.AttendanceDailies
            .FirstOrDefaultAsync(a => a.EmployeeId == employeeId && a.Date == targetDate);

        var previousStatus = daily?.Status ?? (targetDate.DayOfWeek == DayOfWeek.Sunday ? AttendanceStatus.RestDay : AttendanceStatus.Absent);
        var previousOrigin = daily?.Origin ?? "SISTEMA";

        var username = User.Identity?.Name
            ?? User.FindFirst(ClaimTypes.Name)?.Value
            ?? User.FindFirst(ClaimTypes.Email)?.Value
            ?? "Administrador";

        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";

        if (daily == null)
        {
            daily = new AttendanceDaily
            {
                EmployeeId = employeeId,
                Date = targetDate,
                ExpectedEntry = new TimeSpan(8, 0, 0),
                ExpectedExit = new TimeSpan(18, 0, 0),
                MinutesLate = 0,
                MinutesWorked = 0,
                OvertimeMinutes = 0,
                CreatedAt = DateTime.UtcNow
            };
            _context.AttendanceDailies.Add(daily);
        }

        // Preserve original status if not already stored
        daily.OriginalStatus ??= previousStatus;
        daily.Status = newStatus;
        daily.Origin = "MANUAL";
        daily.IsManualOverride = true;
        daily.ModifiedBy = username;
        daily.ModifiedAt = DateTime.UtcNow;
        daily.ModificationReason = request.Observacion;
        daily.UpdatedAt = DateTime.UtcNow;

        // Register Audit Log
        _context.AuditLogs.Add(new AuditLog
        {
            Username = username,
            Timestamp = DateTime.UtcNow,
            IpAddress = ipAddress,
            Module = "Attendance",
            Action = "ManualOverride",
            Entity = "AttendanceDaily",
            RecordId = $"{employee.EmployeeCode}:{targetDate:yyyy-MM-dd}",
            OldValues = JsonSerializer.Serialize(new
            {
                status = previousStatus.ToString(),
                origin = previousOrigin,
                display = GetDisplayStatus(previousStatus)
            }),
            NewValues = JsonSerializer.Serialize(new
            {
                status = newStatus.ToString(),
                display = GetDisplayStatus(newStatus),
                origin = "MANUAL",
                observacion = request.Observacion,
                modificadoPor = username,
                fechaModificacion = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss")
            })
        });

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Estado de asistencia modificado exitosamente.",
            employeeId,
            employeeCode = employee.EmployeeCode,
            employeeName = $"{employee.FirstName} {employee.LastName}",
            date = targetDate.ToString("yyyy-MM-dd"),
            previousStatus = previousStatus.ToString(),
            newStatus = newStatus.ToString(),
            estado = MapToStandardStatusCode(newStatus),
            displayEstado = GetDisplayStatus(newStatus),
            origen = "MANUAL",
            modificadoManual = true,
            modificadoPor = username,
            fechaModificacion = daily.ModifiedAt?.ToString("yyyy-MM-dd HH:mm:ss"),
            motivoModificacion = request.Observacion
        });
    }

    private int? GetUserRestrictedBranchId()
    {
        if (User.IsInRole("SUPERADMIN") || User.IsInRole("ADMIN"))
        {
            return null;
        }

        var branchClaim = User.FindFirst("BranchId")?.Value;
        if (!string.IsNullOrEmpty(branchClaim) && int.TryParse(branchClaim, out var branchId))
        {
            return branchId;
        }

        return null;
    }

    private static string MapToStandardStatusCode(AttendanceStatus status) => status switch
    {
        AttendanceStatus.OnTime => "ATIEMPO",
        AttendanceStatus.Late => "RETARDO",
        AttendanceStatus.EarlyExit => "RETARDO",
        AttendanceStatus.Absent => "FALTA",
        AttendanceStatus.Incomplete => "FALTA",
        AttendanceStatus.RestDay => "DESCANSO",
        AttendanceStatus.Holiday => "DESCANSO",
        AttendanceStatus.Vacation => "PERMISO",
        AttendanceStatus.Permission => "PERMISO",
        AttendanceStatus.Disability => "PERMISO",
        _ => "FALTA"
    };

    private static string GetDisplayStatus(AttendanceStatus status) => status switch
    {
        AttendanceStatus.OnTime => "A tiempo",
        AttendanceStatus.Late => "Retardo",
        AttendanceStatus.EarlyExit => "Salida Temprana",
        AttendanceStatus.Absent => "Falta",
        AttendanceStatus.Incomplete => "Incompleto",
        AttendanceStatus.RestDay => "Descanso",
        AttendanceStatus.Holiday => "Día Festivo",
        AttendanceStatus.Vacation => "Vacaciones",
        AttendanceStatus.Permission => "Permiso",
        AttendanceStatus.Disability => "Incapacidad",
        _ => status.ToString()
    };

    private static AttendanceStatus ParseStatus(string input)
    {
        var normalized = input.Trim().ToUpperInvariant();
        return normalized switch
        {
            "ATIEMPO" or "A TIEMPO" or "ONTIME" or "PRESENTE" => AttendanceStatus.OnTime,
            "RETARDO" or "LATE" => AttendanceStatus.Late,
            "FALTA" or "ABSENT" or "AUSENTE" => AttendanceStatus.Absent,
            "DESCANSO" or "RESTDAY" or "REST_DAY" => AttendanceStatus.RestDay,
            "PERMISO" or "PERMISSION" => AttendanceStatus.Permission,
            "VACACIONES" or "VACATION" => AttendanceStatus.Vacation,
            "INCAPACIDAD" or "DISABILITY" => AttendanceStatus.Disability,
            "SALIDA_TEMPRANA" or "EARLYEXIT" => AttendanceStatus.EarlyExit,
            "INCOMPLETO" or "INCOMPLETE" => AttendanceStatus.Incomplete,
            "FESTIVO" or "HOLIDAY" => AttendanceStatus.Holiday,
            _ when Enum.TryParse<AttendanceStatus>(input, true, out var parsed) => parsed,
            _ => throw new ArgumentException($"Estado no reconocido: '{input}'. Opciones válidas: ATIEMPO, RETARDO, FALTA, DESCANSO, PERMISO.")
        };
    }

    private static string GetShortDayName(DayOfWeek dow) => dow switch
    {
        DayOfWeek.Monday => "L",
        DayOfWeek.Tuesday => "M",
        DayOfWeek.Wednesday => "M",
        DayOfWeek.Thursday => "J",
        DayOfWeek.Friday => "V",
        DayOfWeek.Saturday => "S",
        DayOfWeek.Sunday => "D",
        _ => "?"
    };

    private static string GetFullDayName(DayOfWeek dow) => dow switch
    {
        DayOfWeek.Monday => "Lunes",
        DayOfWeek.Tuesday => "Martes",
        DayOfWeek.Wednesday => "Miércoles",
        DayOfWeek.Thursday => "Jueves",
        DayOfWeek.Friday => "Viernes",
        DayOfWeek.Saturday => "Sábado",
        DayOfWeek.Sunday => "Domingo",
        _ => dow.ToString()
    };
}
