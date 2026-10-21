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
                "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
                "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
                "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
                @"C:\Windows\Fonts\msyh.ttc",
                @"C:\Windows\Fonts\simsun.ttc"
            };

            foreach (var path in fontCandidates)
            {
                if (File.Exists(path))
                {
                    using var stream = File.OpenRead(path);
                    QuestPDF.Drawing.FontManager.RegisterFont(stream);
                    if (path.Contains("msyh")) chosenFont = "Microsoft YaHei";
                    else if (path.Contains("simsun")) chosenFont = "SimSun";
                    else if (path.Contains("NotoSansCJK")) chosenFont = "Noto Sans CJK SC";
                    else if (path.Contains("wqy")) chosenFont = "WenQuanYi Zen Hei";
                    break;
                }
            }
        }
        catch
        {
            // Fallback font
        }

        MainFontFamily = chosenFont;
    }

    public byte[] GenerateAttendanceReportPdf(
        string companyName,
        string branchName,
        DateTime startDate,
        DateTime endDate,
        IReadOnlyList<AttendanceReportItemDto> items,
        string? filterSummary = null)
    {
        var totalRecords = items.Count;
        var uniqueEmployees = items.Select(x => x.EmployeeCode).Distinct().Count();
        
        // Sum only confirmed minutes worked
        var totalConfirmedMinutes = items.Where(x => x.IsConfirmed).Sum(x => x.MinutesWorked);
        var totalLateMinutes = items.Sum(x => x.MinutesLate);
        var pendingReviewCount = items.Count(x => !x.IsConfirmed && !x.IsFuture);

        var totalHours = Math.Round((decimal)totalConfirmedMinutes / 60m, 2);

        var finalCompanyName = string.IsNullOrWhiteSpace(companyName) || companyName.Contains("Hualong")
            ? "Bai Fen Bai (百分百)"
            : companyName;

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.Margin(16);
                page.DefaultTextStyle(x => x.FontSize(8).FontFamily(MainFontFamily));

                // Page Header
                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(titleCol =>
                        {
                            titleCol.Item().Text(finalCompanyName).FontSize(14).Bold().FontColor("#166534");
                            titleCol.Item().Text("Reporte de Asistencia / 员工考勤报表")
                                .FontSize(11).SemiBold().FontColor("#1f2328");
                            titleCol.Item().Text($"Sucursal / 门店: {branchName}  |  Periodo / 期间: {startDate:yyyy-MM-dd} ~ {endDate:yyyy-MM-dd}")
                                .FontSize(8.5f).FontColor("#57606a");
                            if (!string.IsNullOrWhiteSpace(filterSummary))
                            {
                                titleCol.Item().Text($"Filtros / 筛选: {filterSummary}").FontSize(7.5f).FontColor("#57606a");
                            }
                        });

                        row.ConstantItem(220).Column(metaCol =>
                        {
                            metaCol.Item().AlignRight().Text($"Generado / 导出时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}").FontSize(7.5f).FontColor("#57606a");
                            metaCol.Item().AlignRight().Text($"Empleados / 员工: {uniqueEmployees} | Jornadas / 班次: {totalRecords}").FontSize(7.5f).FontColor("#57606a");
                            metaCol.Item().AlignRight().Text("Sistema FA200 Biometric Agent").FontSize(7.5f).Bold().FontColor("#166534");
                        });
                    });

                    col.Item().PaddingVertical(5).LineHorizontal(0.8f).LineColor("#d0d7de");

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
                        kpiRow.RelativeItem().Border(1).BorderColor("#86efac").Background("#f0fdf4").Padding(5).Column(c =>
                        {
                            c.Item().Text("Horas Confirmadas / 确认工时").FontSize(6.5f).FontColor("#166534");
                            c.Item().Text($"{totalHours:F1} h ({AttendanceTranslationHelper.FormatMinutesFriendly(totalConfirmedMinutes)})").FontSize(10).Bold().FontColor("#166534");
                        });
                        kpiRow.ConstantItem(6);
                        kpiRow.RelativeItem().Border(1).BorderColor("#fed7aa").Background("#fff7ed").Padding(5).Column(c =>
                        {
                            c.Item().Text("Retardo Total / 迟到总计").FontSize(6.5f).FontColor("#c2410c");
                            c.Item().Text($"{totalLateMinutes} min").FontSize(11).Bold().FontColor("#c2410c");
                        });
                        kpiRow.ConstantItem(6);
                        kpiRow.RelativeItem().Border(1).BorderColor("#e9d5ff").Background("#faf5ff").Padding(5).Column(c =>
                        {
                            c.Item().Text("Pendientes / 待核查").FontSize(6.5f).FontColor("#7e22ce");
                            c.Item().Text($"{pendingReviewCount} (excluidas)").FontSize(10).Bold().FontColor("#7e22ce");
                        });
                    });
                });

                // Exactly 9 Columns in the exact specified order:
                // 1. Empleado / 员工
                // 2. Fecha de jornada / 日期
                // 3. Entrada / 上班
                // 4. Salida a comer / 午休开始
                // 5. Regreso de comer / 午休结束
                // 6. Salida / 下班
                // 7. Horas trabajadas / 实际工时
                // 8. Retardo en minutos / 迟到分钟
                // 9. Estado / 状态
                page.Content().Table(table =>
                {
                    table.ColumnsDefinition(columns =>
                    {
                        columns.RelativeColumn(2.5f); // 1. Empleado / 员工 (ID + Nombre)
                        columns.ConstantColumn(56);   // 2. Fecha de jornada / 日期
                        columns.ConstantColumn(42);   // 3. Entrada / 上班
                        columns.ConstantColumn(48);   // 4. Salida a comer / 午休开始
                        columns.ConstantColumn(48);   // 5. Regreso de comer / 午休结束
                        columns.ConstantColumn(42);   // 6. Salida / 下班
                        columns.ConstantColumn(68);   // 7. Horas trabajadas / 实际工时
                        columns.ConstantColumn(46);   // 8. Retardo (min) / 迟到分钟
                        columns.ConstantColumn(86);   // 9. Estado / 状态
                    });

                    // Table Header (Bilingual in 2 lines, Dark Green, repeated on all pages)
                    table.Header(header =>
                    {
                        var headerDefs = new (string es, string zh)[]
                        {
                            ("Empleado", "员工"),
                            ("Fecha jornada", "日期"),
                            ("Entrada", "上班"),
                            ("Sal. comer", "午休开始"),
                            ("Reg. comer", "午休结束"),
                            ("Salida", "下班"),
                            ("Horas trabajadas", "实际工时"),
                            ("Retardo (min)", "迟到分钟"),
                            ("Estado", "状态")
                        };

                        foreach (var (es, zh) in headerDefs)
                        {
                            header.Cell().Background("#166534").Border(0.5f).BorderColor("#14532d").Padding(3).AlignCenter().Column(c =>
                            {
                                c.Item().AlignCenter().Text(es).FontSize(6.8f).Bold().FontColor("#ffffff");
                                c.Item().AlignCenter().Text(zh).FontSize(5.6f).FontColor("#bbf7d0");
                            });
                        }
                    });

                    // Table Rows
                    var isEven = false;
                    foreach (var item in items)
                    {
                        var bg = isEven ? "#f9fafb" : "#ffffff";
                        isEven = !isEven;

                        // 1. Empleado / 员工 (Code + Name + notes if any)
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).Column(col =>
                        {
                            col.Item().Row(r =>
                            {
                                r.AutoItem().Text($"[{item.EmployeeCode}] ").FontSize(7).Bold().FontColor("#166534");
                                r.RelativeItem().Text(item.EmployeeName).FontSize(7.2f).SemiBold().FontColor("#1f2937");
                            });
                            if (!string.IsNullOrWhiteSpace(item.JustificationInfo))
                            {
                                col.Item().Text(item.JustificationInfo).FontSize(5.6f).Italic().FontColor("#0369a1");
                            }
                            else if (!string.IsNullOrWhiteSpace(item.ReviewNotes))
                            {
                                col.Item().Text(item.ReviewNotes).FontSize(5.6f).Italic().FontColor("#6b7280");
                            }
                        });

                        // 2. Fecha de jornada / 日期
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).AlignCenter()
                            .Text(item.Date.ToString("yyyy-MM-dd")).FontSize(6.8f).FontColor("#374151");

                        // 3. Entrada / 上班
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).AlignCenter()
                            .Text(item.FirstEntry ?? "-").FontSize(7.2f).Bold().FontColor(item.FirstEntry != null ? "#111827" : "#9ca3af");

                        // 4. Salida a comer / 午休开始
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).AlignCenter()
                            .Text(item.MealExit ?? "-").FontSize(6.8f).FontColor(item.MealExit != null ? "#4b5563" : "#9ca3af");

                        // 5. Regreso de comer / 午休结束
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).AlignCenter()
                            .Text(item.MealReturn ?? "-").FontSize(6.8f).FontColor(item.MealReturn != null ? "#4b5563" : "#9ca3af");

                        // 6. Salida / 下班
                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).AlignCenter()
                            .Text(item.LastExit ?? "-").FontSize(7.2f).Bold().FontColor(item.LastExit != null ? "#111827" : "#9ca3af");

                        // 7. Horas trabajadas / 实际工时
                        var hoursCell = table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).AlignCenter();
                        if (item.IsConfirmed)
                        {
                            hoursCell.Text(item.HoursWorkedFormatted).FontSize(7.2f).SemiBold().FontColor("#166534");
                        }
                        else
                        {
                            hoursCell.Text("Pendiente / 待核查").FontSize(6f).Italic().FontColor("#7e22ce");
                        }

                        // 8. Retardo en minutos / 迟到分钟
                        var lateCell = table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2.5f).AlignCenter();
                        if (item.MinutesLate > 0)
                            lateCell.Text($"{item.MinutesLate}").FontSize(7.2f).Bold().FontColor("#c2410c");
                        else
                            lateCell.Text("0").FontSize(7f).FontColor("#9ca3af");

                        // 9. Estado / 状态
                        var bilingualStatus = item.BilingualStatus;
                        var statusBg = bilingualStatus switch
                        {
                            var s when s.Contains("Completo") || s.Contains("完整") || s.Contains("A tiempo") || s.Contains("准时") => "#f0fdf4",
                            var s when s.Contains("Retardo") || s.Contains("迟到") => "#fff7ed",
                            var s when s.Contains("Salida justificada") || s.Contains("提前下班") => "#f0f9ff",
                            var s when s.Contains("Incompleto") || s.Contains("不全") || s.Contains("Pendiente") || s.Contains("待核查") => "#faf5ff",
                            var s when s.Contains("Falta") || s.Contains("缺勤") || s.Contains("Sin checadas") || s.Contains("无打卡") => "#fef2f2",
                            _ => "#f3f4f6"
                        };
                        var statusTextColor = bilingualStatus switch
                        {
                            var s when s.Contains("Completo") || s.Contains("完整") || s.Contains("A tiempo") || s.Contains("准时") => "#166534",
                            var s when s.Contains("Retardo") || s.Contains("迟到") => "#c2410c",
                            var s when s.Contains("Salida justificada") || s.Contains("提前下班") => "#0284c7",
                            var s when s.Contains("Incompleto") || s.Contains("不全") || s.Contains("Pendiente") || s.Contains("待核查") => "#7e22ce",
                            var s when s.Contains("Falta") || s.Contains("缺勤") || s.Contains("Sin checadas") || s.Contains("无打卡") => "#b91c1c",
                            _ => "#374151"
                        };

                        table.Cell().Background(bg).BorderBottom(0.5f).BorderColor("#e5e7eb").Padding(2).AlignCenter()
                            .Border(0.5f).BorderColor(statusTextColor).Background(statusBg).PaddingVertical(1).PaddingHorizontal(3)
                            .Text(bilingualStatus).FontSize(6.2f).Bold().FontColor(statusTextColor);
                    }
                });

                // Page Footer
                page.Footer().Column(col =>
                {
                    col.Item().PaddingTop(6).LineHorizontal(0.5f).LineColor("#e5e7eb");
                    col.Item().PaddingTop(2).Row(r =>
                    {
                        r.RelativeItem().Text("Reporte de Asistencia Semanal Bai Fen Bai (百分百) · Documento Confidencial para Pago de Nómina").FontSize(6.8f).FontColor("#6b7280");
                        r.RelativeItem().AlignRight().Text(text =>
                        {
                            text.Span("Página / 第 ").FontSize(6.8f).FontColor("#6b7280");
                            text.CurrentPageNumber().FontSize(6.8f).Bold();
                            text.Span(" de / 共 ").FontSize(6.8f).FontColor("#6b7280");
                            text.TotalPages().FontSize(6.8f).Bold();
                            text.Span(" 页").FontSize(6.8f).FontColor("#6b7280");
                        });
                    });
                });
            });
        });

        return document.GeneratePdf();
    }
}
