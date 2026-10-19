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

public class AttendanceCalculationTests
{
    private (AppDbContext context, AttendanceProcessingService service) CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new AppDbContext(options);
        var logger = NullLogger<AttendanceProcessingService>.Instance;
        var service = new AttendanceProcessingService(context, logger);

        return (context, service);
    }

    [Fact]
    public async Task ProcessDailyAttendance_WhenPunchedOnTime_ShouldBeOnTime()
    {
        // Arrange
        var (context, service) = CreateInMemoryContext();

        var company = new Company { Name = "Test Co" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch = new Branch { CompanyId = company.Id, Code = "BR1", Name = "Branch 1" };
        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "08:00 - 18:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            ExpectedHours = 9.0m
        };
        context.Schedules.Add(schedule);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            EmployeeCode = "EMP001",
            FirstName = "Juan",
            LastName = "Pérez",
            BiometricExternalId = "EMP001"
        };
        context.Employees.Add(emp);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });

        var device = new BiometricDevice { BranchId = branch.Id, Code = "DEV1", Name = "Device 1" };
        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        var date = new DateTime(2026, 9, 24); // Thursday

        // Punches: 07:56:00 and 18:04:00
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(7, 56, 0)),
            EventHash = "hash1"
        });
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(18, 4, 0)),
            EventHash = "hash2"
        });
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, date);

        // Assert
        result.Status.Should().Be(AttendanceStatus.OnTime);
        result.MinutesLate.Should().Be(0);
        result.FirstEntry.Should().Be(new TimeSpan(7, 56, 0));
        result.LastExit.Should().Be(new TimeSpan(18, 4, 0));
    }

    [Fact]
    public async Task ProcessDailyAttendance_WhenPunchedLate_ShouldBeLateWithMinutesCalculated()
    {
        // Arrange
        var (context, service) = CreateInMemoryContext();

        var company = new Company { Name = "Test Co" };
        var branch = new Branch { CompanyId = 1, Code = "BR1", Name = "Branch 1" };
        var schedule = new Schedule
        {
            CompanyId = 1,
            Name = "08:00 - 18:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10
        };
        var emp = new Employee { CompanyId = 1, BranchId = 1, EmployeeCode = "EMP002", FirstName = "Li", LastName = "Wei" };
        var device = new BiometricDevice { BranchId = 1, Code = "DEV1", Name = "Device 1" };

        context.Companies.Add(company);
        context.Branches.Add(branch);
        context.Schedules.Add(schedule);
        context.Employees.Add(emp);
        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });

        var date = new DateTime(2026, 9, 24);

        // 08:24:00 entry (24 minutes late, beyond 10 min tolerance)
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(8, 24, 0)),
            EventHash = "hash_late_entry"
        });
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(18, 5, 0)),
            EventHash = "hash_late_exit"
        });
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, date);

        // Assert
        result.Status.Should().Be(AttendanceStatus.Late);
        result.MinutesLate.Should().Be(24);
    }

    [Fact]
    public async Task ProcessDailyAttendance_WhenOnlyOnePunch_ShouldBeIncomplete()
    {
        // Arrange
        var (context, service) = CreateInMemoryContext();

        var company = new Company { Name = "Test Co" };
        var branch = new Branch { CompanyId = 1, Code = "BR1", Name = "Branch 1" };
        var schedule = new Schedule { CompanyId = 1, Name = "Shift", StartTime = new TimeSpan(8, 0, 0), EndTime = new TimeSpan(18, 0, 0) };
        var emp = new Employee { CompanyId = 1, BranchId = 1, EmployeeCode = "EMP003", FirstName = "Ana", LastName = "García" };
        var device = new BiometricDevice { BranchId = 1, Code = "DEV1", Name = "Device 1" };

        context.Companies.Add(company);
        context.Branches.Add(branch);
        context.Schedules.Add(schedule);
        context.Employees.Add(emp);
        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });

        var date = new DateTime(2026, 9, 24);

        // Only 1 punch at 08:02:00
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(8, 2, 0)),
            EventHash = "hash_single_punch"
        });
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, date);

        // Assert
        result.Status.Should().Be(AttendanceStatus.Incomplete);
        result.FirstEntry.Should().Be(new TimeSpan(8, 2, 0));
        result.LastExit.Should().BeNull();
    }

    [Fact]
    public void ComputeHash_WhenSameParameters_ShouldBeDeterministicSHA256()
    {
        // Arrange
        var timestamp = new DateTime(2026, 9, 24, 7, 58, 32);

        // Act
        var hash1 = BiometricEvent.ComputeHash("FA200-CENTRO-01", "EMP0001", timestamp, BiometricMethod.Face);
        var hash2 = BiometricEvent.ComputeHash("FA200-CENTRO-01", "EMP0001", timestamp, BiometricMethod.Face);
        var hashDifferentTime = BiometricEvent.ComputeHash("FA200-CENTRO-01", "EMP0001", timestamp.AddSeconds(1), BiometricMethod.Face);

        // Assert
        hash1.Should().NotBeNullOrWhiteSpace();
        hash1.Should().Be(hash2);
        hash1.Should().NotBe(hashDifferentTime);
    }

    [Fact]
    public async Task ProcessDailyAttendance_WhenExitedEarly_ShouldBeEarlyExit()
    {
        // Arrange
        var (context, service) = CreateInMemoryContext();

        var company = new Company { Name = "Test Co" };
        var branch = new Branch { CompanyId = 1, Code = "BR1", Name = "Branch 1" };
        var schedule = new Schedule
        {
            CompanyId = 1,
            Name = "08:00 - 18:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10
        };
        var emp = new Employee { CompanyId = 1, BranchId = 1, EmployeeCode = "EMP004", FirstName = "Carlos", LastName = "M" };
        var device = new BiometricDevice { BranchId = 1, Code = "DEV1", Name = "Device 1" };

        context.Companies.Add(company);
        context.Branches.Add(branch);
        context.Schedules.Add(schedule);
        context.Employees.Add(emp);
        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });

        var date = new DateTime(2026, 9, 24);

        // Punched at 07:58:00 and 15:30:00 (left 2.5 hours before 18:00)
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(7, 58, 0)),
            EventHash = "hash_early_1"
        });
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(15, 30, 0)),
            EventHash = "hash_early_2"
        });
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, date);

        // Assert
        result.Status.Should().Be(AttendanceStatus.EarlyExit);
        result.FirstEntry.Should().Be(new TimeSpan(7, 58, 0));
        result.LastExit.Should().Be(new TimeSpan(15, 30, 0));
    }

    [Fact]
    public async Task ProcessDailyAttendance_WhenWorkedPastEndTime_ShouldCalculateOvertime()
    {
        // Arrange
        var (context, service) = CreateInMemoryContext();

        var company = new Company { Name = "Test Co" };
        var branch = new Branch { CompanyId = 1, Code = "BR1", Name = "Branch 1" };
        var schedule = new Schedule
        {
            CompanyId = 1,
            Name = "08:00 - 17:00",
            StartTime = new TimeSpan(8, 0, 0),
            EndTime = new TimeSpan(17, 0, 0),
            MealStartTime = new TimeSpan(14, 0, 0),
            MealEndTime = new TimeSpan(15, 0, 0),
            ExpectedHours = 8.0m,
            ToleranceMinutes = 10
        };
        var emp = new Employee { CompanyId = 1, BranchId = 1, EmployeeCode = "EMP005", FirstName = "Elena", LastName = "R" };
        var device = new BiometricDevice { BranchId = 1, Code = "DEV1", Name = "Device 1" };

        context.Companies.Add(company);
        context.Branches.Add(branch);
        context.Schedules.Add(schedule);
        context.Employees.Add(emp);
        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        context.EmployeeSchedules.Add(new EmployeeSchedule
        {
            EmployeeId = emp.Id,
            ScheduleId = schedule.Id,
            ValidFrom = new DateTime(2026, 1, 1)
        });

        var date = new DateTime(2026, 9, 24);

        // Punched at 08:00:00 and 19:30:00 (worked 11.5 hrs against 9 hrs shift = 150 min overtime)
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(8, 0, 0)),
            EventHash = "hash_ot_1"
        });
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(14, 0, 0)),
            EventHash = "hash_ot_meal_1"
        });
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(15, 0, 0)),
            EventHash = "hash_ot_meal_2"
        });
        context.BiometricEvents.Add(new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = date.Add(new TimeSpan(19, 30, 0)),
            EventHash = "hash_ot_2"
        });
        await context.SaveChangesAsync();

        // Act
        var result = await service.ProcessDailyAttendanceAsync(emp.Id, date);

        // Assert
        result.Status.Should().Be(AttendanceStatus.OnTime);
        result.OvertimeMinutes.Should().Be(150);
    }
}
