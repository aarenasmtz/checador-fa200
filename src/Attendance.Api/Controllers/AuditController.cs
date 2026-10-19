using Attendance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/audit")]
[Authorize]
public class AuditController : ControllerBase
{
    private readonly IAppDbContext _context;

    public AuditController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? module = null,
        [FromQuery] string? action = null)
    {
        var query = _context.AuditLogs.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(module))
            query = query.Where(a => a.Module == module);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);

        var totalRecords = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new
            {
                a.Id,
                a.Username,
                Timestamp = a.Timestamp.ToString("yyyy-MM-dd HH:mm:ss"),
                a.IpAddress,
                a.Module,
                a.Action,
                a.Entity,
                a.RecordId,
                a.OldValues,
                a.NewValues
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
}
