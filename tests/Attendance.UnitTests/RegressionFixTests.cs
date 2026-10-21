using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Attendance.Api.Controllers;
using Attendance.Application.Common;
using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Attendance.Infrastructure.Data;
using Attendance.Infrastructure.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Attendance.UnitTests;

public class RegressionFixTests
{
    private (AppDbContext context, AttendanceProcessingService service) CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new AppDbContext(options);
        var logger = NullLogger<AttendanceProcessingService>.Instance;
        var service = new AttendanceProcessingService(context, logger);

        return (context, service);
    }

    private async Task<(Company company, Branch branch, Branch branch2, Employee emp, BiometricDevice dev)> SetupBaseDataAsync(AppDbContext context)
    {
        var company = new Company { Name = "华龙商业集团 (Grupo Comercial Hualong)" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch1 = new Branch { CompanyId = company.Id, Code = "BR-CENTRO", Name = "Sucursal Centro (中心店)" };
        var branch2 = new Branch { CompanyId = company.Id, Code = "BR-NORTE", Name = "Sucursal Norte (北店)" };
        context.Branches.AddRange(branch1, branch2);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            CompanyId = company.Id,
            BranchId = branch1.Id,
            EmployeeCode = "HL-001",
            FirstName = "Aaron",
            LastName = "Arenas Martínez",
            BiometricExternalId = "101",
            Status = CommonStatus.Active
        };
        context.Employees.Add(emp);

        var dev = new BiometricDevice
        {
            BranchId = branch1.Id,
            Code = "FA200-01",
            Name = "Reloj Entrada Centro",
            IpAddress = "192.168.1.200",
            Status = DeviceStatus.Online
        };
        context.BiometricDevices.Add(dev);
        await context.SaveChangesAsync();

        return (company, branch1, branch2, emp, dev);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(19)]
    [InlineData(20)]
    public async Task Test1_DashboardDayDetail_ShouldReturnAllRecords_EvenWhenLessThan20(int recordCount)
    {
        var (context, _) = CreateContext();
        var (company, branch, _, _, dev) = await SetupBaseDataAsync(context);

        var targetDate = new DateTime(2026, 10, 19);

        // Seed recordCount employees and attendances
        for (int i = 1; i <= recordCount; i++)
        {
            var emp = new Employee
            {
                CompanyId = company.Id,
                BranchId = branch.Id,
                EmployeeCode = $"EMP-{i:D3}",
                FirstName = $"Empleado_{i}",
                LastName = "Test",
                BiometricExternalId = $"{1000 + i}",
                Status = CommonStatus.Active
            };
            context.Employees.Add(emp);
            await context.SaveChangesAsync();

            var daily = new AttendanceDaily
            {
                EmployeeId = emp.Id,
                Date = targetDate,
                FirstEntry = new TimeSpan(9, 0, 0),
                LastExit = new TimeSpan(18, 0, 0),
                MinutesLate = i % 2 == 0 ? 15 : 0,
                MinutesWorked = 480,
                Status = i % 2 == 0 ? AttendanceStatus.Late : AttendanceStatus.OnTime
            };
            context.AttendanceDailies.Add(daily);

            // Add real biometric event
            context.BiometricEvents.Add(new BiometricEvent
            {
                DeviceId = dev.Id,
                EmployeeId = emp.Id,
                DeviceTimestamp = targetDate.AddHours(9),
                Method = BiometricMethod.Face,
                NativePunchCode = 0,
                EventHash = $"hash-{i}"
            });
        }
        await context.SaveChangesAsync();

        var controller = new DashboardController(context);
        var result = await controller.GetDayDetail("2026-10-19", null) as OkObjectResult;

        result.Should().NotBeNull();
        var json = JsonSerializer.Serialize(result!.Value);
        using var doc = JsonDocument.Parse(json);

        int returnedTotal = doc.RootElement.GetProperty("summary").GetProperty("total").GetInt32();
        returnedTotal.Should().Be(recordCount);

        int recordsCount = doc.RootElement.GetProperty("records").GetArrayLength();
        recordsCount.Should().Be(recordCount);
    }

    [Fact]
    public async Task Test2_DashboardDayDetail_ShouldFilterByBranchId()
    {
        var (context, _) = CreateContext();
        var (company, branch1, branch2, _, _) = await SetupBaseDataAsync(context);
        var targetDate = new DateTime(2026, 10, 19);

        // Emp in Branch 1
        var emp1 = new Employee { CompanyId = company.Id, BranchId = branch1.Id, EmployeeCode = "B1-01", FirstName = "E1", LastName = "B1" };
        // Emp in Branch 2
        var emp2 = new Employee { CompanyId = company.Id, BranchId = branch2.Id, EmployeeCode = "B2-01", FirstName = "E2", LastName = "B2" };
        context.Employees.AddRange(emp1, emp2);
        await context.SaveChangesAsync();

        context.AttendanceDailies.AddRange(
            new AttendanceDaily { EmployeeId = emp1.Id, Date = targetDate, Status = AttendanceStatus.OnTime },
            new AttendanceDaily { EmployeeId = emp2.Id, Date = targetDate, Status = AttendanceStatus.OnTime }
        );
        await context.SaveChangesAsync();

        var controller = new DashboardController(context);

        // Filter by branch1
        var resBranch1 = await controller.GetDayDetail("2026-10-19", branch1.Id) as OkObjectResult;
        resBranch1.Should().NotBeNull();
        var json1 = JsonSerializer.Serialize(resBranch1!.Value);
        using var doc1 = JsonDocument.Parse(json1);
        int totalB1 = doc1.RootElement.GetProperty("summary").GetProperty("total").GetInt32();
        totalB1.Should().Be(1);

        // Filter by branch2
        var resBranch2 = await controller.GetDayDetail("2026-10-19", branch2.Id) as OkObjectResult;
        resBranch2.Should().NotBeNull();
        var json2 = JsonSerializer.Serialize(resBranch2!.Value);
        using var doc2 = JsonDocument.Parse(json2);
        int totalB2 = doc2.RootElement.GetProperty("summary").GetProperty("total").GetInt32();
        totalB2.Should().Be(1);
    }

    [Fact]
    public async Task Test3_Shifts_CompleteFourPunches_ShouldGive8HoursWorked()
    {
        // 09:00 entrada, 14:00 salida a comida, 15:00 regreso, 18:00 salida -> 8h efectivas
        var (context, service) = CreateContext();
        var (company, branch, _, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno 09:00 - 18:00",
            StartTime = new TimeSpan(9, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            MealDurationMinutes = 60,
            ExpectedHours = 8.0m
        };
        context.Schedules.Add(schedule);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });
        await context.SaveChangesAsync();

        var shiftDate = new DateTime(2026, 10, 19);
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(9), NativePunchCode = 255, EventHash = "e1" },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(14), NativePunchCode = 255, EventHash = "e2" },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(15), NativePunchCode = 255, EventHash = "e3" },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18), NativePunchCode = 255, EventHash = "e4" }
        );
        await context.SaveChangesAsync();

        var daily = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        daily.FirstEntry.Should().Be(new TimeSpan(9, 0, 0));
        daily.MealExit.Should().Be(new TimeSpan(14, 0, 0));
        daily.MealReturn.Should().Be(new TimeSpan(15, 0, 0));
        daily.LastExit.Should().Be(new TimeSpan(18, 0, 0));
        daily.MealDurationMinutes.Should().Be(60);
        daily.MinutesWorked.Should().Be(480); // 8 horas netas
        daily.Status.Should().Be(AttendanceStatus.OnTime);
    }

    [Fact]
    public async Task Test4_Shifts_IncompleteOnePunch_ShouldBeIncompleteNotEarlyExit()
    {
        // Santiago Arenas Martínez: 14:53, sin salida visible
        var (context, service) = CreateContext();
        var (company, branch, _, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno Tarde",
            StartTime = new TimeSpan(14, 0, 0),
            EndTime = new TimeSpan(22, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            ExpectedHours = 7.0m
        };
        context.Schedules.Add(schedule);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });
        await context.SaveChangesAsync();

        var shiftDate = new DateTime(2026, 10, 19);
        context.BiometricEvents.Add(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(14).AddMinutes(53), NativePunchCode = 255, EventHash = "s1" }
        );
        await context.SaveChangesAsync();

        var daily = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        daily.FirstEntry.Should().Be(new TimeSpan(14, 53, 0));
        daily.LastExit.Should().BeNull();
        daily.Status.Should().Be(AttendanceStatus.Incomplete);
        daily.RequiresReview.Should().BeTrue();
    }

    [Fact]
    public async Task Test5_ManualAdjustment_RemovingPunches_ShouldCleanDerivedFields()
    {
        var (context, service) = CreateContext();
        var (company, branch, _, emp, _) = await SetupBaseDataAsync(context);

        var daily = new AttendanceDaily
        {
            EmployeeId = emp.Id,
            Date = new DateTime(2026, 10, 19),
            FirstEntry = new TimeSpan(8, 0, 0),
            MealExit = new TimeSpan(13, 0, 0),
            MealReturn = new TimeSpan(14, 30, 0),
            LastExit = new TimeSpan(18, 0, 0),
            MealDurationMinutes = 90,
            MealMinutesLate = 30,
            MinutesWorked = 510,
            Status = AttendanceStatus.OnTime
        };
        context.AttendanceDailies.Add(daily);
        await context.SaveChangesAsync();

        // Supervisor clears meal punches manually
        var updateReq = new ManualAttendanceUpdateRequest(
            FirstEntry: new TimeSpan(8, 0, 0),
            MealExit: null,
            MealReturn: null,
            LastExit: new TimeSpan(17, 0, 0),
            Status: "OnTime",
            ModificationReason: "Supervisor eliminó comida por error de captura",
            ModifiedBy: "Gerente Sucursal"
        );

        var updated = await service.UpdateManualAttendanceAsync(daily.Id, updateReq);

        // Meal derived fields must be cleanly reset
        updated.MealExit.Should().BeNull();
        updated.MealReturn.Should().BeNull();
        updated.MealDurationMinutes.Should().BeNull();
        updated.MealMinutesLate.Should().Be(0);
        updated.MinutesWorked.Should().Be(540); // 8:00 a 17:00 = 9h = 540 min
        updated.IsManualOverride.Should().BeTrue();
    }

    [Fact]
    public async Task Test6_Incidents_Approval_And_Reversal_ShouldRecalculateAttendance()
    {
        var (context, service) = CreateContext();
        var (company, branch, _, emp, dev) = await SetupBaseDataAsync(context);

        var shiftDate = new DateTime(2026, 10, 19);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno 08:00 - 17:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(17, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = false,
            ExpectedHours = 8.0m
        };
        context.Schedules.Add(schedule);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });
        await context.SaveChangesAsync();

        // Employee was late (09:30 vs 08:00)
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(9).AddMinutes(30), NativePunchCode = 255, EventHash = "late-entry" },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(17), NativePunchCode = 255, EventHash = "regular-exit" }
        );
        await context.SaveChangesAsync();

        var initialDaily = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);
        initialDaily.Status.Should().Be(AttendanceStatus.Late);
        initialDaily.MinutesLate.Should().Be(90);

        var controller = new IncidentsController(context, service);

        // 1. Create incident: JustifiedLate with 90 min
        var createResult = await controller.CreateIncident(new CreateIncidentRequest(
            EmployeeId: emp.Id,
            Date: shiftDate,
            Type: "JustifiedLate",
            Description: "Retardo justificado por tráfico mayor",
            Minutes: 90
        )) as CreatedAtActionResult;

        createResult.Should().NotBeNull();
        var created = (AttendanceIncident)createResult!.Value!;
        created.Status.Should().Be(IncidentStatus.Pending);

        // 2. Approve incident
        var approveResult = await controller.ApproveIncident(created.Id) as OkObjectResult;
        approveResult.Should().NotBeNull();

        var updatedDaily = await context.AttendanceDailies.FirstAsync(a => a.EmployeeId == emp.Id && a.Date == shiftDate);
        updatedDaily.Status.Should().Be(AttendanceStatus.OnTime);
        updatedDaily.MinutesLate.Should().Be(0);

        // 3. Reversal: Reject the previously approved incident
        var rejectResult = await controller.RejectIncident(created.Id, new CancelIncidentRequest("Error en folio de justificación")) as OkObjectResult;
        rejectResult.Should().NotBeNull();

        var reversedDaily = await context.AttendanceDailies.FirstAsync(a => a.EmployeeId == emp.Id && a.Date == shiftDate);
        reversedDaily.Status.Should().Be(AttendanceStatus.Late);
        reversedDaily.MinutesLate.Should().Be(90);
    }

    [Fact]
    public void Test7_Translations_ShouldNotExposeEnglishEnums()
    {
        foreach (AttendanceStatus status in Enum.GetValues<AttendanceStatus>())
        {
            var bilingual = AttendanceTranslationHelper.ToBilingualStatus(status);
            bilingual.Should().NotBeNullOrWhiteSpace();
            bilingual.Should().NotBe(status.ToString(), "Bilingual status must provide translated Spanish / Chinese string");
        }

        foreach (IncidentType type in Enum.GetValues<IncidentType>())
        {
            var bilingual = AttendanceTranslationHelper.ToBilingualIncidentType(type);
            bilingual.Should().NotBeNullOrWhiteSpace();
            bilingual.Should().NotBe(type.ToString(), "Bilingual incident type must provide translated Spanish / Chinese string");
        }
    }

    [Fact]
    public async Task Test8_ReportsController_ExportCsv_ShouldIncludeBOMAndSameColumns()
    {
        var (context, _) = CreateContext();
        var (company, branch, _, emp, _) = await SetupBaseDataAsync(context);

        var targetDate = new DateTime(2026, 10, 19);
        context.AttendanceDailies.Add(new AttendanceDaily
        {
            EmployeeId = emp.Id,
            Date = targetDate,
            FirstEntry = new TimeSpan(9, 0, 0),
            MealExit = new TimeSpan(14, 0, 0),
            MealReturn = new TimeSpan(15, 0, 0),
            LastExit = new TimeSpan(18, 0, 0),
            MinutesLate = 0,
            MinutesWorked = 480,
            Status = AttendanceStatus.OnTime
        });
        await context.SaveChangesAsync();

        var pdfService = new PdfReportService();
        var controller = new ReportsController(context, pdfService);

        var fileResult = await controller.ExportCsv(targetDate, targetDate, branch.Id) as FileContentResult;
        fileResult.Should().NotBeNull();

        byte[] bytes = fileResult!.FileContents;
        // Verify UTF-8 BOM: EF BB BF
        bytes.Length.Should().BeGreaterThan(3);
        bytes[0].Should().Be(0xEF);
        bytes[1].Should().Be(0xBB);
        bytes[2].Should().Be(0xBF);

        var csvText = System.Text.Encoding.UTF8.GetString(bytes);
        csvText.Should().Contain("Empleado / 员工");
        csvText.Should().Contain("HL-001");
    }
}
