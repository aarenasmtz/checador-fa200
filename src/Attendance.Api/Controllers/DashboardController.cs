using Attendance.Application.Interfaces;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Globalization;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/dashboard")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly IAppDbContext _context;

    public DashboardController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int? branchId = null)
    {
        var today = DateTime.UtcNow.Date;

        var empQuery = _context.Employees.Where(e => e.Status == CommonStatus.Active);
        if (branchId.HasValue && branchId.Value > 0) empQuery = empQuery.Where(e => e.BranchId == branchId.Value);

        var totalEmployees = await empQuery.CountAsync();
        var totalBranches = await _context.Branches.CountAsync(b => b.Status == CommonStatus.Active);
        var totalDevices = await _context.BiometricDevices.CountAsync();
        var onlineDevices = await _context.BiometricDevices.CountAsync(d => d.Status == DeviceStatus.Online);

        // Today's attendance numbers
        var todayAttendancesQuery = _context.AttendanceDailies
            .Include(a => a.Employee)
            .Where(a => a.Date == today);

        if (branchId.HasValue && branchId.Value > 0)
            todayAttendancesQuery = todayAttendancesQuery.Where(a => a.Employee.BranchId == branchId.Value);

        var todayAttendances = await todayAttendancesQuery.ToListAsync();

        var presentToday = todayAttendances.Count(a => a.Status == AttendanceStatus.OnTime || a.Status == AttendanceStatus.Late || a.Status == AttendanceStatus.EarlyExit);
        var lateToday = todayAttendances.Count(a => a.Status == AttendanceStatus.Late);
        var absentToday = todayAttendances.Count(a => a.Status == AttendanceStatus.Absent);
        var earlyExitToday = todayAttendances.Count(a => a.Status == AttendanceStatus.EarlyExit);

        // 7-day trend
        var sevenDaysAgo = today.AddDays(-6);
        var trendQuery = _context.AttendanceDailies
            .Include(a => a.Employee)
            .Where(a => a.Date >= sevenDaysAgo && a.Date <= today);

        if (branchId.HasValue && branchId.Value > 0)
            trendQuery = trendQuery.Where(a => a.Employee.BranchId == branchId.Value);

        var rawTrend = await trendQuery
            .GroupBy(a => a.Date)
            .OrderBy(g => g.Key)
            .Select(g => new
            {
                Date = g.Key,
                OnTime = g.Count(r => r.Status == AttendanceStatus.OnTime),
                Late = g.Count(r => r.Status == AttendanceStatus.Late),
                Absent = g.Count(r => r.Status == AttendanceStatus.Absent)
            })
            .ToListAsync();

        var trendMap = rawTrend.ToDictionary(r => r.Date.Date, r => r);
        var trendRecords = new List<object>();

        for (int i = 6; i >= 0; i--)
        {
            var targetDate = today.AddDays(-i);
            if (trendMap.TryGetValue(targetDate.Date, out var rec))
            {
                trendRecords.Add(new
                {
                    date = targetDate.ToString("yyyy-MM-dd"),
                    label = targetDate.ToString("MM-dd"),
                    dateShort = targetDate.ToString("MM-dd"),
                    onTime = rec.OnTime,
                    late = rec.Late,
                    absent = rec.Absent
                });
            }
            else
            {
                trendRecords.Add(new
                {
                    date = targetDate.ToString("yyyy-MM-dd"),
                    label = targetDate.ToString("MM-dd"),
                    dateShort = targetDate.ToString("MM-dd"),
                    onTime = 0,
                    late = 0,
                    absent = 0
                });
            }
        }

        // Branch distribution
        var branchDistribution = await _context.Branches
            .Include(b => b.Employees)
            .Select(b => new
            {
                branchId = b.Id,
                branchName = b.Name,
                totalEmployees = b.Employees.Count(e => e.Status == CommonStatus.Active),
                present = b.Employees.SelectMany(e => e.AttendanceDailies).Count(a => a.Date == today && (a.Status == AttendanceStatus.OnTime || a.Status == AttendanceStatus.Late))
            })
            .ToListAsync();

        // Recent 10 live punches
        var recentPunchesQuery = _context.BiometricEvents
            .Include(e => e.Employee)
            .Include(e => e.Device)
                .ThenInclude(d => d.Branch)
            .AsQueryable();

        if (branchId.HasValue && branchId.Value > 0)
            recentPunchesQuery = recentPunchesQuery.Where(e => e.Device.BranchId == branchId.Value);

        var recentPunches = await recentPunchesQuery
            .OrderByDescending(e => e.DeviceTimestamp)
            .Take(10)
            .Select(e => new
            {
                e.Id,
                employeeName = e.Employee != null ? $"{e.Employee.FirstName} {e.Employee.LastName}" : $"Sin vincular (ID Reloj: {e.UserClockId})",
                employeeCode = e.Employee != null ? e.Employee.EmployeeCode : (e.UserClockId ?? "PENDIENTE"),
                branchName = e.Device.Branch.Name,
                time = e.DeviceTimestamp.ToString("HH:mm:ss"),
                date = e.DeviceTimestamp.ToString("yyyy-MM-dd"),
                method = e.Method.ToString(),
                eventType = e.EventType.ToString()
            })
            .ToListAsync();

        return Ok(new
        {
            metrics = new
            {
                totalEmployees,
                totalBranches,
                totalDevices,
                onlineDevices,
                simulatedDevices = 0,
                presentToday,
                lateToday,
                absentToday,
                earlyExitToday
            },
            trend = trendRecords,
            branches = branchDistribution,
            recentActivity = recentPunches
        });
    }

    [HttpGet("day-detail")]
    public async Task<IActionResult> GetDayDetail([FromQuery] string? date, [FromQuery] int? branchId = null)
    {
        var today = DateTime.UtcNow.Date;
        DateTime targetDate = today;

        if (!string.IsNullOrWhiteSpace(date))
        {
            if (DateTime.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var exactDate))
            {
                targetDate = exactDate.Date;
            }
            else if (DateTime.TryParse(date, out var parsed))
            {
                targetDate = parsed.Date;
            }
            else if (date.Length == 5 && date.Contains('-'))
            {
                var parts = date.Split('-');
                if (int.TryParse(parts[0], out var m) && int.TryParse(parts[1], out var d))
                {
                    targetDate = new DateTime(today.Year, m, d);
                }
            }
        }

        // Query daily records with branch filter if provided
        var query = _context.AttendanceDailies
            .Include(a => a.Employee)
                .ThenInclude(e => e.Branch)
            .Include(a => a.Employee)
                .ThenInclude(e => e.Department)
            .Where(a => a.Date == targetDate);

        if (branchId.HasValue && branchId.Value > 0)
        {
            query = query.Where(a => a.Employee.BranchId == branchId.Value);
        }

        var actualRecords = await query
            .OrderBy(a => a.Employee.EmployeeCode)
            .ToListAsync();

        // Batch query original biometric events for all employees for this day (covering shift window)
        var employeeIds = actualRecords.Select(a => a.EmployeeId).Distinct().ToList();
        var windowStart = targetDate.AddHours(-4);
        var windowEnd = targetDate.AddDays(1).AddHours(6);

        var events = await _context.BiometricEvents
            .Include(e => e.Device)
                .ThenInclude(d => d.Branch)
            .Where(e => e.EmployeeId.HasValue && employeeIds.Contains(e.EmployeeId.Value) && e.DeviceTimestamp >= windowStart && e.DeviceTimestamp <= windowEnd)
            .OrderBy(e => e.DeviceTimestamp)
            .ToListAsync();

        var eventsByEmployee = events
            .GroupBy(e => e.EmployeeId!.Value)
            .ToDictionary(g => g.Key, g => g.ToList());

        var mapped = actualRecords.Select(a =>
        {
            var empEvents = eventsByEmployee.TryGetValue(a.EmployeeId, out var evList) ? evList : new List<Domain.Entities.BiometricEvent>();
            
            // Real identification method calculation
            var distinctMethods = empEvents.Select(e => e.Method.ToString()).Distinct().ToList();
            string methodDisplay;
            if (distinctMethods.Count == 0)
                methodDisplay = "Sin información";
            else if (distinctMethods.Count == 1)
                methodDisplay = distinctMethods[0];
            else
                methodDisplay = "Varios";

            var punches = empEvents.Select(e => new
            {
                id = e.Id,
                timestamp = e.DeviceTimestamp.ToString("yyyy-MM-dd HH:mm:ss"),
                time = e.DeviceTimestamp.ToString("HH:mm:ss"),
                date = e.DeviceTimestamp.ToString("yyyy-MM-dd"),
                type = e.EventType.ToString(),
                classifiedAs = e.ClassifiedAs ?? (e.NativePunchCode switch
                {
                    0 => "ENTRY",
                    1 => "EXIT",
                    2 => "MEAL_EXIT",
                    3 => "MEAL_RETURN",
                    _ => "PUNCH"
                }),
                method = e.Method.ToString(),
                deviceName = e.Device?.Name ?? "Dispositivo FA200",
                deviceCode = e.Device?.Code ?? "-",
                branchName = e.Device?.Branch?.Name ?? a.Employee?.Branch?.Name ?? "-"
            }).ToList();

            return new
            {
                id = a.Id,
                employeeId = a.EmployeeId,
                employeeCode = a.Employee.EmployeeCode,
                employeeName = $"{a.Employee.FirstName} {a.Employee.LastName}",
                branchId = a.Employee.BranchId,
                branchName = a.Employee.Branch?.Name ?? "Sucursal Centro",
                departmentName = a.Employee.Department?.Name ?? "Operaciones",
                firstEntry = a.FirstEntry?.ToString(@"hh\:mm") ?? "-",
                mealExit = a.MealExit?.ToString(@"hh\:mm") ?? "-",
                mealReturn = a.MealReturn?.ToString(@"hh\:mm") ?? "-",
                lastExit = a.LastExit?.ToString(@"hh\:mm") ?? "-",
                minutesLate = a.MinutesLate,
                minutesWorked = a.MinutesWorked,
                hoursWorked = Math.Round((decimal)a.MinutesWorked / 60m, 2),
                overtimeMinutes = a.OvertimeMinutes,
                status = a.Status.ToString(),
                method = methodDisplay,
                punches,
                requiresReview = a.RequiresReview,
                reviewNotes = a.ReviewNotes
            };
        }).ToList();

        return Ok(new
        {
            date = targetDate.ToString("yyyy-MM-dd"),
            dateShort = targetDate.ToString("MM-dd"),
            branchId,
            summary = new
            {
                total = mapped.Count,
                onTime = mapped.Count(m => m.status == "OnTime"),
                late = mapped.Count(m => m.status == "Late"),
                absent = mapped.Count(m => m.status == "Absent"),
                incomplete = mapped.Count(m => m.status == "Incomplete"),
                earlyExit = mapped.Count(m => m.status == "EarlyExit")
            },
            records = mapped
        });
    }
}
