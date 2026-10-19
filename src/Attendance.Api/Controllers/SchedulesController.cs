using Attendance.Application.DTOs;
using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/schedules")]
[Authorize]
public class SchedulesController : ControllerBase
{
    private readonly IAppDbContext _context;

    public SchedulesController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetSchedules()
    {
        var schedules = await _context.Schedules
            .Include(s => s.WorkDays)
            .Include(s => s.EmployeeSchedules)
            .AsNoTracking()
            .Select(s => new ScheduleDto(
                s.Id,
                s.CompanyId,
                s.Name,
                s.StartTime.ToString(@"hh\:mm"),
                s.EndTime.ToString(@"hh\:mm"),
                s.ToleranceMinutes,
                s.MealStartTime.HasValue ? s.MealStartTime.Value.ToString(@"hh\:mm") : null,
                s.MealEndTime.HasValue ? s.MealEndTime.Value.ToString(@"hh\:mm") : null,
                s.ExpectedHours,
                s.Status.ToString(),
                s.WorkDays.OrderBy(w => w.DayOfWeek).Select(w => new WorkDayDto(
                    w.Id,
                    (int)w.DayOfWeek,
                    w.DayOfWeek.ToString(),
                    w.IsWorkingDay
                )).ToList(),
                s.EmployeeSchedules.Count
            ))
            .ToListAsync();

        return Ok(schedules);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSchedule([FromBody] CreateScheduleRequest request)
    {
        var company = await _context.Companies.FirstOrDefaultAsync();
        if (company == null) return BadRequest(new { message = "No existe empresa registrada" });

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = request.Name,
            StartTime = TimeSpan.Parse(request.StartTime),
            EndTime = TimeSpan.Parse(request.EndTime),
            ToleranceMinutes = request.ToleranceMinutes,
            MealStartTime = string.IsNullOrEmpty(request.MealStartTime) ? null : TimeSpan.Parse(request.MealStartTime),
            MealEndTime = string.IsNullOrEmpty(request.MealEndTime) ? null : TimeSpan.Parse(request.MealEndTime),
            ExpectedHours = request.ExpectedHours,
            Status = CommonStatus.Active
        };

        _context.Schedules.Add(schedule);
        await _context.SaveChangesAsync();

        // Add 7 days of the week
        for (int i = 0; i < 7; i++)
        {
            var isWorking = request.WorkingDays.Contains(i);
            _context.WorkDays.Add(new WorkDay
            {
                ScheduleId = schedule.Id,
                DayOfWeek = (DayOfWeek)i,
                IsWorkingDay = isWorking
            });
        }
        await _context.SaveChangesAsync();

        return Ok(schedule);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSchedule(int id)
    {
        var s = await _context.Schedules
            .Include(s => s.WorkDays)
            .Include(s => s.EmployeeSchedules)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (s == null) return NotFound(new { message = "Horario no encontrado" });

        return Ok(new ScheduleDto(
            s.Id,
            s.CompanyId,
            s.Name,
            s.StartTime.ToString(@"hh\:mm"),
            s.EndTime.ToString(@"hh\:mm"),
            s.ToleranceMinutes,
            s.MealStartTime.HasValue ? s.MealStartTime.Value.ToString(@"hh\:mm") : null,
            s.MealEndTime.HasValue ? s.MealEndTime.Value.ToString(@"hh\:mm") : null,
            s.ExpectedHours,
            s.Status.ToString(),
            s.WorkDays.OrderBy(w => w.DayOfWeek).Select(w => new WorkDayDto(
                w.Id,
                (int)w.DayOfWeek,
                w.DayOfWeek.ToString(),
                w.IsWorkingDay
            )).ToList(),
            s.EmployeeSchedules.Count
        ));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateSchedule(int id, [FromBody] UpdateScheduleRequest request)
    {
        var schedule = await _context.Schedules
            .Include(s => s.WorkDays)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (schedule == null) return NotFound(new { message = "Horario no encontrado" });

        schedule.Name = request.Name;
        schedule.StartTime = TimeSpan.Parse(request.StartTime);
        schedule.EndTime = TimeSpan.Parse(request.EndTime);
        schedule.ToleranceMinutes = request.ToleranceMinutes;
        schedule.MealStartTime = string.IsNullOrEmpty(request.MealStartTime) ? null : TimeSpan.Parse(request.MealStartTime);
        schedule.MealEndTime = string.IsNullOrEmpty(request.MealEndTime) ? null : TimeSpan.Parse(request.MealEndTime);
        schedule.ExpectedHours = request.ExpectedHours;

        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<CommonStatus>(request.Status, true, out var status))
        {
            schedule.Status = status;
        }

        // Update working days
        if (request.WorkingDays != null)
        {
            _context.WorkDays.RemoveRange(schedule.WorkDays);
            for (int i = 0; i < 7; i++)
            {
                var isWorking = request.WorkingDays.Contains(i);
                _context.WorkDays.Add(new WorkDay
                {
                    ScheduleId = schedule.Id,
                    DayOfWeek = (DayOfWeek)i,
                    IsWorkingDay = isWorking
                });
            }
        }

        await _context.SaveChangesAsync();
        return Ok(schedule);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSchedule(int id)
    {
        var schedule = await _context.Schedules
            .Include(s => s.WorkDays)
            .Include(s => s.EmployeeSchedules)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (schedule == null) return NotFound(new { message = "Horario no encontrado" });

        if (schedule.EmployeeSchedules != null && schedule.EmployeeSchedules.Any())
        {
            return BadRequest(new { message = "No se puede eliminar este horario porque hay empleados asignados a él. Reasigne los horarios de los empleados primero." });
        }

        if (schedule.WorkDays != null && schedule.WorkDays.Any())
        {
            _context.WorkDays.RemoveRange(schedule.WorkDays);
        }

        _context.Schedules.Remove(schedule);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Horario eliminado exitosamente" });
    }
}

[ApiController]
[Route("api/v1/holidays")]
[Authorize]
public class HolidaysController : ControllerBase
{
    private readonly IAppDbContext _context;

    public HolidaysController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetHolidays()
    {
        var holidays = await _context.Holidays
            .AsNoTracking()
            .OrderBy(h => h.Date)
            .Select(h => new HolidayDto(h.Id, h.CompanyId, h.Date, h.Name))
            .ToListAsync();

        return Ok(holidays);
    }

    [HttpPost]
    public async Task<IActionResult> CreateHoliday([FromBody] CreateHolidayRequest request)
    {
        var company = await _context.Companies.FirstOrDefaultAsync();
        if (company == null) return BadRequest(new { message = "No existe empresa registrada" });

        var holiday = new Holiday
        {
            CompanyId = company.Id,
            Date = request.Date.Date,
            Name = request.Name
        };

        _context.Holidays.Add(holiday);
        await _context.SaveChangesAsync();

        return Ok(holiday);
    }
}
