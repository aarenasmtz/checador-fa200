using Attendance.Application.DTOs;
using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/branches")]
[Authorize]
public class BranchesController : ControllerBase
{
    private readonly IAppDbContext _context;

    public BranchesController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetBranches()
    {
        var branches = await _context.Branches
            .Include(b => b.Employees)
            .Include(b => b.Devices)
            .AsNoTracking()
            .Select(b => new BranchDto(
                b.Id,
                b.CompanyId,
                b.Code,
                b.Name,
                b.Address,
                b.TimeZone,
                b.Status.ToString(),
                b.Employees.Count(e => e.Status == CommonStatus.Active),
                b.Devices.Count
            ))
            .ToListAsync();

        return Ok(branches);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetBranch(int id)
    {
        var b = await _context.Branches
            .Include(b => b.Employees)
            .Include(b => b.Devices)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (b == null) return NotFound();

        return Ok(new BranchDto(
            b.Id,
            b.CompanyId,
            b.Code,
            b.Name,
            b.Address,
            b.TimeZone,
            b.Status.ToString(),
            b.Employees.Count(e => e.Status == CommonStatus.Active),
            b.Devices.Count
        ));
    }

    [HttpPost]
    public async Task<IActionResult> CreateBranch([FromBody] CreateBranchRequest request)
    {
        var company = await _context.Companies.FirstOrDefaultAsync();
        if (company == null) return BadRequest(new { message = "No existe empresa registrada" });

        if (await _context.Branches.AnyAsync(b => b.CompanyId == company.Id && b.Code == request.Code))
        {
            return BadRequest(new { message = "El código de sucursal ya existe" });
        }

        var branch = new Branch
        {
            CompanyId = company.Id,
            Code = request.Code.ToUpperInvariant(),
            Name = request.Name,
            Address = request.Address,
            TimeZone = request.TimeZone,
            Status = CommonStatus.Active,
            CreatedAt = DateTime.UtcNow
        };

        _context.Branches.Add(branch);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetBranch), new { id = branch.Id }, branch);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateBranch(int id, [FromBody] UpdateBranchRequest request)
    {
        var branch = await _context.Branches.FindAsync(id);
        if (branch == null) return NotFound();

        branch.Name = request.Name;
        branch.Address = request.Address;
        branch.TimeZone = request.TimeZone;
        if (Enum.TryParse<CommonStatus>(request.Status, true, out var status))
        {
            branch.Status = status;
        }

        await _context.SaveChangesAsync();
        return Ok(branch);
    }
}
