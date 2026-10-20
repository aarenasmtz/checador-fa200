using Attendance.Application.Common;
using Attendance.Application.Interfaces;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace Attendance.Infrastructure.Services;

public class PdfReportService : IPdfReportService
{
    private static readonly string MainFontFamily;

    static PdfReportService()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        string chosenFont = "Arial";

        try
        {
            var fontCandidates = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "Fonts", "msyh.ttc"),
                Path.Combine(AppContext.BaseDirectory, "Fonts", "simsun.ttc"),
                @"C:\Windows\Fonts\msyh.ttc",
                @"C:\Windows\Fonts\simsun.ttc"
            };

            foreach (var path in fontCandidates)
            {
                if (File.Exists(path))
                {
                    using var stream = File.OpenRead(path);
                    QuestPDF.Drawing.FontManager.RegisterFont(stream);
                    chosenFont = path.Contains("msyh") ? "Microsoft YaHei" : "SimSun";
                    break;
                }
            }
        }
        catch
        {
            // fallback
        }

        MainFontFamily = chosenFont;
    }

    public byte[] GenerateAttendanceReportPdf(
        string companyName,
        string branchName,
        DateTime startDate,
        DateTime endDate,
        IReadOnlyList<AttendanceReportItemDto> items)
    {
        var totalRecords = items.Count;
        var uniqueEmployees = items.Select(x => x.EmployeeCode).Distinct().Count();
        var totalWorkedMinutes = items.Sum(x => x.MinutesWorked);
        var totalLateMinutes = items.Sum(x => x.MinutesLate);
        var totalOvertimeMinutes = items.Sum(x => x.OvertimeMinutes);

        var totalHours = Math.Round((decimal)totalWorkedMinutes / 60m, 2);
        var totalOvertime = Math.Round((decimal)totalOvertimeMinutes / 60m, 2);

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(16);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily(MainFontFamily));

                // Header
                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(titleCol =>
                        {
                            titleCol.Item().Text(companyName).FontSize(14).Bold().FontColor("#0969da");
                            titleCol.Item().Text("REPORTE BILINGÜE DE ASISTENCIA Y CONTROL BIOMÉTRICO | 考勤管理综合报表")
                                .FontSize(11).SemiBold().FontColor("#1f2328");
                            titleCol.Item().Text($"Sucursal / 门店: {branchName}  |  Periodo / 考勤周期: {startDate:yyyy-MM-dd} ~ {endDate:yyyy-MM-dd}")
                                .FontSize(8.5f).FontColor("#57606a");
                        });

                        row.ConstantItem(200).Column(metaCol =>
                        {
                            metaCol.Item().AlignRight().Text($"Generado / 生成时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}").FontSize(7.5f).FontColor("#57606a");
                            metaCol.Item().AlignRight().Text($"Empleados / 员工: {uniqueEmployees} | Jornadas / 班次: {totalRecords}").FontSize(7.5f).FontColor("#57606a");
                            metaCol.Item().AlignRight().Text("Sistema FA200 Biometric Agent").FontSize(7.5f).Bold().FontColor("#1a7f37");
                        });
                    });

                    col.Item().PaddingVertical(6).LineHorizontal(0.8f).LineColor("#d0d7de");

                    // Summary KPI Cards (5 metrics)
                    col.Item().PaddingBottom(8).Row(kpiRow =>
                    {
                        kpiRow.RelativeItem().Border(1).BorderColor("#d0d7de").Background("#f6f8fa").Padding(5).Column(c =>
                        {
                            c.Item().Text("Empleados / 员工数").FontSize(6.5f).FontColor("#57606a");
                            c.Item().Text(uniqueEmployees.ToString()).FontSize(11).Bold().FontColor("#24292f");
                        });
                        kpiRow.ConstantItem(6);
                        kpiRow.RelativeItem().Border(1).BorderColor("#d0d7de").Background("#f6f8fa").Padding(5).Column(c =>
                        {
                            c.Item().Text("Jornadas / 考勤记录").FontSize(6.5f).FontColor("#57606a");
                            c.Item().Text(totalRecords.ToString()).FontSize(11).Bold().FontColor("#24292f");
                        });
                        kpiRow.ConstantItem(6);
                        kpiRow.RelativeItem().Border(1).BorderColor("#b6e3ff").Background("#ddf4ff").Padding(5).Column(c =>
                        {
                            c.Item().Text("Horas Trab / 总工时").FontSize(6.5f).FontColor("#0969da");
                            c.Item().Text($"{totalHours:F1} h ({AttendanceTranslationHelper.FormatMinutesAsHhMm(totalWorkedMinutes)})").FontSize(10).Bold().FontColor("#0969da");
                        });
                        kpiRow.ConstantItem(6);
                        kpiRow.RelativeItem().Border(1).BorderColor("#d4a72c").Background("#fff8c5").Padding(5).Column(c =>
                        {
                            c.Item().Text("Retardos / 迟到总计").FontSize(6.5f).FontColor("#9a6700");
                            c.Item().Text($"{totalLateMinutes} min").FontSize(11).Bold().FontColor("#9a6700");
                        });
                        kpiRow.ConstantItem(6);
                        kpiRow.RelativeItem().Border(1).BorderColor("#82e0aa").Background("#dafbe1").Padding(5).Column(c =>
                        {
                            c.Item().Text("Horas Extra / 加班").FontSize(6.5f).FontColor("#1a7f37");
                            c.Item().Text($"{totalOvertime:F1} h ({AttendanceTranslationHelper.FormatMinutesAsHhMm(totalOvertimeMinutes)})").FontSize(10).Bold().FontColor("#1a7f37");
                        });
                    });
                });

                // Content Table with 13 bilingual columns
                page.Content().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.ConstantColumn(52);   // Código / 员工编号
                        columns.RelativeColumn(1.8f); // Empleado / 员工姓名
                        columns.RelativeColumn(1.0f); // Sucursal / 门店
                        columns.RelativeColumn(1.0f); // Depto / 部门
                        columns.ConstantColumn(54);   // Fecha / 日期
                        columns.ConstantColumn(38);   // Entrada / 上班
                        columns.ConstantColumn(38);   // Sal. Comida / 午休出
                        columns.ConstantColumn(38);   // Reg. Comida / 午休入
                        columns.ConstantColumn(38);   // Salida / 下班
                        columns.ConstantColumn(42);   // Retardo / 迟到
                        columns.ConstantColumn(48);   // Horas Trab / 工时
                        columns.ConstantColumn(44);   // H. Extra / 加班
                        columns.ConstantColumn(68);   // Estado / 考勤状态
                    });

                    // Table Header (Bilingual, repeats on all pages)
                    table.Header(header =>
                    {
                        var headerDefs = new (string es, string zh)[]
                        {
                            ("Código", "员工编号"),
                            ("Empleado", "员工姓名"),
                            ("Sucursal", "门店"),
                            ("Depto", "部门"),
                            ("Fecha", "日期"),
                            ("Entrada", "上班打卡"),
                            ("Sal. Com", "午休开始"),
                            ("Reg. Com", "午休结束"),
                            ("Salida", "下班打卡"),
                            ("Retardo", "迟到(分)"),
                            ("Trabajado", "工作时长"),
                            ("H. Extra", "加班时长"),
                            ("Estado", "考勤状态")
                        };

                        foreach (var (es, zh) in headerDefs)
                        {
                            header.Cell().Background("#0969da").Border(0.5f).BorderColor("#0550ae").Padding(2.5f).AlignCenter().Column(c =>
                            {
                                c.Item().AlignCenter().Text(es).FontSize(6.5f).Bold().FontColor("#ffffff");
                                c.Item().AlignCenter().Text(zh).FontSize(5.5f).FontColor("#ddf4ff");
                            });
                        }
                    });

                    // Table Rows
                    var isEven = false;
                    foreach (var item in items)
                    {
                        var bg = isEven ? "#f6f8fa" : "#ffffff";
                        isEven = !isEven;

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter()
                            .Text(item.EmployeeCode).FontSize(7);

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2)
                            .Text(item.EmployeeName).FontSize(7.5f).SemiBold();

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2)
                            .Text(item.BranchName).FontSize(6.5f).FontColor("#57606a");

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2)
                            .Text(item.DepartmentName).FontSize(6.5f).FontColor("#57606a");

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter()
                            .Text(item.Date.ToString("yyyy-MM-dd")).FontSize(6.8f);

                        // 4 Punches
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter()
                            .Text(item.FirstEntry ?? "-").FontSize(7).FontColor(item.FirstEntry != null ? "#1f2328" : "#8c959f");

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter()
                            .Text(item.MealExit ?? "-").FontSize(6.8f).FontColor(item.MealExit != null ? "#57606a" : "#8c959f");

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter()
                            .Text(item.MealReturn ?? "-").FontSize(6.8f).FontColor(item.MealReturn != null ? "#57606a" : "#8c959f");

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter()
                            .Text(item.LastExit ?? "-").FontSize(7).FontColor(item.LastExit != null ? "#1f2328" : "#8c959f");

                        // Retardo
                        var lateCell = table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter();
                        if (item.MinutesLate > 0)
                            lateCell.Text($"{item.MinutesLate} m").FontSize(7).Bold().FontColor("#cf222e");
                        else
                            lateCell.Text("0").FontSize(7).FontColor("#8c959f");

                        // Horas Trabajadas
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter()
                            .Text(AttendanceTranslationHelper.FormatMinutesAsHhMm(item.MinutesWorked)).FontSize(7).SemiBold();

                        // Horas Extra
                        var otCell = table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(2).AlignCenter();
                        if (item.OvertimeMinutes > 0)
                            otCell.Text(AttendanceTranslationHelper.FormatMinutesAsHhMm(item.OvertimeMinutes)).FontSize(7).Bold().FontColor("#1a7f37");
                        else
                            otCell.Text("-").FontSize(7).FontColor("#8c959f");

                        // Bilingual Status
                        var bilingualStatus = AttendanceTranslationHelper.ToBilingualStatus(item.Status);
                        var statusBg = bilingualStatus switch
                        {
                            var s when s.Contains("A tiempo") || s.Contains("准时") => "#dafbe1",
                            var s when s.Contains("Retardo") || s.Contains("迟到") => "#fff8c5",
                            var s when s.Contains("Falta") || s.Contains("缺勤") => "#ffebe9",
                            var s when s.Contains("Incompleto") || s.Contains("不全") => "#fbefff",
                            _ => "#f6f8fa"
                        };
                        var statusColor = bilingualStatus switch
                        {
                            var s when s.Contains("A tiempo") || s.Contains("准时") => "#1a7f37",
                            var s when s.Contains("Retardo") || s.Contains("迟到") => "#9a6700",
                            var s when s.Contains("Falta") || s.Contains("缺勤") => "#cf222e",
                            var s when s.Contains("Incompleto") || s.Contains("不全") => "#8250df",
                            _ => "#57606a"
                        };

                        table.Cell().Background(statusBg).BorderBottom(0.5f).BorderColor("#eaeef2").Padding(1.5f).AlignCenter()
                            .Text(bilingualStatus).FontSize(6.2f).Bold().FontColor(statusColor);
                    }
                });

                // Footer with signatures and pagination
                page.Footer().Column(col =>
                {
                    col.Item().PaddingTop(10).Row(sigRow =>
                    {
                        sigRow.RelativeItem().Column(c =>
                        {
                            c.Item().AlignCenter().LineHorizontal(0.8f).LineColor("#8c959f");
                            c.Item().PaddingTop(2).AlignCenter().Text("Elaborado / 制表人: Recursos Humanos (人事部)").FontSize(6.5f).FontColor("#57606a");
                        });
                        sigRow.ConstantItem(30);
                        sigRow.RelativeItem().Column(c =>
                        {
                            c.Item().AlignCenter().LineHorizontal(0.8f).LineColor("#8c959f");
                            c.Item().PaddingTop(2).AlignCenter().Text("Autorizado / 审批人: Gerente de Sucursal (店长)").FontSize(6.5f).FontColor("#57606a");
                        });
                        sigRow.ConstantItem(30);
                        sigRow.RelativeItem().Column(c =>
                        {
                            c.Item().AlignCenter().LineHorizontal(0.8f).LineColor("#8c959f");
                            c.Item().PaddingTop(2).AlignCenter().Text("Auditoría / 财务稽核: Grupo Comercial Hualong").FontSize(6.5f).FontColor("#57606a");
                        });
                    });

                    col.Item().PaddingTop(4).Row(pageRow =>
                    {
                        pageRow.RelativeItem().Text("Documento oficial para cálculo de nómina y cumplimiento laboral | 华龙商业集团考勤核算凭证")
                            .FontSize(6.5f).Italic().FontColor("#8c959f");
                        pageRow.RelativeItem().AlignRight().Text(x =>
                        {
                            x.DefaultTextStyle(t => t.FontSize(6.5f).FontColor("#57606a"));
                            x.Span("Página / 页码 ");
                            x.CurrentPageNumber();
                            x.Span(" / ");
                            x.TotalPages();
                        });
                    });
                });
            });
        });

        return document.GeneratePdf();
    }
}
