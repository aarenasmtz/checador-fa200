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

    private static TimeSpan? ParseTime(string? s) => string.IsNullOrWhiteSpace(s) ? null : TimeSpan.Parse(s);
    private static string? FormatTime(TimeSpan? t) => t.HasValue ? t.Value.ToString(@"hh\:mm") : null;

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
                s.HasMealBreak,
                s.MealBreakMode.ToString(),
                FormatTime(s.MealStartTime),
                FormatTime(s.MealEndTime),
                s.MealDurationMinutes,
                s.MealToleranceMinutes,
                s.IsOvernight,
                FormatTime(s.EntryWindowStart),
                FormatTime(s.EntryWindowEnd),
                FormatTime(s.MealExitWindowStart),
                FormatTime(s.MealExitWindowEnd),
                FormatTime(s.MealReturnWindowStart),
                FormatTime(s.MealReturnWindowEnd),
                FormatTime(s.ExitWindowStart),
                FormatTime(s.ExitWindowEnd),
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
            s.HasMealBreak,
            s.MealBreakMode.ToString(),
            FormatTime(s.MealStartTime),
            FormatTime(s.MealEndTime),
            s.MealDurationMinutes,
            s.MealToleranceMinutes,
            s.IsOvernight,
            FormatTime(s.EntryWindowStart),
            FormatTime(s.EntryWindowEnd),
            FormatTime(s.MealExitWindowStart),
            FormatTime(s.MealExitWindowEnd),
            FormatTime(s.MealReturnWindowStart),
            FormatTime(s.MealReturnWindowEnd),
            FormatTime(s.ExitWindowStart),
            FormatTime(s.ExitWindowEnd),
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
            HasMealBreak = request.HasMealBreak,
            MealBreakMode = Enum.TryParse<MealBreakMode>(request.MealBreakMode, true, out var mbm) ? mbm : MealBreakMode.Fixed,
            MealStartTime = ParseTime(request.MealStartTime),
            MealEndTime = ParseTime(request.MealEndTime),
            MealDurationMinutes = request.MealDurationMinutes ?? 60,
            MealToleranceMinutes = request.MealToleranceMinutes,
            IsOvernight = request.IsOvernight,
            EntryWindowStart = ParseTime(request.EntryWindowStart),
            EntryWindowEnd = ParseTime(request.EntryWindowEnd),
            MealExitWindowStart = ParseTime(request.MealExitWindowStart),
            MealExitWindowEnd = ParseTime(request.MealExitWindowEnd),
            MealReturnWindowStart = ParseTime(request.MealReturnWindowStart),
            MealReturnWindowEnd = ParseTime(request.MealReturnWindowEnd),
            ExitWindowStart = ParseTime(request.ExitWindowStart),
            ExitWindowEnd = ParseTime(request.ExitWindowEnd),
            ExpectedHours = request.ExpectedHours,
            Status = CommonStatus.Active
        };

        _context.Schedules.Add(schedule);
        await _context.SaveChangesAsync();

        var workingDays = request.WorkingDays ?? new List<int> { 1, 2, 3, 4, 5, 6 };
        for (int i = 0; i < 7; i++)
        {
            _context.WorkDays.Add(new WorkDay
            {
                ScheduleId = schedule.Id,
                DayOfWeek = (DayOfWeek)i,
                IsWorkingDay = workingDays.Contains(i)
            });
        }
        await _context.SaveChangesAsync();

        return Ok(schedule);
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
        schedule.HasMealBreak = request.HasMealBreak;
        if (Enum.TryParse<MealBreakMode>(request.MealBreakMode, true, out var mbm))
        {
            schedule.MealBreakMode = mbm;
        }
        schedule.MealStartTime = ParseTime(request.MealStartTime);
        schedule.MealEndTime = ParseTime(request.MealEndTime);
        schedule.MealDurationMinutes = request.MealDurationMinutes ?? 60;
        schedule.MealToleranceMinutes = request.MealToleranceMinutes;
        schedule.IsOvernight = request.IsOvernight;
        schedule.EntryWindowStart = ParseTime(request.EntryWindowStart);
        schedule.EntryWindowEnd = ParseTime(request.EntryWindowEnd);
        schedule.MealExitWindowStart = ParseTime(request.MealExitWindowStart);
        schedule.MealExitWindowEnd = ParseTime(request.MealExitWindowEnd);
        schedule.MealReturnWindowStart = ParseTime(request.MealReturnWindowStart);
        schedule.MealReturnWindowEnd = ParseTime(request.MealReturnWindowEnd);
        schedule.ExitWindowStart = ParseTime(request.ExitWindowStart);
        schedule.ExitWindowEnd = ParseTime(request.ExitWindowEnd);
        schedule.ExpectedHours = request.ExpectedHours;

        if (!string.IsNullOrEmpty(request.Status) && Enum.TryParse<CommonStatus>(request.Status, true, out var status))
        {
            schedule.Status = status;
        }

        if (request.WorkingDays != null)
        {
            _context.WorkDays.RemoveRange(schedule.WorkDays);
            for (int i = 0; i < 7; i++)
            {
                _context.WorkDays.Add(new WorkDay
                {
                    ScheduleId = schedule.Id,
                    DayOfWeek = (DayOfWeek)i,
                    IsWorkingDay = request.WorkingDays.Contains(i)
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

        return Ok(new { message = "Horario eliminado correctamente" });
    }
}
