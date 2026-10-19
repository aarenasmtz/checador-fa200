using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Attendance.Api.Controllers;

public record CreateIncidentRequest(
    int EmployeeId,
    DateTime Date,
    string Type, // "PunchMiss", "JustifiedAbsence", "JustifiedLate", "Permission", "Vacation", "Disability"
    string Description,
    int Minutes = 0
);

[ApiController]
[Route("api/v1/incidents")]
[Authorize]
public class IncidentsController : ControllerBase
{
    private readonly IAppDbContext _context;
    private readonly IAttendanceProcessingService _attendanceProcessingService;

    public IncidentsController(IAppDbContext context, IAttendanceProcessingService attendanceProcessingService)
    {
        _context = context;
        _attendanceProcessingService = attendanceProcessingService;
    }

    [HttpGet]
    public async Task<IActionResult> GetIncidents(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null)
    {
        var query = _context.AttendanceIncidents
            .Include(i => i.Employee)
                .ThenInclude(e => e.Branch)
            .AsNoTracking();

        if (employeeId.HasValue)
            query = query.Where(i => i.EmployeeId == employeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<IncidentStatus>(status, true, out var incStatus))
            query = query.Where(i => i.Status == incStatus);

        var totalRecords = await query.CountAsync();
        var items = await query
            .OrderByDescending(i => i.AttendanceDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new
            {
                i.Id,
                i.EmployeeId,
                i.Employee.EmployeeCode,
                EmployeeName = $"{i.Employee.FirstName} {i.Employee.LastName}",
                BranchName = i.Employee.Branch.Name,
                Date = i.AttendanceDate.ToString("yyyy-MM-dd"),
                Type = i.Type.ToString(),
                i.Description,
                i.Minutes,
                Status = i.Status.ToString(),
                i.ApprovedBy,
                ApprovedAt = i.ApprovedAt.HasValue ? i.ApprovedAt.Value.ToString("yyyy-MM-dd HH:mm") : null
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

    [HttpPost]
    public async Task<IActionResult> CreateIncident([FromBody] CreateIncidentRequest request)
    {
        var emp = await _context.Employees.FindAsync(request.EmployeeId);
        if (emp == null) return NotFound(new { message = "Empleado no encontrado" });

        if (!Enum.TryParse<IncidentType>(request.Type, true, out var type))
        {
            type = IncidentType.Permission;
        }

        var incident = new AttendanceIncident
        {
            EmployeeId = request.EmployeeId,
            AttendanceDate = request.Date.Date,
            Type = type,
            Description = request.Description,
            Minutes = request.Minutes,
            Status = IncidentStatus.Pending
        };

        _context.AttendanceIncidents.Add(incident);
        await _context.SaveChangesAsync();

        return Ok(incident);
    }

    [HttpPut("{id}/approve")]
    public async Task<IActionResult> ApproveIncident(int id)
    {
        var incident = await _context.AttendanceIncidents.FindAsync(id);
        if (incident == null) return NotFound();

        var username = User.Identity?.Name ?? "admin";
        incident.Status = IncidentStatus.Approved;
        incident.ApprovedBy = username;
        incident.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Reprocess attendance for that day so it reflects the approval
        await _attendanceProcessingService.ProcessDailyAttendanceAsync(incident.EmployeeId, incident.AttendanceDate);

        return Ok(new { message = "Incidencia aprobada y asistencia recalculada exitosamente" });
    }

    [HttpPut("{id}/reject")]
    public async Task<IActionResult> RejectIncident(int id)
    {
        var incident = await _context.AttendanceIncidents.FindAsync(id);
        if (incident == null) return NotFound();

        var username = User.Identity?.Name ?? "admin";
        incident.Status = IncidentStatus.Rejected;
        incident.ApprovedBy = username;
        incident.ApprovedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Incidencia rechazada" });
    }
}
