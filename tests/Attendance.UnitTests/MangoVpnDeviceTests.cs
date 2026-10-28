using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Biometrics.Providers;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Attendance.Infrastructure.Data;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Attendance.UnitTests;

public class MangoVpnDeviceTests
{
    private (AppDbContext context, BiometricIngestionService ingestionService, Fa200BiometricProvider provider) CreateContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new AppDbContext(options);
        var logger = NullLogger<BiometricIngestionService>.Instance;
        var attLogger = NullLogger<AttendanceProcessingService>.Instance;
        var attService = new AttendanceProcessingService(context, attLogger);
        var ingestionService = new BiometricIngestionService(context, attService, logger);

        var inMemoryConfig = new Dictionary<string, string?>
        {
            { "SyncAgent:ApiKey", "fa200-sync-agent-secret-key-2026" }
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(inMemoryConfig).Build();
        var providerLogger = NullLogger<Fa200BiometricProvider>.Instance;
        var provider = new Fa200BiometricProvider(configuration, providerLogger);

        return (context, ingestionService, provider);
    }

    [Fact]
    public async Task VpnDevice_Creation_ShouldPersistAllMangoVpnFields()
    {
        var (context, _, _) = CreateContext();

        var company = new Company { Name = "Bai Fen Bai / 百分百" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch = new Branch { CompanyId = company.Id, Code = "BFB-01", Name = "Sucursal Centro / 中心店" };
        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var device = new BiometricDevice
        {
            BranchId = branch.Id,
            Code = "FA200-CENTRO-01",
            Name = "Reloj Entrada Centro (Mango VPN)",
            Model = "FA200",
            Provider = "FA200",
            ConnectionMode = DeviceConnectionMode.VpnTunnel,
            Status = DeviceStatus.Online,
            IpAddress = "10.10.1.10",
            Port = 4370,
            IsEnabled = true,
            TimeZoneId = "America/Mexico_City",
            SyncIntervalSeconds = 30,
            VpnSubnet = "10.10.1.0/24",
            VpnClientIp = "10.10.0.2"
        };

        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        var saved = await context.BiometricDevices.FirstOrDefaultAsync(d => d.Code == "FA200-CENTRO-01");

        saved.Should().NotBeNull();
        saved!.ConnectionMode.Should().Be(DeviceConnectionMode.VpnTunnel);
        saved.IpAddress.Should().Be("10.10.1.10");
        saved.Port.Should().Be(4370);
        saved.VpnSubnet.Should().Be("10.10.1.0/24");
        saved.VpnClientIp.Should().Be("10.10.0.2");
        saved.IsEnabled.Should().BeTrue();
        saved.TimeZoneId.Should().Be("America/Mexico_City");
        saved.SyncIntervalSeconds.Should().Be(30);
    }

    [Fact]
    public async Task TestConnection_ToUnreachableIp_ShouldGracefullyReturnFalseWithoutException()
    {
        var (_, _, provider) = CreateContext();

        var device = new BiometricDevice
        {
            Code = "FA200-TEST-01",
            IpAddress = "192.0.2.1", // Test-Net IP guaranteed non-routable
            Port = 4370
        };

        // Act
        var result = await provider.TestConnectionAsync(device);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task IngestionBatch_ShouldUpdateDeviceLastSuccessfulSyncAndRecordsCount()
    {
        var (context, ingestionService, _) = CreateContext();

        var company = new Company { Name = "Bai Fen Bai / 百分百" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch = new Branch { CompanyId = company.Id, Code = "BFB-01", Name = "Sucursal Centro / 中心店" };
        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            EmployeeCode = "BFB-101",
            FirstName = "David",
            LastName = "Guan",
            BiometricExternalId = "101"
        };
        context.Employees.Add(emp);

        var device = new BiometricDevice
        {
            BranchId = branch.Id,
            Code = "FA200-CENTRO-01",
            Name = "Reloj Entrada Centro (Mango VPN)",
            IpAddress = "10.10.1.10",
            Port = 4370,
            ConnectionMode = DeviceConnectionMode.VpnTunnel,
            Status = DeviceStatus.Online
        };
        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        var batchRequest = new IngestionBatchRequest(
            DeviceCode: "FA200-CENTRO-01",
            BranchId: branch.Id,
            Events: new List<IngestionBatchItem>
            {
                new IngestionBatchItem(
                    UserClockId: "101",
                    Timestamp: new DateTime(2026, 10, 28, 9, 0, 0),
                    Method: "Face",
                    EventType: "Punch",
                    ExternalEventId: "ev1",
                    RawPayload: "{}"
                ),
                new IngestionBatchItem(
                    UserClockId: "101",
                    Timestamp: new DateTime(2026, 10, 28, 14, 0, 0),
                    Method: "Face",
                    EventType: "Punch",
                    ExternalEventId: "ev2",
                    RawPayload: "{}"
                )
            }
        );

        // Act
        var result = await ingestionService.IngestBatchAsync(batchRequest);

        // Assert
        result.Success.Should().BeTrue();
        result.PersistedCount.Should().Be(2);

        var updatedDevice = await context.BiometricDevices.FindAsync(device.Id);
        updatedDevice!.LastSuccessfulSyncAt.Should().NotBeNull();
        updatedDevice.LastSyncRecordsCount.Should().Be(2);
        updatedDevice.Status.Should().Be(DeviceStatus.Online);
        updatedDevice.LastErrorMessage.Should().BeNull();
    }

    [Fact]
    public async Task IngestionBatch_RepeatedSync_ShouldBeIdempotentWithoutDuplicates()
    {
        var (context, ingestionService, _) = CreateContext();

        var company = new Company { Name = "Bai Fen Bai / 百分百" };
        context.Companies.Add(company);
        await context.SaveChangesAsync();

        var branch = new Branch { CompanyId = company.Id, Code = "BFB-01", Name = "Sucursal Centro / 中心店" };
        context.Branches.Add(branch);
        await context.SaveChangesAsync();

        var emp = new Employee
        {
            CompanyId = company.Id,
            BranchId = branch.Id,
            EmployeeCode = "BFB-102",
            FirstName = "Carlos",
            LastName = "López",
            BiometricExternalId = "102"
        };
        context.Employees.Add(emp);

        var device = new BiometricDevice
        {
            BranchId = branch.Id,
            Code = "FA200-CENTRO-01",
            Name = "Reloj Entrada Centro (Mango VPN)",
            IpAddress = "10.10.1.10",
            Port = 4370,
            ConnectionMode = DeviceConnectionMode.VpnTunnel,
            Status = DeviceStatus.Online
        };
        context.BiometricDevices.Add(device);
        await context.SaveChangesAsync();

        var batchRequest = new IngestionBatchRequest(
            DeviceCode: "FA200-CENTRO-01",
            BranchId: branch.Id,
            Events: new List<IngestionBatchItem>
            {
                new IngestionBatchItem(
                    UserClockId: "102",
                    Timestamp: new DateTime(2026, 10, 28, 9, 5, 0),
                    Method: "Face",
                    EventType: "Punch"
                )
            }
        );

        // 1st sync
        var res1 = await ingestionService.IngestBatchAsync(batchRequest);
        res1.PersistedCount.Should().Be(1);
        res1.DuplicateCount.Should().Be(0);

        // 2nd sync (identical punch from clock)
        var res2 = await ingestionService.IngestBatchAsync(batchRequest);
        res2.PersistedCount.Should().Be(0);
        res2.DuplicateCount.Should().Be(1);

        // Verify database has exactly 1 record
        var eventsCount = await context.BiometricEvents.CountAsync(e => e.DeviceId == device.Id);
        eventsCount.Should().Be(1);
    }
}
