using Attendance.Application.DTOs;
using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/users")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IAppDbContext _context;

    public UsersController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers([FromQuery] int page = 1, [FromQuery] int pageSize = 20)
    {
        var query = _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
            .Include(u => u.Branch)
            .AsNoTracking();

        var totalRecords = await query.CountAsync();
        var items = await query
            .OrderBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.Username,
                u.Email,
                u.FullName,
                u.BranchId,
                BranchName = u.Branch != null ? u.Branch.Name : null,
                Status = u.Status.ToString(),
                Roles = u.UserRoles.Select(ur => ur.Role.Name).ToList(),
                u.CreatedAt
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
    public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
    {
        if (await _context.Users.AnyAsync(u => u.Username == request.Username || u.Email == request.Email))
        {
            return BadRequest(new { message = "El nombre de usuario o correo ya existe" });
        }

        var user = new User
        {
            Username = request.Username,
            Email = request.Email,
            FullName = request.FullName,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            BranchId = request.BranchId,
            Status = CommonStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        if (request.Roles.Any())
        {
            var roleEntities = await _context.Roles.Where(r => request.Roles.Contains(r.Name)).ToListAsync();
            foreach (var role in roleEntities)
            {
                _context.UserRoles.Add(new UserRole { UserId = user.Id, RoleId = role.Id });
            }
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, new { user.Id, user.Username, user.Email, user.FullName });
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> ToggleStatus(int id, [FromBody] CommonStatus status)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        user.Status = status;
        user.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(new { message = "Estado actualizado correctamente", status = user.Status.ToString() });
    }
}
