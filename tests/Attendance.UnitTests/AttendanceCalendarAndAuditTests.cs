using Attendance.Api.Controllers;
using Attendance.Application.Services;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Attendance.Infrastructure.Data;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using System.Security.Claims;
using Xunit;

namespace Attendance.UnitTests;

public class AttendanceCalendarAndAuditTests
{
    private (AppDbContext context, AttendanceController controller) CreateController(string username = "admin", string role = "SUPERADMIN", int? branchId = null)
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new AppDbContext(options);
        var logger = NullLogger<AttendanceProcessingService>.Instance;
        var service = new AttendanceProcessingService(context, logger);
        var controller = new AttendanceController(context, service);

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, role)
        };
        if (branchId.HasValue)
        {
            claims.Add(new Claim("BranchId", branchId.Value.ToString()));
        }

        var identity = new ClaimsIdentity(claims, "TestAuth");
        var user = new ClaimsPrincipal(identity);

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = user,
                Connection = { RemoteIpAddress = System.Net.IPAddress.Parse("127.0.0.1") }
            }
        };

        return (context, controller);
    }

    [Fact]
    public async Task UpdateAttendanceStatus_ShouldUpdateRecord_AndRecordAuditLog()
    {
        // Arrange
        var (context, controller) = CreateController(username: "supervisor1", role: "ADMIN");

        var company = new Company { Name = "Test Company" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch = new Branch { CompanyId = company.Id, Code = "CENTRO", Name = "Sucursal Centro" };
        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            EmployeeCode = "EMP9999",
            FirstName = "Carlos",
            LastName = "Sánchez",
            Status = CommonStatus.Active,
            BiometricExternalId = "EMP9999"
        };
        context.Employees.Add(emp);
        await context.SaveChangesAsync();

        var targetDate = new DateTime(2026, 9, 28);
        var daily = new AttendanceDaily
        {
            EmployeeId = emp.Id,
            Date = targetDate,
            Status = AttendanceStatus.Absent,
            Origin = "SISTEMA"
        };
        context.AttendanceDailies.Add(daily);
        await context.SaveChangesAsync();

        // Act
        var request = new UpdateAttendanceStatusRequest("PERMISO", "Permiso médico autorizado por RH");
        var result = await controller.UpdateAttendanceStatus(emp.Id, "2026-09-28", request);

        // Assert
        result.Should().BeOfType<OkObjectResult>();

        // Verify AttendanceDaily state
        var updatedDaily = await context.AttendanceDailies.FirstAsync(a => a.EmployeeId == emp.Id && a.Date == targetDate);
        updatedDaily.Status.Should().Be(AttendanceStatus.Permission);
        updatedDaily.IsManualOverride.Should().BeTrue();
        updatedDaily.Origin.Should().Be("MANUAL");
        updatedDaily.ModifiedBy.Should().Be("supervisor1");
        updatedDaily.ModificationReason.Should().Be("Permiso médico autorizado por RH");
        updatedDaily.OriginalStatus.Should().Be(AttendanceStatus.Absent);

        // Verify AuditLog record
        var audit = await context.AuditLogs.FirstOrDefaultAsync(a => a.RecordId == $"EMP9999:2026-09-28");
        audit.Should().NotBeNull();
        audit!.Username.Should().Be("supervisor1");
        audit.Module.Should().Be("Attendance");
        audit.Action.Should().Be("ManualOverride");
        audit.NewValues.Should().Contain("supervisor1");

        using var newValuesDoc = System.Text.Json.JsonDocument.Parse(audit.NewValues!);
        newValuesDoc.RootElement.GetProperty("observacion").GetString().Should().Be("Permiso médico autorizado por RH");
    }

    [Fact]
    public async Task GetAttendanceCalendar_ShouldReturnMatrixFor14Days_AndCorrectSummary()
    {
        // Arrange
        var (context, controller) = CreateController();

        var company = new Company { Name = "Test Company" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch = new Branch { CompanyId = company.Id, Code = "CENTRO", Name = "Sucursal Centro" };
        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            EmployeeCode = "EMP0010",
            FirstName = "Aaron",
            LastName = "Arenas",
            Status = CommonStatus.Active,
            BiometricExternalId = "EMP0010"
        };
        context.Employees.Add(emp);
        await context.SaveChangesAsync();

        var startDate = new DateTime(2026, 9, 28);
        var endDate = new DateTime(2026, 10, 11); // 14 days

        // Add 1 OnTime and 1 Late
        context.AttendanceDailies.Add(new AttendanceDaily
        {
            EmployeeId = emp.Id,
            Date = startDate,
            Status = AttendanceStatus.OnTime,
            FirstEntry = new TimeSpan(8, 0, 0),
            LastExit = new TimeSpan(18, 0, 0)
        });
        context.AttendanceDailies.Add(new AttendanceDaily
        {
            EmployeeId = emp.Id,
            Date = startDate.AddDays(1),
            Status = AttendanceStatus.Late,
            MinutesLate = 15,
            FirstEntry = new TimeSpan(8, 15, 0),
            LastExit = new TimeSpan(18, 0, 0)
        });
        await context.SaveChangesAsync();

        // Act
        var result = await controller.GetAttendanceCalendar(
            branch.Id, null, "2026-09-28", null, "2026-10-11", null, 14
        );

        // Assert
        result.Should().BeOfType<OkObjectResult>();
        var okResult = result as OkObjectResult;
        okResult.Should().NotBeNull();

        var json = System.Text.Json.JsonSerializer.Serialize(okResult!.Value);
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        doc.RootElement.GetProperty("totalDias").GetInt32().Should().Be(14);
        doc.RootElement.GetProperty("empleados").GetArrayLength().Should().Be(1);
    }
}
