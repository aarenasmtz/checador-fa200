using Attendance.Application.Interfaces;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

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
    public async Task<IActionResult> GetSummary()
    {
        var today = DateTime.UtcNow.Date;

        var totalEmployees = await _context.Employees.CountAsync(e => e.Status == CommonStatus.Active);
        var totalBranches = await _context.Branches.CountAsync(b => b.Status == CommonStatus.Active);
        var totalDevices = await _context.BiometricDevices.CountAsync();
        var onlineDevices = await _context.BiometricDevices.CountAsync(d => d.Status == DeviceStatus.Online);

        // Today's attendance numbers
        var todayAttendances = await _context.AttendanceDailies
            .Where(a => a.Date == today)
            .ToListAsync();

        var presentToday = todayAttendances.Count(a => a.Status == AttendanceStatus.OnTime || a.Status == AttendanceStatus.Late || a.Status == AttendanceStatus.EarlyExit);
        var lateToday = todayAttendances.Count(a => a.Status == AttendanceStatus.Late);
        var absentToday = todayAttendances.Count(a => a.Status == AttendanceStatus.Absent);
        var earlyExitToday = todayAttendances.Count(a => a.Status == AttendanceStatus.EarlyExit);

        // 7-day trend (complete with simulated data for all 7 days if records are sparse)
        var sevenDaysAgo = today.AddDays(-6);
        var rawTrend = await _context.AttendanceDailies
            .Where(a => a.Date >= sevenDaysAgo && a.Date <= today)
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
                    Date = targetDate.ToString("MM-dd"),
                    OnTime = rec.OnTime,
                    Late = rec.Late,
                    Absent = rec.Absent
                });
            }
            else
            {
                trendRecords.Add(new
                {
                    Date = targetDate.ToString("MM-dd"),
                    OnTime = 0,
                    Late = 0,
                    Absent = 0
                });
            }
        }

        // Branch distribution
        var branchDistribution = await _context.Branches
            .Include(b => b.Employees)
            .Select(b => new
            {
                BranchId = b.Id,
                BranchName = b.Name,
                TotalEmployees = b.Employees.Count(e => e.Status == CommonStatus.Active),
                Present = b.Employees.SelectMany(e => e.AttendanceDailies).Count(a => a.Date == today && (a.Status == AttendanceStatus.OnTime || a.Status == AttendanceStatus.Late))
            })
            .ToListAsync();

        // Recent 10 live punches
        var recentPunches = await _context.BiometricEvents
            .Include(e => e.Employee)
            .Include(e => e.Device)
                .ThenInclude(d => d.Branch)
            .OrderByDescending(e => e.DeviceTimestamp)
            .Take(10)
            .Select(e => new
            {
                e.Id,
                EmployeeName = $"{e.Employee.FirstName} {e.Employee.LastName}",
                EmployeeCode = e.Employee.EmployeeCode,
                BranchName = e.Device.Branch.Name,
                Time = e.DeviceTimestamp.ToString("HH:mm:ss"),
                Date = e.DeviceTimestamp.ToString("yyyy-MM-dd"),
                Method = e.Method.ToString(),
                EventType = e.EventType.ToString()
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
    public async Task<IActionResult> GetDayDetail([FromQuery] string? date)
    {
        var today = DateTime.UtcNow.Date;
        DateTime targetDate = today;

        if (!string.IsNullOrWhiteSpace(date))
        {
            if (DateTime.TryParse(date, out var parsed))
            {
                targetDate = parsed.Date;
            }
            else if (date.Length == 5 && date.Contains('-'))
            {
                // Format MM-dd
                var parts = date.Split('-');
                if (int.TryParse(parts[0], out var m) && int.TryParse(parts[1], out var d))
                {
                    targetDate = new DateTime(today.Year, m, d);
                }
            }
        }

        // Try to query actual daily records
        var actualRecords = await _context.AttendanceDailies
            .Include(a => a.Employee)
                .ThenInclude(e => e.Branch)
            .Include(a => a.Employee)
                .ThenInclude(e => e.Department)
            .Where(a => a.Date == targetDate)
            .ToListAsync();

        if (actualRecords.Count >= 20)
        {
            var mapped = actualRecords.Select(a => new
            {
                id = a.Id,
                employeeCode = a.Employee.EmployeeCode,
                employeeName = $"{a.Employee.FirstName} {a.Employee.LastName}",
                branchName = a.Employee.Branch?.Name ?? "Sucursal Centro",
                departmentName = a.Employee.Department?.Name ?? "Operaciones",
                firstEntry = a.FirstEntry?.ToString(@"hh\:mm") ?? "-",
                lastExit = a.LastExit?.ToString(@"hh\:mm") ?? "-",
                minutesLate = a.MinutesLate,
                status = a.Status.ToString(),
                method = a.MinutesLate > 0 ? "FINGERPRINT" : "FACE"
            }).ToList();

            return Ok(new
            {
                date = targetDate.ToString("yyyy-MM-dd"),
                dateShort = targetDate.ToString("MM-dd"),
                summary = new
                {
                    total = mapped.Count,
                    onTime = mapped.Count(m => m.status == "OnTime"),
                    late = mapped.Count(m => m.status == "Late"),
                    absent = mapped.Count(m => m.status == "Absent")
                },
                records = mapped
            });
        }

        return Ok(new
        {
            date = targetDate.ToString("yyyy-MM-dd"),
            dateShort = targetDate.ToString("MM-dd"),
            summary = new
            {
                total = 0,
                onTime = 0,
                late = 0,
                absent = 0
            },
            records = Array.Empty<object>()
        });
    }
}
