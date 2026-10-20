using Attendance.Application.Common;
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
    string Type,
    string Description,
    int Minutes = 0,
    TimeSpan? PunchTime = null,
    string? PunchMovementType = null
);

public record UpdateIncidentRequest(
    string Type,
    string Description,
    int Minutes = 0,
    TimeSpan? PunchTime = null,
    string? PunchMovementType = null
);

public record CancelIncidentRequest(
    string Reason
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
        [FromQuery] int? branchId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? date = null)
    {
        if (page < 1) page = 1;
        if (pageSize < 1 || pageSize > 100) pageSize = 20;

        var query = _context.AttendanceIncidents
            .Include(i => i.Employee)
                .ThenInclude(e => e.Branch)
            .AsNoTracking();

        if (branchId.HasValue && branchId.Value > 0)
            query = query.Where(i => i.Employee.BranchId == branchId.Value);

        if (employeeId.HasValue && employeeId.Value > 0)
            query = query.Where(i => i.EmployeeId == employeeId.Value);

        if (date.HasValue)
            query = query.Where(i => i.AttendanceDate == date.Value.Date);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<IncidentStatus>(status, true, out var incStatus))
            query = query.Where(i => i.Status == incStatus);

        var totalRecords = await query.CountAsync();
        var items = await query
            .OrderByDescending(i => i.AttendanceDate)
                .ThenByDescending(i => i.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new
            {
                i.Id,
                i.EmployeeId,
                i.Employee.EmployeeCode,
                EmployeeName = $"{i.Employee.FirstName} {i.Employee.LastName}",
                BranchName = i.Employee.Branch != null ? i.Employee.Branch.Name : "-",
                Date = i.AttendanceDate.ToString("yyyy-MM-dd"),
                Type = i.Type.ToString(),
                BilingualType = AttendanceTranslationHelper.ToBilingualIncidentType(i.Type),
                i.Description,
                i.Minutes,
                PunchTime = i.PunchTime.HasValue ? i.PunchTime.Value.ToString(@"hh\:mm") : null,
                PunchMovementType = i.PunchMovementType.HasValue ? i.PunchMovementType.Value.ToString() : null,
                Status = i.Status.ToString(),
                BilingualStatus = AttendanceTranslationHelper.ToBilingualIncidentStatus(i.Status),
                i.ApprovedBy,
                ApprovedAt = i.ApprovedAt.HasValue ? i.ApprovedAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
                i.CancellationReason,
                i.CancelledBy,
                CancelledAt = i.CancelledAt.HasValue ? i.CancelledAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
                i.CreatedBy,
                CreatedAt = i.CreatedAt.ToString("yyyy-MM-dd HH:mm")
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

    [HttpGet("{id}")]
    public async Task<IActionResult> GetIncidentById(int id)
    {
        var incident = await _context.AttendanceIncidents
            .Include(i => i.Employee)
                .ThenInclude(e => e.Branch)
            .AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == id);

        if (incident == null) return NotFound(new { message = "Incidencia no encontrada." });

        return Ok(new
        {
            incident.Id,
            incident.EmployeeId,
            incident.Employee.EmployeeCode,
            EmployeeName = $"{incident.Employee.FirstName} {incident.Employee.LastName}",
            BranchId = incident.Employee.BranchId,
            BranchName = incident.Employee.Branch?.Name ?? "-",
            Date = incident.AttendanceDate.ToString("yyyy-MM-dd"),
            Type = incident.Type.ToString(),
            BilingualType = AttendanceTranslationHelper.ToBilingualIncidentType(incident.Type),
            incident.Description,
            incident.Minutes,
            PunchTime = incident.PunchTime.HasValue ? incident.PunchTime.Value.ToString(@"hh\:mm") : null,
            PunchMovementType = incident.PunchMovementType.HasValue ? incident.PunchMovementType.Value.ToString() : null,
            Status = incident.Status.ToString(),
            BilingualStatus = AttendanceTranslationHelper.ToBilingualIncidentStatus(incident.Status),
            incident.ApprovedBy,
            ApprovedAt = incident.ApprovedAt.HasValue ? incident.ApprovedAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
            incident.CancellationReason,
            incident.CancelledBy,
            CancelledAt = incident.CancelledAt.HasValue ? incident.CancelledAt.Value.ToString("yyyy-MM-dd HH:mm") : null,
            incident.CreatedBy,
            CreatedAt = incident.CreatedAt.ToString("yyyy-MM-dd HH:mm")
        });
    }

    [HttpPost]
    public async Task<IActionResult> CreateIncident([FromBody] CreateIncidentRequest request)
    {
        if (request.EmployeeId <= 0)
            return BadRequest(new { message = "El empleado es obligatorio." });

        var emp = await _context.Employees.FindAsync(request.EmployeeId);
        if (emp == null) return NotFound(new { message = "Empleado no encontrado." });

        if (!Enum.TryParse<IncidentType>(request.Type, true, out var type))
        {
            return BadRequest(new { message = $"El tipo de incidencia '{request.Type}' no es válido." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { message = "El motivo o justificación de la incidencia es obligatorio." });
        }

        BiometricEventType? movementType = null;
        if (!string.IsNullOrWhiteSpace(request.PunchMovementType) && Enum.TryParse<BiometricEventType>(request.PunchMovementType, true, out var parsedMovement))
        {
            movementType = parsedMovement;
        }

        var username = User?.Identity?.Name 
            ?? User?.FindFirst(ClaimTypes.Name)?.Value 
            ?? User?.FindFirst(ClaimTypes.Email)?.Value 
            ?? "admin";

        var incident = new AttendanceIncident
        {
            EmployeeId = request.EmployeeId,
            AttendanceDate = request.Date.Date,
            Type = type,
            Description = request.Description.Trim(),
            Minutes = request.Minutes,
            PunchTime = request.PunchTime,
            PunchMovementType = movementType,
            Status = IncidentStatus.Pending,
            CreatedBy = username,
            CreatedAt = DateTime.UtcNow
        };

        _context.AttendanceIncidents.Add(incident);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetIncidentById), new { id = incident.Id }, incident);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateIncident(int id, [FromBody] UpdateIncidentRequest request)
    {
        var incident = await _context.AttendanceIncidents.FindAsync(id);
        if (incident == null) return NotFound(new { message = "Incidencia no encontrada." });

        if (incident.Status != IncidentStatus.Pending)
        {
            return BadRequest(new { message = "Solo se pueden editar incidencias en estado Pendiente." });
        }

        if (!Enum.TryParse<IncidentType>(request.Type, true, out var type))
        {
            return BadRequest(new { message = $"El tipo de incidencia '{request.Type}' no es válido." });
        }

        if (string.IsNullOrWhiteSpace(request.Description))
        {
            return BadRequest(new { message = "El motivo de la incidencia es obligatorio." });
        }

        BiometricEventType? movementType = null;
        if (!string.IsNullOrWhiteSpace(request.PunchMovementType) && Enum.TryParse<BiometricEventType>(request.PunchMovementType, true, out var parsedMovement))
        {
            movementType = parsedMovement;
        }

        incident.Type = type;
        incident.Description = request.Description.Trim();
        incident.Minutes = request.Minutes;
        incident.PunchTime = request.PunchTime;
        incident.PunchMovementType = movementType;
        incident.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(incident);
    }

    [HttpPut("{id}/cancel")]
    public async Task<IActionResult> CancelIncident(int id, [FromBody] CancelIncidentRequest request)
    {
        var incident = await _context.AttendanceIncidents.FindAsync(id);
        if (incident == null) return NotFound(new { message = "Incidencia no encontrada." });

        if (incident.Status != IncidentStatus.Pending)
        {
            return BadRequest(new { message = $"No se puede cancelar una incidencia con estado '{incident.Status}'. Solo se pueden cancelar incidencias pendientes." });
        }

        if (string.IsNullOrWhiteSpace(request.Reason))
        {
            return BadRequest(new { message = "El motivo de cancelación es obligatorio." });
        }

        var username = User?.Identity?.Name ?? "admin";
        incident.Status = IncidentStatus.Cancelled;
        incident.CancellationReason = request.Reason.Trim();
        incident.CancelledBy = username;
        incident.CancelledAt = DateTime.UtcNow;
        incident.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Incidencia cancelada exitosamente." });
    }

    [HttpPut("{id}/approve")]
    public async Task<IActionResult> ApproveIncident(int id)
    {
        var incident = await _context.AttendanceIncidents.FindAsync(id);
        if (incident == null) return NotFound(new { message = "Incidencia no encontrada." });

        if (incident.Status == IncidentStatus.Approved)
        {
            return BadRequest(new { message = "La incidencia ya ha sido aprobada previamente." });
        }

        if (incident.Status == IncidentStatus.Cancelled)
        {
            return BadRequest(new { message = "No se puede aprobar una incidencia que fue cancelada." });
        }

        if (incident.Status == IncidentStatus.Rejected)
        {
            return BadRequest(new { message = "No se puede aprobar directamente una incidencia previamente rechazada. Cree una nueva solicitud." });
        }

        var username = User?.Identity?.Name ?? "admin";
        incident.Status = IncidentStatus.Approved;
        incident.ApprovedBy = username;
        incident.ApprovedAt = DateTime.UtcNow;
        incident.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        // Recalculate attendance for that day so it reflects the approval
        await _attendanceProcessingService.ProcessDailyAttendanceAsync(incident.EmployeeId, incident.AttendanceDate);

        return Ok(new { message = "Incidencia aprobada y asistencia recalculada exitosamente." });
    }

    [HttpPut("{id}/reject")]
    public async Task<IActionResult> RejectIncident(int id, [FromBody] CancelIncidentRequest? request = null)
    {
        var incident = await _context.AttendanceIncidents.FindAsync(id);
        if (incident == null) return NotFound(new { message = "Incidencia no encontrada." });

        if (incident.Status == IncidentStatus.Rejected)
        {
            return BadRequest(new { message = "La incidencia ya se encuentra rechazada." });
        }

        if (incident.Status == IncidentStatus.Cancelled)
        {
            return BadRequest(new { message = "No se puede rechazar una incidencia cancelada." });
        }

        bool wasApproved = incident.Status == IncidentStatus.Approved;

        var username = User?.Identity?.Name ?? "admin";
        incident.Status = IncidentStatus.Rejected;
        incident.ApprovedBy = username;
        incident.ApprovedAt = DateTime.UtcNow;
        incident.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(request?.Reason))
        {
            incident.CancellationReason = request.Reason.Trim();
        }

        await _context.SaveChangesAsync();

        // If reversing an already approved incident, recalculate daily attendance to remove the effect!
        if (wasApproved)
        {
            await _attendanceProcessingService.ProcessDailyAttendanceAsync(incident.EmployeeId, incident.AttendanceDate);
            return Ok(new { message = "Incidencia aprobada ha sido revertida a rechazada y la asistencia fue recalculada." });
        }

        return Ok(new { message = "Incidencia rechazada exitosamente." });
    }
}
