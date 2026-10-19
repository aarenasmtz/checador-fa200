using Attendance.Application.DTOs;
using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/employees")]
[Authorize]
public class EmployeesController : ControllerBase
{
    private readonly IAppDbContext _context;

    public EmployeesController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetEmployees(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] string? search = null,
        [FromQuery] string? status = null)
    {
        var query = _context.Employees
            .Include(e => e.Branch)
            .Include(e => e.Department)
            .Include(e => e.Position)
            .Include(e => e.EmployeeSchedules)
                .ThenInclude(es => es.Schedule)
            .AsNoTracking();

        if (branchId.HasValue)
            query = query.Where(e => e.BranchId == branchId.Value);

        if (departmentId.HasValue)
            query = query.Where(e => e.DepartmentId == departmentId.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(e => e.EmployeeCode.ToLower().Contains(s)
                                  || e.FirstName.ToLower().Contains(s)
                                  || e.LastName.ToLower().Contains(s)
                                  || (e.Email != null && e.Email.ToLower().Contains(s)));
        }

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<CommonStatus>(status, true, out var commonStatus))
        {
            query = query.Where(e => e.Status == commonStatus);
        }

        var totalRecords = await query.CountAsync();
        var items = await query
            .OrderBy(e => e.EmployeeCode)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(e => new EmployeeDto(
                e.Id,
                e.CompanyId,
                e.BranchId,
                e.Branch.Name,
                e.DepartmentId,
                e.Department != null ? e.Department.Name : null,
                e.PositionId,
                e.Position != null ? e.Position.Name : null,
                e.EmployeeCode,
                e.FirstName,
                e.LastName,
                e.Email,
                e.Phone,
                e.HireDate,
                e.TerminationDate,
                e.Status.ToString(),
                e.BiometricExternalId,
                e.EmployeeSchedules
                    .OrderByDescending(es => es.ValidFrom)
                    .Select(es => es.Schedule.Name)
                    .FirstOrDefault()
            ))
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

    [HttpGet("{id}")]
    public async Task<IActionResult> GetEmployee(int id)
    {
        var e = await _context.Employees
            .Include(e => e.Branch)
            .Include(e => e.Department)
            .Include(e => e.Position)
            .Include(e => e.EmployeeSchedules)
                .ThenInclude(es => es.Schedule)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (e == null) return NotFound();

        // Calculate this month's metrics
        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1);
        var endOfMonth = startOfMonth.AddMonths(1);

        var monthAttendances = await _context.AttendanceDailies
            .Where(a => a.EmployeeId == id && a.Date >= startOfMonth && a.Date < endOfMonth)
            .ToListAsync();

        var totalPunches = await _context.BiometricEvents
            .CountAsync(b => b.EmployeeId == id && b.DeviceTimestamp >= startOfMonth && b.DeviceTimestamp < endOfMonth);

        var daysPresent = monthAttendances.Count(a => a.Status == AttendanceStatus.OnTime || a.Status == AttendanceStatus.Late || a.Status == AttendanceStatus.EarlyExit);
        var daysLate = monthAttendances.Count(a => a.Status == AttendanceStatus.Late);
        var daysAbsent = monthAttendances.Count(a => a.Status == AttendanceStatus.Absent);
        var workedMins = monthAttendances.Sum(a => a.MinutesWorked);
        var overtimeMins = monthAttendances.Sum(a => a.OvertimeMinutes);

        var detail = new EmployeeDetailDto(
            e.Id,
            e.EmployeeCode,
            $"{e.FirstName} {e.LastName}",
            e.FirstName,
            e.LastName,
            e.Branch.Name,
            e.Department?.Name,
            e.Position?.Name,
            e.EmployeeSchedules.OrderByDescending(es => es.ValidFrom).Select(es => es.Schedule.Name).FirstOrDefault(),
            e.Email,
            e.Phone,
            e.HireDate,
            e.Status.ToString(),
            e.BiometricExternalId,
            totalPunches,
            daysPresent,
            daysLate,
            daysAbsent,
            workedMins,
            overtimeMins
        );

        return Ok(detail);
    }

    [HttpPost]
    public async Task<IActionResult> CreateEmployee([FromBody] CreateEmployeeRequest request)
    {
        if (await _context.Employees.AnyAsync(e => e.EmployeeCode == request.EmployeeCode))
        {
            return BadRequest(new { message = "El código de empleado ya está en uso" });
        }

        var branch = await _context.Branches.FindAsync(request.BranchId);
        if (branch == null) return BadRequest(new { message = "Sucursal no encontrada" });

        var emp = new Employee
        {
            CompanyId = branch.CompanyId,
            BranchId = request.BranchId,
            DepartmentId = request.DepartmentId,
            PositionId = request.PositionId,
            EmployeeCode = request.EmployeeCode.Trim().ToUpperInvariant(),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = request.Email?.Trim(),
            Phone = request.Phone?.Trim(),
            HireDate = request.HireDate,
            BiometricExternalId = string.IsNullOrWhiteSpace(request.BiometricExternalId) ? request.EmployeeCode : request.BiometricExternalId,
            Status = CommonStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _context.Employees.Add(emp);
        await _context.SaveChangesAsync();

        if (request.ScheduleId.HasValue)
        {
            _context.EmployeeSchedules.Add(new EmployeeSchedule
            {
                EmployeeId = emp.Id,
                ScheduleId = request.ScheduleId.Value,
                ValidFrom = DateTime.UtcNow.Date
            });
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetEmployee), new { id = emp.Id }, emp);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEmployee(int id, [FromBody] UpdateEmployeeRequest request)
    {
        var emp = await _context.Employees
            .Include(e => e.EmployeeSchedules)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (emp == null) return NotFound();

        emp.BranchId = request.BranchId;
        emp.DepartmentId = request.DepartmentId;
        emp.PositionId = request.PositionId;
        emp.FirstName = request.FirstName.Trim();
        emp.LastName = request.LastName.Trim();
        emp.Email = request.Email?.Trim();
        emp.Phone = request.Phone?.Trim();
        emp.TerminationDate = request.TerminationDate;
        emp.BiometricExternalId = string.IsNullOrWhiteSpace(request.BiometricExternalId) ? emp.EmployeeCode : request.BiometricExternalId;
        emp.UpdatedAt = DateTime.UtcNow;

        if (Enum.TryParse<CommonStatus>(request.Status, true, out var status))
        {
            emp.Status = status;
        }

        if (request.ScheduleId.HasValue)
        {
            var currentSchedule = emp.EmployeeSchedules.OrderByDescending(es => es.ValidFrom).FirstOrDefault();
            if (currentSchedule == null || currentSchedule.ScheduleId != request.ScheduleId.Value)
            {
                _context.EmployeeSchedules.Add(new EmployeeSchedule
                {
                    EmployeeId = emp.Id,
                    ScheduleId = request.ScheduleId.Value,
                    ValidFrom = DateTime.UtcNow.Date
                });
            }
        }

        await _context.SaveChangesAsync();
        return Ok(emp);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> ToggleStatus(int id, [FromBody] CommonStatus status)
    {
        var emp = await _context.Employees.FindAsync(id);
        if (emp == null) return NotFound();

        emp.Status = status;
        emp.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Estado de empleado actualizado", status = emp.Status.ToString() });
    }
}
