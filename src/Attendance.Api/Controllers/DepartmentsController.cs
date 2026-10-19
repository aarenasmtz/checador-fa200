using Attendance.Application.DTOs;
using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/departments")]
[Authorize]
public class DepartmentsController : ControllerBase
{
    private readonly IAppDbContext _context;

    public DepartmentsController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetDepartments()
    {
        var depts = await _context.Departments
            .Include(d => d.Employees)
            .AsNoTracking()
            .Select(d => new DepartmentDto(
                d.Id,
                d.CompanyId,
                d.Name,
                d.Status.ToString(),
                d.Employees.Count(e => e.Status == CommonStatus.Active)
            ))
            .ToListAsync();

        return Ok(depts);
    }

    [HttpPost]
    public async Task<IActionResult> CreateDepartment([FromBody] CreateDepartmentRequest request)
    {
        var company = await _context.Companies.FirstOrDefaultAsync();
        if (company == null) return BadRequest(new { message = "No existe empresa registrada" });

        var dept = new Department
        {
            CompanyId = company.Id,
            Name = request.Name,
            Status = CommonStatus.Active
        };

        _context.Departments.Add(dept);
        await _context.SaveChangesAsync();

        return Ok(dept);
    }
}

[ApiController]
[Route("api/v1/positions")]
[Authorize]
public class PositionsController : ControllerBase
{
    private readonly IAppDbContext _context;

    public PositionsController(IAppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetPositions()
    {
        var positions = await _context.Positions
            .Include(p => p.Employees)
            .AsNoTracking()
            .Select(p => new PositionDto(
                p.Id,
                p.CompanyId,
                p.Name,
                p.Status.ToString(),
                p.Employees.Count(e => e.Status == CommonStatus.Active)
            ))
            .ToListAsync();

        return Ok(positions);
    }

    [HttpPost]
    public async Task<IActionResult> CreatePosition([FromBody] CreatePositionRequest request)
    {
        var company = await _context.Companies.FirstOrDefaultAsync();
        if (company == null) return BadRequest(new { message = "No existe empresa registrada" });

        var pos = new Position
        {
            CompanyId = company.Id,
            Name = request.Name,
            Status = CommonStatus.Active
        };

        _context.Positions.Add(pos);
        await _context.SaveChangesAsync();

        return Ok(pos);
    }
}
