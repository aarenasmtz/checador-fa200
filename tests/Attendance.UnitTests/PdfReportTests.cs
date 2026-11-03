using System;
using System.Collections.Generic;
using System.IO;
using Attendance.Application.Interfaces;
using Attendance.Infrastructure.Services;
using FluentAssertions;
using Xunit;

namespace Attendance.UnitTests;

public class PdfReportTests
{
    [Fact]
    public void GenerateAttendanceReportPdf_WithBilingualText_ShouldGenerateValidPdf()
    {
        var service = new PdfReportService();

        var items = new List<AttendanceReportItemDto>
        {
            new AttendanceReportItemDto(
                EmployeeId: 1,
                EmployeeCode: "EMP001",
                EmployeeName: "张伟 / Carlos López",
                BranchName: "Sucursal Centro / 中心店",
                DepartmentName: "Cocina / 厨房",
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
                IsConfirmed: true
            ),
            new AttendanceReportItemDto(
                EmployeeId: 2,
                EmployeeCode: "HL-003",
                EmployeeName: "王芳 / María García",
                BranchName: "Sucursal Norte / 北店",
                DepartmentName: "Servicio / 服务部",
                Date: new DateTime(2026, 10, 19),
                FirstEntry: "09:25",
                MealExit: null,
                MealReturn: null,
                LastExit: "18:00",
                MinutesLate: 25,
                MinutesWorked: 455,
                HoursWorked: null,
                HoursWorkedFormatted: "Pendiente de revisión / 待核查",
                OvertimeMinutes: 0,
                OvertimeHours: 0.0m,
                Status: "Late",
                BilingualStatus: "Retardo / 迟到",
                RequiresReview: true,
                ReviewNotes: "Omitió checadas de comida",
                IsConfirmed: false
            )
        };

        var pdfBytes = service.GenerateAttendanceReportPdf(
            "Bai Fen Bai (百分百)",
            "Todas las Sucursales (全部分店)",
            new DateTime(2026, 10, 1),
            new DateTime(2026, 10, 19),
            items,
            "Periodo: Semanal"
        );

        pdfBytes.Should().NotBeNull();
        pdfBytes.Length.Should().BeGreaterThan(1000);
    }
}
