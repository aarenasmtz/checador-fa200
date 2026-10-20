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
                "EMP001",
                "张伟 / Carlos López",
                "Sucursal Centro / 中心店",
                "Cocina / 厨房",
                new DateTime(2026, 10, 19),
                "09:00",
                "14:00",
                "15:00",
                "18:00",
                0,
                480,
                8.0m,
                0,
                0.0m,
                "A tiempo / 准时"
            ),
            new AttendanceReportItemDto(
                "HL-003",
                "王芳 / María García",
                "Sucursal Norte / 北店",
                "Servicio / 服务部",
                new DateTime(2026, 10, 19),
                "09:25",
                null,
                null,
                "18:00",
                25,
                455,
                7.58m,
                0,
                0.0m,
                "Retardo / 迟到"
            )
        };

        var pdfBytes = service.GenerateAttendanceReportPdf(
            "华龙商业集团 (Grupo Comercial Hualong)",
            "Todas las Sucursales (全部分店)",
            new DateTime(2026, 10, 1),
            new DateTime(2026, 10, 19),
            items
        );

        pdfBytes.Should().NotBeNull();
        pdfBytes.Length.Should().BeGreaterThan(1000);
    }
}
