using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Attendance.Application.Services;

public interface IAttendanceProcessingService
{
    Task<AttendanceDaily> ProcessDailyAttendanceAsync(int employeeId, DateTime date, CancellationToken cancellationToken = default);
    Task<int> ReprocessAsync(int? employeeId, int? branchId, DateTime startDate, DateTime endDate, CancellationToken cancellationToken = default);
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

        // Fetch all punches for this employee on this calendar date
        var dayStart = targetDate;
        var dayEnd = targetDate.AddDays(1);

        var events = await _context.BiometricEvents
            .Where(e => e.EmployeeId == employeeId && e.DeviceTimestamp >= dayStart && e.DeviceTimestamp < dayEnd)
            .OrderBy(e => e.DeviceTimestamp)
            .ToListAsync(cancellationToken);

        // Fetch active schedule for this date
        var schedule = employee.EmployeeSchedules
            .Where(es => es.ValidFrom <= targetDate && (!es.ValidTo.HasValue || es.ValidTo.Value >= targetDate))
            .OrderByDescending(es => es.ValidFrom)
            .Select(es => es.Schedule)
            .FirstOrDefault();

        // Check if this date is a holiday
        var isHoliday = await _context.Holidays
            .AnyAsync(h => h.CompanyId == employee.CompanyId && h.Date == targetDate, cancellationToken);

        // Check if employee has an approved incident/leave
        var approvedIncident = await _context.AttendanceIncidents
            .FirstOrDefaultAsync(i => i.EmployeeId == employeeId && i.AttendanceDate == targetDate && i.Status == IncidentStatus.Approved, cancellationToken);

        var approvedLeave = await _context.LeaveRequests
            .FirstOrDefaultAsync(l => l.EmployeeId == employeeId && l.StartDate <= targetDate && l.EndDate >= targetDate && l.Status == IncidentStatus.Approved, cancellationToken);

        // Fetch or create AttendanceDaily
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

        // If Holiday
        if (isHoliday)
        {
            daily.Status = AttendanceStatus.Holiday;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // If Approved Leave
        if (approvedLeave != null)
        {
            daily.Status = approvedLeave.Type == LeaveType.Vacation ? AttendanceStatus.Vacation : AttendanceStatus.Permission;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // If Approved Incident (e.g. Disability or Justified Absence)
        if (approvedIncident != null)
        {
            if (approvedIncident.Type == IncidentType.Disability)
                daily.Status = AttendanceStatus.Disability;
            else if (approvedIncident.Type == IncidentType.Vacation)
                daily.Status = AttendanceStatus.Vacation;
            else if (approvedIncident.Type == IncidentType.JustifiedAbsence)
                daily.Status = AttendanceStatus.Permission;
        }

        // Determine if today is a scheduled working day
        var dayOfWeek = targetDate.DayOfWeek;
        var workDayConfig = schedule?.WorkDays.FirstOrDefault(w => w.DayOfWeek == dayOfWeek);
        var isWorkingDay = workDayConfig?.IsWorkingDay ?? (dayOfWeek != DayOfWeek.Sunday);

        if (!isWorkingDay)
        {
            daily.Status = AttendanceStatus.RestDay;
            daily.MinutesWorked = 0;
            daily.MinutesLate = 0;
            daily.OvertimeMinutes = 0;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // Set expected entry and exit from schedule
        daily.ExpectedEntry = schedule?.StartTime ?? new TimeSpan(8, 0, 0);
        daily.ExpectedExit = schedule?.EndTime ?? new TimeSpan(18, 0, 0);
        var tolerance = schedule?.ToleranceMinutes ?? 10;
        var defaultHours = (decimal)(daily.ExpectedExit.Value - daily.ExpectedEntry.Value).TotalHours;
        var expectedHoursDecimal = (schedule != null && schedule.ExpectedHours > 0) ? schedule.ExpectedHours : defaultHours;
        var expectedMinutes = (int)(expectedHoursDecimal * 60);

        if (events.Count == 0)
        {
            if (approvedIncident == null && approvedLeave == null)
            {
                daily.Status = AttendanceStatus.Absent;
            }
            daily.FirstEntry = null;
            daily.LastExit = null;
            daily.MinutesWorked = 0;
            daily.MinutesLate = 0;
            daily.OvertimeMinutes = 0;
            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // Has punches
        var firstPunch = events.First().DeviceTimestamp.TimeOfDay;
        daily.FirstEntry = firstPunch;

        if (events.Count == 1)
        {
            daily.LastExit = null;
            daily.Status = AttendanceStatus.Incomplete;
            daily.MinutesWorked = 0;
            daily.OvertimeMinutes = 0;

            // Evaluate if entry was late
            var expectedEntryWithTolerance = daily.ExpectedEntry.Value.Add(TimeSpan.FromMinutes(tolerance));
            if (firstPunch > expectedEntryWithTolerance)
            {
                daily.MinutesLate = (int)(firstPunch - daily.ExpectedEntry.Value).TotalMinutes;
            }
            else
            {
                daily.MinutesLate = 0;
            }

            await _context.SaveChangesAsync(cancellationToken);
            return daily;
        }

        // 2 or more punches
        var lastPunch = events.Last().DeviceTimestamp.TimeOfDay;
        daily.LastExit = lastPunch;

        // If 4 punches exist, evaluate meal punch
        if (events.Count >= 4)
        {
            daily.MealExit = events[1].DeviceTimestamp.TimeOfDay;
            daily.MealReturn = events[2].DeviceTimestamp.TimeOfDay;
        }

        // Total minutes between first entry and last exit
        var totalWorked = (int)(lastPunch - firstPunch).TotalMinutes;

        // Deduct lunch break if 4 punches exist or default 60 mins
        if (daily.MealExit.HasValue && daily.MealReturn.HasValue)
        {
            var mealMins = (int)(daily.MealReturn.Value - daily.MealExit.Value).TotalMinutes;
            totalWorked = Math.Max(0, totalWorked - mealMins);
        }
        else if (schedule?.MealStartTime.HasValue == true && schedule?.MealEndTime.HasValue == true)
        {
            var lunchMins = (int)(schedule.MealEndTime.Value - schedule.MealStartTime.Value).TotalMinutes;
            if (totalWorked > lunchMins) totalWorked -= lunchMins;
        }

        daily.MinutesWorked = Math.Max(0, totalWorked);

        // Calculate late minutes
        var entryLimit = daily.ExpectedEntry.Value.Add(TimeSpan.FromMinutes(tolerance));
        if (firstPunch > entryLimit)
        {
            daily.MinutesLate = (int)(firstPunch - daily.ExpectedEntry.Value).TotalMinutes;
            daily.Status = AttendanceStatus.Late;
        }
        else if (lastPunch < daily.ExpectedExit.Value.Add(TimeSpan.FromMinutes(-15)))
        {
            daily.MinutesLate = 0;
            daily.Status = AttendanceStatus.EarlyExit;
        }
        else
        {
            daily.MinutesLate = 0;
            daily.Status = AttendanceStatus.OnTime;
        }

        // Calculate overtime
        if (daily.MinutesWorked > expectedMinutes)
        {
            daily.OvertimeMinutes = daily.MinutesWorked - expectedMinutes;
        }
        else
        {
            daily.OvertimeMinutes = 0;
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("[AttendanceProcessingService] Procesada asistencia para Empleado {EmpId}, Fecha {Date:yyyy-MM-dd}: Estado {Status}, MinTrabajados {Worked}, Retardo {Late}",
            employeeId, targetDate, daily.Status, daily.MinutesWorked, daily.MinutesLate);

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
