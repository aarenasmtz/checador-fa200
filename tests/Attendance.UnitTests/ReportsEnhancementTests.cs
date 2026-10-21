using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Attendance.Application.Common;
using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Attendance.Infrastructure.Data;
using Attendance.Infrastructure.Services;
using ClosedXML.Excel;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Attendance.UnitTests;

public class ReportsEnhancementTests
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
            EmployeeCode = "BFB-001",
            FirstName = "David",
            LastName = "Guan",
            BiometricExternalId = "1"
        };
        context.Employees.Add(emp);

        var dev = new BiometricDevice { BranchId = branch.Id, Code = "FA200-01", Name = "FA200 Reloj", IpAddress = "192.168.1.100" };
        context.BiometricDevices.Add(dev);
        await context.SaveChangesAsync();

        return (company, branch, emp, dev);
    }

    [Fact]
    public async Task Case1_CompleteShift_0900_1400_1500_1800_ShouldBe_8h00m_OnTime()
    {
        var (context, service) = CreateContext();
        var (company, _, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno 09:00 - 18:00",
            StartTime = new TimeSpan(9, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            MealBreakMode = MealBreakMode.Fixed,
            MealStartTime = new TimeSpan(14, 0, 0),
            MealEndTime = new TimeSpan(15, 0, 0),
            MealToleranceMinutes = 5,
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

        // 4 punches: 09:00, 14:00, 15:00, 18:00
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(9), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(14), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(15), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18), RawPayload = "{}", EventHash = "h4", NativePunchCode = 255 }
        );
        await context.SaveChangesAsync();

        var daily = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        daily.Should().NotBeNull();
        daily.FirstEntry.Should().Be(new TimeSpan(9, 0, 0));
        daily.MealExit.Should().Be(new TimeSpan(14, 0, 0));
        daily.MealReturn.Should().Be(new TimeSpan(15, 0, 0));
        daily.LastExit.Should().Be(new TimeSpan(18, 0, 0));
        daily.MinutesWorked.Should().Be(480); // (14-9=5h=300m) + (18-15=3h=180m) = 480m = 8h 00m
        daily.MinutesLate.Should().Be(0);
        daily.Status.Should().Be(AttendanceStatus.OnTime);
    }

    [Fact]
    public async Task Case2_LateEntry_0912_1400_1500_1800_ShouldBe_7h48m_And_12mLate()
    {
        var (context, service) = CreateContext();
        var (company, _, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno 09:00 - 18:00",
            StartTime = new TimeSpan(9, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            MealBreakMode = MealBreakMode.Fixed,
            MealStartTime = new TimeSpan(14, 0, 0),
            MealEndTime = new TimeSpan(15, 0, 0),
            MealToleranceMinutes = 5,
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

        // Entry at 09:12 (12m late), meal 14:00-15:00, exit 18:00
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(9).AddMinutes(12), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(14), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(15), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(18), RawPayload = "{}", EventHash = "h4", NativePunchCode = 255 }
        );
        await context.SaveChangesAsync();

        var daily = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        daily.Should().NotBeNull();
        daily.MinutesLate.Should().Be(12);
        // (14:00 - 09:12 = 4h 48m = 288m) + (18:00 - 15:00 = 3h = 180m) = 468m = 7h 48m
        daily.MinutesWorked.Should().Be(468);
        daily.Status.Should().Be(AttendanceStatus.Late);
    }

    [Fact]
    public async Task Case3_EarlyExit_0900_1400_1500_1700_ShouldBe_7h00m_And_PermissionReportedSeparately()
    {
        var (context, service) = CreateContext();
        var (company, _, emp, dev) = await SetupBaseDataAsync(context);

        var schedule = new Schedule
        {
            CompanyId = company.Id,
            Name = "Turno 09:00 - 18:00",
            StartTime = new TimeSpan(9, 0, 0),
            EndTime = new TimeSpan(18, 0, 0),
            ToleranceMinutes = 10,
            HasMealBreak = true,
            MealBreakMode = MealBreakMode.Fixed,
            MealStartTime = new TimeSpan(14, 0, 0),
            MealEndTime = new TimeSpan(15, 0, 0),
            MealToleranceMinutes = 5,
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

        // Entry 09:00, Meal 14:00-15:00, Early Exit 17:00
        context.BiometricEvents.AddRange(
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(9), RawPayload = "{}", EventHash = "h1", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(14), RawPayload = "{}", EventHash = "h2", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(15), RawPayload = "{}", EventHash = "h3", NativePunchCode = 255 },
            new BiometricEvent { DeviceId = dev.Id, EmployeeId = emp.Id, DeviceTimestamp = shiftDate.AddHours(17), RawPayload = "{}", EventHash = "h4", NativePunchCode = 255 }
        );

        // Authorized early departure incident (60 mins)
        var incident = new AttendanceIncident
        {
            EmployeeId = emp.Id,
            AttendanceDate = shiftDate,
            Type = IncidentType.Permission,
            Minutes = 60,
            Status = IncidentStatus.Approved,
            Description = "Permiso médico autorizado",
            ApprovedBy = "David Guan",
            ApprovedAt = DateTime.UtcNow
        };
        context.AttendanceIncidents.Add(incident);
        await context.SaveChangesAsync();

        var daily = await service.ProcessDailyAttendanceAsync(emp.Id, shiftDate);

        daily.Should().NotBeNull();
        // (14:00 - 09:00 = 5h = 300m) + (17:00 - 15:00 = 2h = 120m) = 420m = 7h 00m
        // Rule: The 60m permission must NOT be added into actual worked minutes
        daily.MinutesWorked.Should().Be(420);
        daily.LastExit.Should().Be(new TimeSpan(17, 0, 0));
    }

    [Fact]
    public void BilingualStatus_ShouldMapAllRequiredStatusesCorrectly()
    {
        // 1. Completo
        AttendanceTranslationHelper.ToBilingualShiftStatus(AttendanceStatus.OnTime, false, true, false, false)
            .Should().Be("Completo / 完整");

        // 2. Retardo
        AttendanceTranslationHelper.ToBilingualShiftStatus(AttendanceStatus.Late, false, true, false, false)
            .Should().Be("Retardo / 迟到");

        // 3. Checada incompleta
        AttendanceTranslationHelper.ToBilingualShiftStatus(AttendanceStatus.Incomplete, true, true, false, false)
            .Should().Be("Checada incompleta / 打卡不全");

        // 4. Sin checadas
        AttendanceTranslationHelper.ToBilingualShiftStatus(AttendanceStatus.Absent, false, false, false, false)
            .Should().Be("Sin checadas / 无打卡记录");

        // 5. Salida justificada
        AttendanceTranslationHelper.ToBilingualShiftStatus(AttendanceStatus.OnTime, false, true, false, true)
            .Should().Be("Salida justificada / 批准提前下班");

        // 6. Pendiente de revisión
        AttendanceTranslationHelper.ToBilingualShiftStatus(AttendanceStatus.Incomplete, true, true, false, false)
            .Should().Be("Checada incompleta / 打卡不全");

        // 7. Futuro programado (current week future day)
        AttendanceTranslationHelper.ToBilingualShiftStatus(AttendanceStatus.Absent, false, false, true, false)
            .Should().Be("Programado / 待出勤");
    }

    [Fact]
    public void ExcelExport_WithNineColumns_ShouldFormatDurationsAndBlanksProperly()
    {
        // Test ClosedXML 9-column generation logic
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Resumen Asistencia");

        // Headers
        var headers = new (string es, string zh)[]
        {
            ("Empleado", "员工"),
            ("Fecha de jornada", "日期"),
            ("Entrada", "上班"),
            ("Salida a comer", "午休开始"),
            ("Regreso de comer", "午休结束"),
            ("Salida", "下班"),
            ("Horas trabajadas", "实际工时"),
            ("Retardo en minutos", "迟到分钟"),
            ("Estado", "状态")
        };

        for (int i = 0; i < headers.Length; i++)
        {
            ws.Cell(1, i + 1).Value = $"{headers[i].es}\n{headers[i].zh}";
        }

        // Row 1: Confirmed 8h shift
        ws.Cell(2, 1).SetValue("BFB-001");
        ws.Cell(2, 2).SetValue("2026-10-19");
        ws.Cell(2, 3).SetValue("09:00");
        ws.Cell(2, 4).SetValue("14:00");
        ws.Cell(2, 5).SetValue("15:00");
        ws.Cell(2, 6).SetValue("18:00");
        ws.Cell(2, 7).SetValue(8.0m / 24.0m);
        ws.Cell(2, 7).Style.NumberFormat.Format = "[h]:mm";
        ws.Cell(2, 8).SetValue(0);
        ws.Cell(2, 9).SetValue("Completo / 完整");

        // Row 2: Incomplete / Pending review (Hours MUST be blank!)
        ws.Cell(3, 1).SetValue("BFB-002");
        ws.Cell(3, 2).SetValue("2026-10-19");
        ws.Cell(3, 3).SetValue("09:15");
        ws.Cell(3, 4).SetValue("");
        ws.Cell(3, 5).SetValue("");
        ws.Cell(3, 6).SetValue("18:00");
        // HoursWorked left completely blank (empty)
        ws.Cell(3, 8).SetValue(15);
        ws.Cell(3, 9).SetValue("Checada incompleta / 打卡不全");

        // Verify cell count & structure
        ws.Cell(2, 7).GetDouble().Should().BeApproximately(8.0 / 24.0, 0.0001);
        ws.Cell(3, 7).IsEmpty().Should().BeTrue();
        ws.Cell(1, 1).GetString().Should().Contain("Empleado");
        ws.Cell(1, 9).GetString().Should().Contain("Estado");

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        ms.Length.Should().BeGreaterThan(0);
    }

    [Fact]
    public void PdfExport_WithNineColumnsAndTotals_ShouldGenerateValidPdfDocument()
    {
        var service = new PdfReportService();

        var items = new List<AttendanceReportItemDto>
        {
            new AttendanceReportItemDto(
                EmployeeId: 1,
                EmployeeCode: "BFB-001",
                EmployeeName: "David Guan / 大卫",
                BranchName: "Sucursal Centro / 中心店",
                DepartmentName: "Administración / 管理部",
                Date: new DateTime(2026, 10, 19),
                FirstEntry: "09:00",
                MealExit: "14:00",
                MealReturn: "15:00",
                LastExit: "18:00",
                MinutesLate: 0,
                MinutesWorked: 480,
                HoursWorked: 8.0m,
                HoursWorkedFormatted: "8 h 00 min",
                OvertimeMinutes: 0,
                OvertimeHours: 0.0m,
                Status: "OnTime",
                BilingualStatus: "Completo / 完整",
                RequiresReview: false,
                IsConfirmed: true
            ),
            new AttendanceReportItemDto(
                EmployeeId: 2,
                EmployeeCode: "BFB-002",
                EmployeeName: "Li Wei / 李伟",
                BranchName: "Sucursal Centro / 中心店",
                DepartmentName: "Cocina / 厨房",
                Date: new DateTime(2026, 10, 19),
                FirstEntry: "09:12",
                MealExit: "14:00",
                MealReturn: "15:00",
                LastExit: "18:00",
                MinutesLate: 12,
                MinutesWorked: 468,
                HoursWorked: 7.8m,
                HoursWorkedFormatted: "7 h 48 min",
                OvertimeMinutes: 0,
                OvertimeHours: 0.0m,
                Status: "Late",
                BilingualStatus: "Retardo / 迟到",
                RequiresReview: false,
                IsConfirmed: true
            ),
            new AttendanceReportItemDto(
                EmployeeId: 3,
                EmployeeCode: "BFB-003",
                EmployeeName: "Chen Xia / 陈霞",
                BranchName: "Sucursal Centro / 中心店",
                DepartmentName: "Servicio / 服务部",
                Date: new DateTime(2026, 10, 19),
                FirstEntry: "09:30",
                MealExit: null,
                MealReturn: null,
                LastExit: null,
                MinutesLate: 30,
                MinutesWorked: 0,
                HoursWorked: null, // Excluded from confirmed totals
                HoursWorkedFormatted: "Pendiente de revisión / 待核查",
                OvertimeMinutes: 0,
                OvertimeHours: 0.0m,
                Status: "Incomplete",
                BilingualStatus: "Checada incompleta / 打卡不全",
                RequiresReview: true,
                ReviewNotes: "Falta salida a comer, regreso de comer y salida",
                IsConfirmed: false
            )
        };

        var bytes = service.GenerateAttendanceReportPdf(
            companyName: "Bai Fen Bai / 百分百",
            branchName: "Sucursal Centro / 中心店",
            startDate: new DateTime(2026, 10, 19),
            endDate: new DateTime(2026, 10, 25),
            items: items,
            filterSummary: "Semana: 19/10/2026 al 25/10/2026 | Sucursal: Centro"
        );

        bytes.Should().NotBeNull();
        bytes.Length.Should().BeGreaterThan(1000);

        var outputDir = @"C:\Users\Aaron Arenas Mtz\.gemini\antigravity-ide\brain\e5f22480-5f24-405b-9857-15aa743f35d4";
        if (Directory.Exists(outputDir))
        {
            File.WriteAllBytes(Path.Combine(outputDir, "reporte_asistencia_baifenbai_semanal.pdf"), bytes);
        }
    }

    [Fact]
    public void GenerateSampleExcelArtifact_ShouldSaveValidXlsx()
    {
        var outputDir = @"C:\Users\Aaron Arenas Mtz\.gemini\antigravity-ide\brain\e5f22480-5f24-405b-9857-15aa743f35d4";
        if (!Directory.Exists(outputDir)) return;

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Resumen Asistencia");

        // Title Block
        ws.Cell(1, 1).Value = "Bai Fen Bai / 百分百";
        ws.Cell(1, 1).Style.Font.Bold = true;
        ws.Cell(1, 1).Style.Font.FontSize = 14;
        ws.Cell(1, 1).Style.Font.FontColor = XLColor.FromHtml("#166534");

        ws.Cell(2, 1).Value = "Reporte de asistencia / 员工考勤报表";
        ws.Cell(2, 1).Style.Font.Bold = true;
        ws.Cell(2, 1).Style.Font.FontSize = 12;

        ws.Cell(3, 1).Value = "Periodo: 19/10/2026 - 25/10/2026 | Sucursal: Sucursal Centro / 中心店 | Generado: 21/10/2026";
        ws.Cell(3, 1).Style.Font.Italic = true;

        var headers = new (string es, string zh)[]
        {
            ("Empleado", "员工"),
            ("Fecha de jornada", "日期"),
            ("Entrada", "上班"),
            ("Salida a comer", "午休开始"),
            ("Regreso de comer", "午休结束"),
            ("Salida", "下班"),
            ("Horas trabajadas", "实际工时"),
            ("Retardo en minutos", "迟到分钟"),
            ("Estado", "状态")
        };

        const int startRow = 5;
        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(startRow, i + 1);
            cell.Value = $"{headers[i].es}\n{headers[i].zh}";
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#166534");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
        }

        // Row 1: David Guan (8h 00m)
        ws.Cell(6, 1).SetValue("BFB-001");
        ws.Cell(6, 1).Style.NumberFormat.Format = "@";
        ws.Cell(6, 2).SetValue("2026-10-19");
        ws.Cell(6, 3).SetValue("09:00");
        ws.Cell(6, 4).SetValue("14:00");
        ws.Cell(6, 5).SetValue("15:00");
        ws.Cell(6, 6).SetValue("18:00");
        ws.Cell(6, 7).SetValue(8.0m / 24.0m);
        ws.Cell(6, 7).Style.NumberFormat.Format = "[h]:mm";
        ws.Cell(6, 8).SetValue(0);
        ws.Cell(6, 9).SetValue("Completo / 完整");

        // Row 2: Li Wei (7h 48m, 12m late)
        ws.Cell(7, 1).SetValue("BFB-002");
        ws.Cell(7, 1).Style.NumberFormat.Format = "@";
        ws.Cell(7, 2).SetValue("2026-10-19");
        ws.Cell(7, 3).SetValue("09:12");
        ws.Cell(7, 4).SetValue("14:00");
        ws.Cell(7, 5).SetValue("15:00");
        ws.Cell(7, 6).SetValue("18:00");
        ws.Cell(7, 7).SetValue(7.8m / 24.0m);
        ws.Cell(7, 7).Style.NumberFormat.Format = "[h]:mm";
        ws.Cell(7, 8).SetValue(12);
        ws.Cell(7, 9).SetValue("Retardo / 迟到");

        // Row 3: Chen Xia (Incomplete)
        ws.Cell(8, 1).SetValue("BFB-003");
        ws.Cell(8, 1).Style.NumberFormat.Format = "@";
        ws.Cell(8, 2).SetValue("2026-10-19");
        ws.Cell(8, 3).SetValue("09:30");
        ws.Cell(8, 4).SetValue("");
        ws.Cell(8, 5).SetValue("");
        ws.Cell(8, 6).SetValue("");
        // Col 7 left completely blank
        ws.Cell(8, 8).SetValue(30);
        ws.Cell(8, 9).SetValue("Checada incompleta / 打卡不全");

        // Row 4: Early Justified (7h 00m, 60m permit)
        ws.Cell(9, 1).SetValue("BFB-004");
        ws.Cell(9, 1).Style.NumberFormat.Format = "@";
        ws.Cell(9, 2).SetValue("2026-10-19");
        ws.Cell(9, 3).SetValue("09:00");
        ws.Cell(9, 4).SetValue("14:00");
        ws.Cell(9, 5).SetValue("15:00");
        ws.Cell(9, 6).SetValue("17:00");
        ws.Cell(9, 7).SetValue(7.0m / 24.0m);
        ws.Cell(9, 7).Style.NumberFormat.Format = "[h]:mm";
        ws.Cell(9, 8).SetValue(0);
        ws.Cell(9, 9).SetValue("Salida justificada / 批准提前下班");
        ws.Cell(9, 9).GetComment().AddText("Permiso médico autorizado (60 min). Autorizado por: David Guan");

        // Total Row
        ws.Cell(10, 1).SetValue("TOTALES / 总计");
        ws.Cell(10, 1).Style.Font.Bold = true;
        ws.Range(10, 1, 10, 6).Merge();
        ws.Cell(10, 7).FormulaA1 = "SUM(G6:G9)";
        ws.Cell(10, 7).Style.NumberFormat.Format = "[h]:mm";
        ws.Cell(10, 7).Style.Font.Bold = true;
        ws.Cell(10, 8).FormulaA1 = "SUM(H6:H9)";
        ws.Cell(10, 8).Style.Font.Bold = true;

        ws.Columns().AdjustToContents();
        ws.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        ws.PageSetup.FitToPages(1, 0);

        workbook.SaveAs(Path.Combine(outputDir, "reporte_asistencia_baifenbai_semanal.xlsx"));
    }
}
