using Attendance.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Attendance.Infrastructure.Services;

public class PdfReportService : IPdfReportService
{
    static PdfReportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    public byte[] GenerateAttendanceReportPdf(
        string companyName,
        string branchName,
        DateTime startDate,
        DateTime endDate,
        IReadOnlyList<AttendanceReportItemDto> items)
    {
        var totalRecords = items.Count;
        var totalHours = items.Sum(x => x.HoursWorked);
        var totalLate = items.Sum(x => x.MinutesLate);
        var totalOvertime = items.Sum(x => x.OvertimeHours);

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(20);
                page.DefaultTextStyle(x => x.FontSize(9).FontFamily("Arial"));

                // Header
                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(titleCol =>
                        {
                            titleCol.Item().Text(companyName).FontSize(16).Bold().FontColor("#0969da");
                            titleCol.Item().Text($"REPORTE DE ASISTENCIA Y CONTROL BIOMÉTRICO (考勤管理报表)")
                                .FontSize(12).SemiBold().FontColor("#24292f");
                            titleCol.Item().Text($"Sucursal: {branchName} | Periodo: {startDate:yyyy-MM-dd} al {endDate:yyyy-MM-dd}")
                                .FontSize(9).FontColor("#57606a");
                        });

                        row.ConstantItem(180).Column(metaCol =>
                        {
                            metaCol.Item().AlignRight().Text($"Generado: {DateTime.Now:yyyy-MM-dd HH:mm}").FontSize(8).FontColor("#57606a");
                            metaCol.Item().AlignRight().Text($"Registros: {totalRecords}").FontSize(8).FontColor("#57606a");
                            metaCol.Item().AlignRight().Text("Sistema FA200").FontSize(8).Bold().FontColor("#1a7f37");
                        });
                    });

                    col.Item().PaddingVertical(8).LineHorizontal(1).LineColor("#d0d7de");

                    // Summary KPI Cards
                    col.Item().PaddingBottom(10).Row(kpiRow =>
                    {
                        kpiRow.RelativeItem().Border(1).BorderColor("#d0d7de").Background("#f6f8fa").Padding(6).Column(c =>
                        {
                            c.Item().Text("Total Registros").FontSize(7).FontColor("#57606a");
                            c.Item().Text(totalRecords.ToString()).FontSize(12).Bold().FontColor("#24292f");
                        });
                        kpiRow.ConstantItem(10);
                        kpiRow.RelativeItem().Border(1).BorderColor("#d0d7de").Background("#ddf4ff").Padding(6).Column(c =>
                        {
                            c.Item().Text("Horas Trabajadas").FontSize(7).FontColor("#0969da");
                            c.Item().Text($"{totalHours:F1} hrs").FontSize(12).Bold().FontColor("#0969da");
                        });
                        kpiRow.ConstantItem(10);
                        kpiRow.RelativeItem().Border(1).BorderColor("#d0d7de").Background("#fff8c5").Padding(6).Column(c =>
                        {
                            c.Item().Text("Retardos Totales").FontSize(7).FontColor("#9a6700");
                            c.Item().Text($"{totalLate} min").FontSize(12).Bold().FontColor("#9a6700");
                        });
                        kpiRow.ConstantItem(10);
                        kpiRow.RelativeItem().Border(1).BorderColor("#d0d7de").Background("#dafbe1").Padding(6).Column(c =>
                        {
                            c.Item().Text("Horas Extra").FontSize(7).FontColor("#1a7f37");
                            c.Item().Text($"{totalOvertime:F1} hrs").FontSize(12).Bold().FontColor("#1a7f37");
                        });
                    });
                });

                // Content Table
                page.Content().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(65);  // Código
                        columns.RelativeColumn(2);   // Nombre
                        columns.RelativeColumn(1.2f);// Sucursal / Depto
                        columns.ConstantColumn(65);  // Fecha
                        columns.ConstantColumn(45);  // Entrada
                        columns.ConstantColumn(45);  // Salida
                        columns.ConstantColumn(45);  // Retardo
                        columns.ConstantColumn(50);  // Horas Trab
                        columns.ConstantColumn(50);  // Horas Extra
                        columns.ConstantColumn(65);  // Estado
                    });

                    // Table Header
                    table.Header(header =>
                    {
                        string[] headerTitles = [
                            "Código", "Empleado", "Depto / Sucursal", "Fecha", "Entrada", "Salida",
                            "Retardo", "Trabajado", "H. Extra", "Estado"
                        ];

                        foreach (var title in headerTitles)
                        {
                            header.Cell().Background("#0969da").Padding(4).AlignCenter().Text(title)
                                .FontSize(8).Bold().FontColor("#ffffff");
                        }
                    });

                    // Table Rows
                    var isEven = false;
                    foreach (var item in items)
                    {
                        var bg = isEven ? "#f6f8fa" : "#ffffff";
                        isEven = !isEven;

                        table.Cell().Background(bg).Padding(3).AlignCenter().Text(item.EmployeeCode).FontSize(8);
                        table.Cell().Background(bg).Padding(3).Text(item.EmployeeName).FontSize(8).SemiBold();
                        table.Cell().Background(bg).Padding(3).Text($"{item.DepartmentName} / {item.BranchName}").FontSize(7).FontColor("#57606a");
                        table.Cell().Background(bg).Padding(3).AlignCenter().Text(item.Date.ToString("yyyy-MM-dd")).FontSize(8);
                        table.Cell().Background(bg).Padding(3).AlignCenter().Text(item.FirstEntry ?? "-").FontSize(8);
                        table.Cell().Background(bg).Padding(3).AlignCenter().Text(item.LastExit ?? "-").FontSize(8);
                        
                        var lateCell = table.Cell().Background(bg).Padding(3).AlignCenter();
                        if (item.MinutesLate > 0)
                            lateCell.Text($"{item.MinutesLate} m").FontSize(8).Bold().FontColor("#cf222e");
                        else
                            lateCell.Text("0").FontSize(8).FontColor("#57606a");

                        table.Cell().Background(bg).Padding(3).AlignCenter().Text($"{item.HoursWorked:F1}h").FontSize(8);
                        table.Cell().Background(bg).Padding(3).AlignCenter().Text($"{item.OvertimeHours:F1}h").FontSize(8);
                        
                        var statusBg = item.Status switch
                        {
                            "OnTime" => "#dafbe1",
                            "Late" => "#fff8c5",
                            "Absent" => "#ffebe9",
                            _ => "#f6f8fa"
                        };
                        var statusColor = item.Status switch
                        {
                            "OnTime" => "#1a7f37",
                            "Late" => "#9a6700",
                            "Absent" => "#cf222e",
                            _ => "#57606a"
                        };

                        table.Cell().Background(statusBg).Padding(2).AlignCenter().Text(item.Status).FontSize(7).Bold().FontColor(statusColor);
                    }
                });

                // Footer with signatures
                page.Footer().Column(col =>
                {
                    col.Item().PaddingTop(12).Row(sigRow =>
                    {
                        sigRow.RelativeItem().Column(c =>
                        {
                            c.Item().AlignCenter().LineHorizontal(1).LineColor("#8c959f");
                            c.Item().PaddingTop(2).AlignCenter().Text("Elaborado por Recursos Humanos").FontSize(7).FontColor("#57606a");
                        });
                        sigRow.ConstantItem(40);
                        sigRow.RelativeItem().Column(c =>
                        {
                            c.Item().AlignCenter().LineHorizontal(1).LineColor("#8c959f");
                            c.Item().PaddingTop(2).AlignCenter().Text("Autorizado por Gerente de Sucursal").FontSize(7).FontColor("#57606a");
                        });
                        sigRow.ConstantItem(40);
                        sigRow.RelativeItem().Column(c =>
                        {
                            c.Item().AlignCenter().LineHorizontal(1).LineColor("#8c959f");
                            c.Item().PaddingTop(2).AlignCenter().Text("Sello de Auditoría Operativa").FontSize(7).FontColor("#57606a");
                        });
                    });

                    col.Item().PaddingTop(6).Row(pageRow =>
                    {
                        pageRow.RelativeItem().Text("Documento oficial para cálculo de nómina y cumplimiento laboral").FontSize(7).Italic().FontColor("#8c959f");
                        pageRow.RelativeItem().AlignRight().Text(x =>
                        {
                            x.Span("Página ");
                            x.CurrentPageNumber();
                            x.Span(" de ");
                            x.TotalPages();
                        });
                    });
                });
            });
        });

        return document.GeneratePdf();
    }
}
