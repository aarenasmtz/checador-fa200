using Attendance.Application.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/roles")]
[Authorize]
public class RolesController : ControllerBase
{
    private readonly IAppDbContext _context;

    public RolesController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _context.Roles
            .Include(r => r.RolePermissions)
                .ThenInclude(rp => rp.Permission)
            .AsNoTracking()
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                Permissions = r.RolePermissions.Select(rp => rp.Permission.Code).ToList()
            })
            .ToListAsync();

        return Ok(roles);
    }

    [HttpGet("permissions")]
    public async Task<IActionResult> GetPermissions()
    {
        var permissions = await _context.Permissions
            .AsNoTracking()
            .Select(p => new
            {
                p.Id,
                p.Code,
                p.Module,
                p.Description
            })
            .ToListAsync();

        return Ok(permissions);
    }
}
