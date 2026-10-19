using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Attendance.Infrastructure.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Attendance.UnitTests;

public class FourPunchesAndShiftsTests
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

    private async Task<(Company company, Branch branch, Employee emp, BiometricDevice dev)> SetupBaseDataAsync(AppDbContext context)
    {
        var company = new Company { Name = "Test Company" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch = new Branch { CompanyId = company.Id, Code = "BR1", Name = "Sucursal Principal" };
        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            EmployeeCode = "EMP100",
            FirstName = "Carlos",
            LastName = "López",
            BiometricExternalId = "1"
        };
        context.Employees.Add(emp);

        var dev = new BiometricDevice { BranchId = branch.Id, Code = "FA200-01", Name = "FA200 Reloj", IpAddress = "192.168.100.21" };
        context.BiometricDevices.Add(dev);
        await context.SaveChangesAsync();

        return (company, branch, emp, dev);
    }

    [Fact]
    public async Task Test1_CompleteFourPunches_ShouldCalculatePunchesAndMealCorrectly()
    {
        // 1. Jornada completa con 4 marcaciones
        var (context, service) = CreateContext();
        var (company, branch, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno Matutino 08:00 - 18:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            MealBreakMode = MealBreakMode.Fixed,
            MealStartTime = new TimeSpan(13, 0, 0),
            MealEndTime = new TimeSpan(14, 0, 0),
            MealToleranceMinutes = 5,
            ExpectedHours = 9.0m
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

        // 4 Punches: 07:58 (Entrada), 13:02 (Salida comida), 13:58 (Regreso comida), 18:05 (Salida)
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(7).AddMinutes(58), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(13).AddMinutes(2), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(13).AddMinutes(58), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18).AddMinutes(5), RawPayload = "{}", EventHash = "h4", NativePunchCode = 255 }
        );
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        // Assert
        result.Should().NotBeNull();
        result.FirstEntry.Should().Be(new TimeSpan(7, 58, 0));
        result.MealExit.Should().Be(new TimeSpan(13, 2, 0));
        result.MealReturn.Should().Be(new TimeSpan(13, 58, 0));
        result.LastExit.Should().Be(new TimeSpan(18, 5, 0));
        result.MealDurationMinutes.Should().Be(56);
        result.MealMinutesLate.Should().Be(0);
        result.MinutesLate.Should().Be(0);
        result.Status.Should().Be(AttendanceStatus.OnTime);
        result.RequiresReview.Should().BeFalse();
        // Worked: (13:02 - 07:58 = 304m) + (18:05 - 13:58 = 247m) = 551 minutes
        result.MinutesWorked.Should().Be(551);
    }

    [Fact]
    public async Task Test2_MissingMealPunch_ShouldFlagRequiresReview_AndNotDeductMealAutomatically()
    {
        // 2. Salida a comer olvidada (3 marcaciones: Entrada, Regreso, Salida)
        var (context, service) = CreateContext();
        var (company, branch, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno Matutino 08:00 - 18:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            MealBreakMode = MealBreakMode.Fixed,
            MealStartTime = new TimeSpan(13, 0, 0),
            MealEndTime = new TimeSpan(14, 0, 0),
            MealToleranceMinutes = 5,
            ExpectedHours = 9.0m
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

        // 3 Punches: 08:00 (Entrada), 14:00 (Regreso comida sin salida), 18:00 (Salida)
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(8), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(14), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 }
        );
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        // Assert
        result.Should().NotBeNull();
        result.FirstEntry.Should().Be(new TimeSpan(8, 0, 0));
        result.LastExit.Should().Be(new TimeSpan(18, 0, 0));
        result.RequiresReview.Should().BeTrue();
        result.ReviewNotes.Should().Contain("comer");
    }

    [Fact]
    public async Task Test3_RepeatedBouncePunches_ShouldFilterDuplicatesWithin120s()
    {
        // 3. Registros repetidos en <120 segundos (rebote biométrico)
        var (context, service) = CreateContext();
        var (company, branch, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno 08:00 - 18:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            HasMealBreak = false, // continuo
            ExpectedHours = 10.0m
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

        // Entrada a las 08:00:10 y rebote a las 08:00:35 (25 seg después)
        // Salida a las 18:00:00 y rebote a las 18:00:50 (50 seg después)
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(8).AddSeconds(10), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(8).AddSeconds(35), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18).AddSeconds(50), RawPayload = "{}", EventHash = "h4", NativePunchCode = 255 }
        );
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        // Assert
        result.Should().NotBeNull();
        result.FirstEntry.Should().Be(new TimeSpan(8, 0, 10));
        result.LastExit.Should().Be(new TimeSpan(18, 0, 0));
        result.Status.Should().Be(AttendanceStatus.OnTime);

        // Verify that the duplicate event was marked as ADDITIONAL
        var events = await context.BiometricEvents.ToListAsync();
        events.Should().Contain(e => e.ClassifiedAs == "ADDITIONAL");
    }

    [Fact]
    public async Task Test4_OvernightShift_ShouldAssociatePunchesCrossingMidnight()
    {
        // 4. Turno nocturno (22:00 a 06:00 del día siguiente)
        var (context, service) = CreateContext();
        var (company, branch, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno Nocturno 22:00 - 06:00",
            StartTime = new TimeSpan(22, 0, 0),
            EndTime = new TimeSpan(6, 0, 0),
            ToleranceMinutes = 15,
            HasMealBreak = true,
            MealBreakMode = MealBreakMode.Fixed,
            MealStartTime = new TimeSpan(2, 0, 0),
            MealEndTime = new TimeSpan(2, 45, 0),
            MealToleranceMinutes = 5,
            IsOvernight = true,
            ExpectedHours = 7.25m
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

        // Punches:
        // Entrada: 19 Oct 21:55
        // Salida a comer: 20 Oct 02:02
        // Regreso de comer: 20 Oct 02:44
        // Salida de turno: 20 Oct 06:05
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(21).AddMinutes(55), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddDays(1).AddHours(2).AddMinutes(2), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddDays(1).AddHours(2).AddMinutes(44), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddDays(1).AddHours(6).AddMinutes(5), RawPayload = "{}", EventHash = "h4", NativePunchCode = 255 }
        );
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        // Assert
        result.Should().NotBeNull();
        result.FirstEntry.Should().Be(new TimeSpan(21, 55, 0));
        result.MealExit.Should().Be(new TimeSpan(2, 2, 0));
        result.MealReturn.Should().Be(new TimeSpan(2, 44, 0));
        result.LastExit.Should().Be(new TimeSpan(6, 5, 0));
        result.MealDurationMinutes.Should().Be(42);
        result.Status.Should().Be(AttendanceStatus.OnTime);
    }

    [Fact]
    public async Task Test5_OutOfOrderDelayedPunches_ReprocessShouldOrderAndCalculateAccurately()
    {
        // 5. Checadas recibidas desordenadas tras recuperar internet
        var (context, service) = CreateContext();
        var (company, branch, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno Matutino 08:00 - 18:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            MealBreakMode = MealBreakMode.Fixed,
            MealStartTime = new TimeSpan(13, 0, 0),
            MealEndTime = new TimeSpan(14, 0, 0),
            ExpectedHours = 9.0m
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

        // Inserción desordenada en BD:
        // Primero llega Salida (18:00)
        // Luego llega Entrada (08:00)
        // Luego llega Regreso comida (14:00)
        // Luego llega Salida comida (13:00)
        context.BiometricEvents.Add(new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18), RawPayload = "{}", EventHash = "h4", NativePunchCode = 255 });
        context.BiometricEvents.Add(new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(8), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 });
        context.BiometricEvents.Add(new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(14), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 });
        context.BiometricEvents.Add(new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(13), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 });
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        // Assert
        result.Should().NotBeNull();
        result.FirstEntry.Should().Be(new TimeSpan(8, 0, 0));
        result.MealExit.Should().Be(new TimeSpan(13, 0, 0));
        result.MealReturn.Should().Be(new TimeSpan(14, 0, 0));
        result.LastExit.Should().Be(new TimeSpan(18, 0, 0));
        result.MealDurationMinutes.Should().Be(60);
        result.Status.Should().Be(AttendanceStatus.OnTime);
    }
}
