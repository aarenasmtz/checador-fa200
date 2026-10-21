using Attendance.Application.Common;
using Attendance.Application.Interfaces;
using Attendance.Domain.Enums;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace Attendance.Api.Controllers;

[ApiController]
[Route("api/v1/reports")]
[Authorize]
public class ReportsController : ControllerBase
{
    private readonly IAppDbContext _context;
    private readonly IPdfReportService _pdfReportService;

    public ReportsController(IAppDbContext context, IPdfReportService pdfReportService)
    {
        _context = context;
        _pdfReportService = pdfReportService;
    }

    private async Task<List<AttendanceReportItemDto>> GetReportItemsAsync(
        DateTime start,
        DateTime end,
        int? branchId,
        int? departmentId,
        int? employeeId,
        string? status,
        bool includeEmptyDays = false)
    {
        var dailyQuery = _context.AttendanceDailies
            .Include(a => a.Employee)
                .ThenInclude(e => e.Branch)
            .Include(a => a.Employee)
                .ThenInclude(e => e.Department)
            .Include(a => a.Employee)
                .ThenInclude(e => e.Position)
            .Where(a => a.Date >= start && a.Date <= end)
            .AsNoTracking();

        if (branchId.HasValue) dailyQuery = dailyQuery.Where(a => a.Employee.BranchId == branchId.Value);
        if (departmentId.HasValue) dailyQuery = dailyQuery.Where(a => a.Employee.DepartmentId == departmentId.Value);
        if (employeeId.HasValue) dailyQuery = dailyQuery.Where(a => a.EmployeeId == employeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<AttendanceStatus>(status, true, out var attStatus))
            dailyQuery = dailyQuery.Where(a => a.Status == attStatus);

        if (!includeEmptyDays)
        {
            dailyQuery = dailyQuery.Where(a =>
                a.FirstEntry != null ||
                a.LastExit != null ||
                a.MealExit != null ||
                a.MealReturn != null ||
                a.IsManualOverride ||
                a.Status == AttendanceStatus.Absent ||
                a.Status == AttendanceStatus.Permission ||
                a.Status == AttendanceStatus.Vacation ||
                a.Status == AttendanceStatus.Disability ||
                a.Status == AttendanceStatus.Holiday);
        }

        var dailies = await dailyQuery
            .OrderBy(a => a.Date)
            .ThenBy(a => a.Employee.EmployeeCode)
            .ToListAsync();

        // Query all biometric events in the window to provide audit trail and raw punch access
        var eventsQuery = _context.BiometricEvents
            .Include(b => b.Device)
            .Where(b => b.DeviceTimestamp >= start && b.DeviceTimestamp < end.AddDays(1).AddHours(6))
            .AsNoTracking();

        if (employeeId.HasValue) eventsQuery = eventsQuery.Where(b => b.EmployeeId == employeeId.Value);
        var rawEvents = await eventsQuery.ToListAsync();

        // Query approved incidents for authorized departures and justifications
        var incidentsQuery = _context.AttendanceIncidents
            .Where(i => i.AttendanceDate >= start && i.AttendanceDate <= end && i.Status == IncidentStatus.Approved)
            .AsNoTracking();

        if (employeeId.HasValue) incidentsQuery = incidentsQuery.Where(i => i.EmployeeId == employeeId.Value);
        var approvedIncidents = await incidentsQuery.ToListAsync();

        var today = DateTime.Today;
        var resultList = new List<AttendanceReportItemDto>();

        foreach (var a in dailies)
        {
            var emp = a.Employee;
            var empEvents = rawEvents
                .Where(e => e.EmployeeId == a.EmployeeId && e.DeviceTimestamp.Date == a.Date.Date)
                .OrderBy(e => e.DeviceTimestamp)
                .Select(e => new RawPunchDto(
                    e.DeviceTimestamp.ToString("HH:mm:ss"),
                    e.Method.ToString(),
                    e.NativePunchCode,
                    e.Device?.Name ?? "-"
                ))
                .ToList();

            var incident = approvedIncidents.FirstOrDefault(i => i.EmployeeId == a.EmployeeId && i.AttendanceDate.Date == a.Date.Date);
            bool isJustifiedEarlyExit = a.Status == AttendanceStatus.EarlyExit && incident != null;

            string? justificationInfo = null;
            if (incident != null)
            {
                if (isJustifiedEarlyExit && incident.Minutes > 0)
                {
                    justificationInfo = $"Salida justificada: {incident.Minutes} min por {incident.ApprovedBy ?? "Supervisor"}. Motivo: {incident.Description}";
                }
                else if (incident.Type == IncidentType.JustifiedLate && incident.Minutes > 0)
                {
                    justificationInfo = $"Retardo justificado: {incident.Minutes} min por {incident.ApprovedBy ?? "Supervisor"}. Motivo: {incident.Description}";
                }
                else
                {
                    justificationInfo = $"{incident.Description} (Autorizado por {incident.ApprovedBy ?? "Supervisor"})";
                }
            }

            bool isFuture = a.Date.Date > today;
            bool hasPunches = a.FirstEntry.HasValue || a.LastExit.HasValue || a.MealExit.HasValue || a.MealReturn.HasValue;

            // Determine if the shift is complete and confirmed
            bool isConfirmed = false;
            decimal? hoursWorked = null;
            string hoursFormatted;

            if (isFuture)
            {
                isConfirmed = false;
                hoursWorked = null;
                hoursFormatted = "-";
            }
            else if (a.RequiresReview || a.Status == AttendanceStatus.Incomplete || (!hasPunches && a.Status != AttendanceStatus.RestDay && a.Status != AttendanceStatus.Holiday && a.Status != AttendanceStatus.Vacation && a.Status != AttendanceStatus.Permission))
            {
                isConfirmed = false;
                hoursWorked = null; // Blank for unconfirmed shifts
                hoursFormatted = "Pendiente de revisión / 待核查";
            }
            else
            {
                isConfirmed = true;
                hoursWorked = Math.Round((decimal)a.MinutesWorked / 60m, 2);
                hoursFormatted = AttendanceTranslationHelper.FormatMinutesFriendly(a.MinutesWorked);
            }

            string bilingualStatus = AttendanceTranslationHelper.ToBilingualShiftStatus(
                a.Status,
                a.RequiresReview,
                hasPunches,
                isFuture,
                isJustifiedEarlyExit
            );

            resultList.Add(new AttendanceReportItemDto(
                EmployeeId: a.EmployeeId,
                EmployeeCode: emp?.EmployeeCode ?? $"EMP-{a.EmployeeId}",
                EmployeeName: emp != null ? $"{emp.FirstName} {emp.LastName}".Trim() : $"Empleado #{a.EmployeeId}",
                BranchName: emp?.Branch?.Name ?? "-",
                DepartmentName: emp?.Department?.Name ?? "-",
                Date: a.Date,
                FirstEntry: a.FirstEntry?.ToString(@"hh\:mm"),
                MealExit: a.MealExit?.ToString(@"hh\:mm"),
                MealReturn: a.MealReturn?.ToString(@"hh\:mm"),
                LastExit: a.LastExit?.ToString(@"hh\:mm"),
                MinutesLate: a.MinutesLate,
                MinutesWorked: a.MinutesWorked,
                HoursWorked: hoursWorked,
                HoursWorkedFormatted: hoursFormatted,
                OvertimeMinutes: a.OvertimeMinutes,
                OvertimeHours: Math.Round((decimal)a.OvertimeMinutes / 60m, 2),
                Status: a.Status.ToString(),
                BilingualStatus: bilingualStatus,
                RequiresReview: a.RequiresReview,
                ReviewNotes: a.ReviewNotes,
                IsConfirmed: isConfirmed,
                IsFuture: isFuture,
                JustificationInfo: justificationInfo,
                RawPunches: empEvents
            ));
        }

        return resultList;
    }

    [HttpGet("attendance")]
    public async Task<IActionResult> GetReportData(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool includeEmptyDays = false)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-6)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);

        var company = await _context.Companies.FirstOrDefaultAsync();
        var companyName = company != null && !string.IsNullOrWhiteSpace(company.Name) && !company.Name.Contains("Hualong")
            ? company.Name
            : "Bai Fen Bai (百分百)";

        var confirmedMinutes = items.Where(x => x.IsConfirmed).Sum(x => x.MinutesWorked);
        var totalLateMinutes = items.Sum(x => x.MinutesLate);
        var pendingReviewCount = items.Count(x => !x.IsConfirmed && !x.IsFuture);

        return Ok(new
        {
            companyName,
            startDate = start.ToString("yyyy-MM-dd"),
            endDate = end.ToString("yyyy-MM-dd"),
            totalRecords = items.Count,
            uniqueEmployees = items.Select(x => x.EmployeeCode).Distinct().Count(),
            totalConfirmedHours = Math.Round((decimal)confirmedMinutes / 60m, 2),
            totalConfirmedMinutes = confirmedMinutes,
            totalConfirmedFormatted = AttendanceTranslationHelper.FormatMinutesFriendly(confirmedMinutes),
            totalLateMinutes = totalLateMinutes,
            pendingReviewCount = pendingReviewCount,
            excludedFromHoursCount = pendingReviewCount,
            data = items
        });
    }

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool includeEmptyDays = false)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-6)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);
        var company = await _context.Companies.FirstOrDefaultAsync();
        var companyName = company != null && !string.IsNullOrWhiteSpace(company.Name) && !company.Name.Contains("Hualong")
            ? company.Name
            : "Bai Fen Bai (百分百)";

        var branchName = branchId.HasValue
            ? (await _context.Branches.FindAsync(branchId.Value))?.Name ?? "Todas las Sucursales"
            : "Todas las Sucursales (全部分店)";

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Reporte Asistencia (考勤报表)");

        // 1. Corporate Header Block (Rows 1-3)
        ws.Cell("A1").Value = companyName;
        ws.Cell("A1").Style.Font.Bold = true;
        ws.Cell("A1").Style.Font.FontSize = 14;
        ws.Cell("A1").Style.Font.FontColor = XLColor.White;
        ws.Range("A1:I1").Merge().Style.Fill.BackgroundColor = XLColor.FromHtml("#166534"); // Dark Green
        ws.Range("A1:I1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
        ws.Row(1).Height = 26;

        ws.Cell("A2").Value = "Reporte de Asistencia / 员工考勤报表";
        ws.Cell("A2").Style.Font.Bold = true;
        ws.Cell("A2").Style.Font.FontSize = 11;
        ws.Cell("A2").Style.Font.FontColor = XLColor.White;
        ws.Range("A2:I2").Merge().Style.Fill.BackgroundColor = XLColor.FromHtml("#14532d");
        ws.Range("A2:I2").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
        ws.Row(2).Height = 22;

        ws.Cell("A3").Value = $"Periodo / 期间: {start:yyyy-MM-dd} ~ {end:yyyy-MM-dd} | Sucursal / 门店: {branchName} | Generado: {DateTime.Now:yyyy-MM-dd HH:mm:ss}";
        ws.Cell("A3").Style.Font.Italic = true;
        ws.Cell("A3").Style.Font.FontSize = 9;
        ws.Cell("A3").Style.Font.FontColor = XLColor.FromHtml("#e2e8f0");
        ws.Range("A3:I3").Merge().Style.Fill.BackgroundColor = XLColor.FromHtml("#1f2937");
        ws.Row(3).Height = 20;

        // 2. Exactly 9 Bilingual Column Headers in Row 4 (Dark Green)
        string[] headers = [
            "Empleado\n员工",
            "Fecha jornada\n日期",
            "Entrada\n上班",
            "Sal. comer\n午休开始",
            "Reg. comer\n午休结束",
            "Salida\n下班",
            "Horas trabajadas\n实际工时",
            "Retardo (min)\n迟到分钟",
            "Estado\n状态"
        ];

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(4, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontSize = 9.5;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#166534");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Alignment.WrapText = true;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#14532d");
        }
        ws.Row(4).Height = 32;

        // 3. Data Rows
        int row = 5;
        foreach (var item in items)
        {
            var isEven = row % 2 == 0;
            var rowBg = isEven ? XLColor.FromHtml("#f9fafb") : XLColor.White;

            // 1. Empleado / 员工 (Code preserved as text + Name)
            var empCell = ws.Cell(row, 1);
            empCell.SetValue($"[{item.EmployeeCode}] {item.EmployeeName}");
            empCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;
            empCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            empCell.Style.Fill.BackgroundColor = rowBg;

            // 2. Fecha / 日期
            var dateCell = ws.Cell(row, 2);
            dateCell.Value = item.Date.ToString("yyyy-MM-dd");
            dateCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            dateCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            dateCell.Style.Fill.BackgroundColor = rowBg;

            // 3. Entrada / 上班
            var inCell = ws.Cell(row, 3);
            inCell.Value = item.FirstEntry ?? "-";
            inCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            inCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            inCell.Style.Fill.BackgroundColor = rowBg;
            if (item.FirstEntry != null) inCell.Style.Font.Bold = true;

            // 4. Salida a comer / 午休开始
            var mOutCell = ws.Cell(row, 4);
            mOutCell.Value = item.MealExit ?? "-";
            mOutCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            mOutCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            mOutCell.Style.Fill.BackgroundColor = rowBg;

            // 5. Regreso de comer / 午休结束
            var mInCell = ws.Cell(row, 5);
            mInCell.Value = item.MealReturn ?? "-";
            mInCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            mInCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            mInCell.Style.Fill.BackgroundColor = rowBg;

            // 6. Salida / 下班
            var outCell = ws.Cell(row, 6);
            outCell.Value = item.LastExit ?? "-";
            outCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            outCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            outCell.Style.Fill.BackgroundColor = rowBg;
            if (item.LastExit != null) outCell.Style.Font.Bold = true;

            // 7. Horas trabajadas / 实际工时 (Leave blank if pending or incomplete!)
            var hoursCell = ws.Cell(row, 7);
            if (item.IsConfirmed && item.HoursWorked.HasValue)
            {
                hoursCell.Value = item.HoursWorked.Value;
                hoursCell.Style.NumberFormat.Format = "0.00";
                hoursCell.Style.Font.Bold = true;
                hoursCell.Style.Font.FontColor = XLColor.FromHtml("#166534");
            }
            else
            {
                // Blank numeric cell for incomplete/pending as required
                hoursCell.Value = string.Empty;
            }
            hoursCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            hoursCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            hoursCell.Style.Fill.BackgroundColor = rowBg;

            // 8. Retardo en minutos / 迟到分钟
            var lateCell = ws.Cell(row, 8);
            lateCell.Value = item.MinutesLate;
            lateCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            lateCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            lateCell.Style.Fill.BackgroundColor = rowBg;
            if (item.MinutesLate > 0)
            {
                lateCell.Style.Font.Bold = true;
                lateCell.Style.Font.FontColor = XLColor.FromHtml("#c2410c");
            }

            // 9. Estado / 状态
            var statusCell = ws.Cell(row, 9);
            statusCell.Value = item.BilingualStatus;
            statusCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            statusCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            statusCell.Style.Font.Bold = true;

            var st = item.BilingualStatus;
            if (st.Contains("Completo") || st.Contains("完整") || st.Contains("A tiempo") || st.Contains("准时"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#f0fdf4");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#166534");
            }
            else if (st.Contains("Retardo") || st.Contains("迟到"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#fff7ed");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#c2410c");
            }
            else if (st.Contains("Salida justificada") || st.Contains("提前下班"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#f0f9ff");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#0284c7");
            }
            else if (st.Contains("Incompleto") || st.Contains("不全") || st.Contains("Pendiente") || st.Contains("待核查"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#faf5ff");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#7e22ce");
            }
            else if (st.Contains("Falta") || st.Contains("缺勤") || st.Contains("Sin checadas") || st.Contains("无打卡"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#fef2f2");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#b91c1c");
            }
            else
            {
                statusCell.Style.Fill.BackgroundColor = rowBg;
            }

            if (!string.IsNullOrWhiteSpace(item.JustificationInfo))
            {
                statusCell.GetComment().AddText(item.JustificationInfo);
            }
            else if (!string.IsNullOrWhiteSpace(item.ReviewNotes))
            {
                statusCell.GetComment().AddText(item.ReviewNotes);
            }

            ws.Row(row).Height = 22;
            row++;
        }

        // 4. Totals Row at the bottom
        if (items.Count > 0)
        {
            ws.Cell(row, 1).Value = "TOTALES CONFIRMADOS / 确认总计";
            ws.Cell(row, 1).Style.Font.Bold = true;
            ws.Range(row, 1, row, 6).Merge();
            ws.Range(row, 1, row, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            ws.Range(row, 1, row, 6).Style.Fill.BackgroundColor = XLColor.FromHtml("#f3f4f6");

            // Sum of confirmed hours
            var totalHoursCell = ws.Cell(row, 7);
            totalHoursCell.FormulaA1 = $"SUM(G5:G{row - 1})";
            totalHoursCell.Style.Font.Bold = true;
            totalHoursCell.Style.NumberFormat.Format = "0.00";
            totalHoursCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#f0fdf4");
            totalHoursCell.Style.Font.FontColor = XLColor.FromHtml("#166534");

            // Sum of late minutes
            var totalLateCell = ws.Cell(row, 8);
            totalLateCell.FormulaA1 = $"SUM(H5:H{row - 1})";
            totalLateCell.Style.Font.Bold = true;
            totalLateCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#fff7ed");
            totalLateCell.Style.Font.FontColor = XLColor.FromHtml("#c2410c");

            var pendingCount = items.Count(x => !x.IsConfirmed && !x.IsFuture);
            var confirmedCount = items.Count(x => x.IsConfirmed);
            ws.Cell(row, 9).Value = $"{confirmedCount} confirmadas | {pendingCount} pendientes";
            ws.Cell(row, 9).Style.Font.Bold = true;
            ws.Cell(row, 9).Style.Font.FontSize = 8.5;
            ws.Cell(row, 9).Style.Fill.BackgroundColor = XLColor.FromHtml("#f3f4f6");
            ws.Cell(row, 9).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            ws.Row(row).Height = 24;
        }

        // 5. Freeze header panes
        ws.SheetView.FreezeRows(4);

        // 6. Auto-fit columns with limits
        ws.Columns().AdjustToContents(12, 45);

        // 7. Enable Autofilter
        ws.Range(4, 1, Math.Max(4, row - 1), headers.Length).SetAutoFilter();

        // 8. Page Setup (Landscape, fit to 1 page wide)
        ws.PageSetup.PageOrientation = XLPageOrientation.Landscape;
        ws.PageSetup.FitToPages(1, 0);
        ws.PageSetup.SetRowsToRepeatAtTop(4, 4);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var content = stream.ToArray();

        var filename = $"Reporte_Asistencia_{start:yyyyMMdd}_{end:yyyyMMdd}.xlsx";
        return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename);
    }

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportCsv(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool includeEmptyDays = false)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-6)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);

        var sb = new StringBuilder();
        // 9 Columns in exact order
        sb.AppendLine("Empleado / 员工,Fecha jornada / 日期,Entrada / 上班,Salida a comer / 午休开始,Regreso de comer / 午休结束,Salida / 下班,Horas trabajadas / 实际工时,Retardo (min) / 迟到分钟,Estado / 状态");

        static string EscapeCsv(string? val)
        {
            if (string.IsNullOrEmpty(val)) return "\"\"";
            if (val.StartsWith('=') || val.StartsWith('+') || val.StartsWith('-') || val.StartsWith('@'))
            {
                val = "'" + val;
            }
            return $"\"{val.Replace("\"", "\"\"")}\"";
        }

        foreach (var item in items)
        {
            string hoursStr = item.IsConfirmed && item.HoursWorked.HasValue
                ? item.HoursWorked.Value.ToString("F2", System.Globalization.CultureInfo.InvariantCulture)
                : "";

            sb.AppendLine(string.Join(",",
                EscapeCsv($"[{item.EmployeeCode}] {item.EmployeeName}"),
                EscapeCsv(item.Date.ToString("yyyy-MM-dd")),
                EscapeCsv(item.FirstEntry ?? "-"),
                EscapeCsv(item.MealExit ?? "-"),
                EscapeCsv(item.MealReturn ?? "-"),
                EscapeCsv(item.LastExit ?? "-"),
                EscapeCsv(hoursStr),
                item.MinutesLate.ToString(),
                EscapeCsv(item.BilingualStatus)
            ));
        }

        var preamble = Encoding.UTF8.GetPreamble();
        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fullBytes = new byte[preamble.Length + bytes.Length];
        Buffer.BlockCopy(preamble, 0, fullBytes, 0, preamble.Length);
        Buffer.BlockCopy(bytes, 0, fullBytes, preamble.Length, bytes.Length);

        return File(fullBytes, "text/csv; charset=utf-8", $"Reporte_Asistencia_{start:yyyyMMdd}_{end:yyyyMMdd}.csv");
    }

    [HttpGet("export/pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool includeEmptyDays = false)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-6)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);
        var company = await _context.Companies.FirstOrDefaultAsync();
        var companyName = company != null && !string.IsNullOrWhiteSpace(company.Name) && !company.Name.Contains("Hualong")
            ? company.Name
            : "Bai Fen Bai (百分百)";

        var branchName = branchId.HasValue
            ? (await _context.Branches.FindAsync(branchId.Value))?.Name ?? "Todas las Sucursales"
            : "Todas las Sucursales (全部分店)";

        var filterSummary = branchId.HasValue ? $"Sucursal: {branchName}" : null;

        var pdfBytes = _pdfReportService.GenerateAttendanceReportPdf(
            companyName,
            branchName,
            start,
            end,
            items,
            filterSummary
        );

        var filename = $"Reporte_Asistencia_{start:yyyyMMdd}_{end:yyyyMMdd}.pdf";
        return File(pdfBytes, "application/pdf", filename);
    }
}
