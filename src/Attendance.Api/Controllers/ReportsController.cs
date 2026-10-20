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
        var query = _context.AttendanceDailies
            .Include(a => a.Employee)
                .ThenInclude(e => e.Branch)
            .Include(a => a.Employee)
                .ThenInclude(e => e.Department)
            .Include(a => a.Employee)
                .ThenInclude(e => e.Position)
            .Where(a => a.Date >= start && a.Date <= end)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(a => a.Employee.BranchId == branchId.Value);
        if (departmentId.HasValue) query = query.Where(a => a.Employee.DepartmentId == departmentId.Value);
        if (employeeId.HasValue) query = query.Where(a => a.EmployeeId == employeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<AttendanceStatus>(status, true, out var attStatus))
            query = query.Where(a => a.Status == attStatus);

        if (!includeEmptyDays)
        {
            // Exclude artificial/empty records: require punches, manual override, or legitimate non-working status
            query = query.Where(a =>
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

        var rawList = await query
            .OrderBy(a => a.Date)
            .ThenBy(a => a.Employee.EmployeeCode)
            .Select(a => new
            {
                a.Employee.EmployeeCode,
                EmployeeName = $"{a.Employee.FirstName} {a.Employee.LastName}",
                BranchName = a.Employee.Branch != null ? a.Employee.Branch.Name : "-",
                DepartmentName = a.Employee.Department != null ? a.Employee.Department.Name : "-",
                a.Date,
                FirstEntry = a.FirstEntry.HasValue ? a.FirstEntry.Value.ToString(@"hh\:mm") : null,
                MealExit = a.MealExit.HasValue ? a.MealExit.Value.ToString(@"hh\:mm") : null,
                MealReturn = a.MealReturn.HasValue ? a.MealReturn.Value.ToString(@"hh\:mm") : null,
                LastExit = a.LastExit.HasValue ? a.LastExit.Value.ToString(@"hh\:mm") : null,
                a.MinutesLate,
                MinutesWorked = a.MinutesWorked,
                OvertimeMinutes = a.OvertimeMinutes,
                Status = a.Status.ToString(),
                a.RequiresReview,
                a.ReviewNotes
            })
            .ToListAsync();

        return rawList.Select(a => new AttendanceReportItemDto(
            a.EmployeeCode,
            a.EmployeeName,
            a.BranchName,
            a.DepartmentName,
            a.Date,
            a.FirstEntry,
            a.MealExit,
            a.MealReturn,
            a.LastExit,
            a.MinutesLate,
            a.MinutesWorked,
            Math.Round((decimal)a.MinutesWorked / 60m, 2),
            a.OvertimeMinutes,
            Math.Round((decimal)a.OvertimeMinutes / 60m, 2),
            a.Status,
            a.RequiresReview,
            a.ReviewNotes
        )).ToList();
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
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);

        var totalMinutesWorked = items.Sum(x => x.MinutesWorked);
        var totalOvertimeMinutes = items.Sum(x => x.OvertimeMinutes);

        return Ok(new
        {
            startDate = start.ToString("yyyy-MM-dd"),
            endDate = end.ToString("yyyy-MM-dd"),
            totalRecords = items.Count,
            uniqueEmployees = items.Select(x => x.EmployeeCode).Distinct().Count(),
            totalLateMinutes = items.Sum(x => x.MinutesLate),
            totalHoursWorked = Math.Round((decimal)totalMinutesWorked / 60m, 2),
            totalWorkedMinutes = totalMinutesWorked,
            totalOvertimeHours = Math.Round((decimal)totalOvertimeMinutes / 60m, 2),
            totalOvertimeMinutes = totalOvertimeMinutes,
            data = items.Select(i => new
            {
                i.EmployeeCode,
                i.EmployeeName,
                i.BranchName,
                i.DepartmentName,
                Date = i.Date.ToString("yyyy-MM-dd"),
                FirstEntry = i.FirstEntry ?? "-",
                MealExit = i.MealExit ?? "-",
                MealReturn = i.MealReturn ?? "-",
                LastExit = i.LastExit ?? "-",
                i.MinutesLate,
                i.MinutesWorked,
                HoursWorked = i.HoursWorked,
                HoursWorkedFormatted = AttendanceTranslationHelper.FormatMinutesAsHhMm(i.MinutesWorked),
                i.OvertimeMinutes,
                OvertimeHours = i.OvertimeHours,
                OvertimeFormatted = AttendanceTranslationHelper.FormatMinutesAsHhMm(i.OvertimeMinutes),
                i.Status,
                BilingualStatus = AttendanceTranslationHelper.ToBilingualStatus(i.Status),
                i.RequiresReview,
                i.ReviewNotes
            })
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
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);
        var companyName = await _context.Companies.Select(c => c.Name).FirstOrDefaultAsync() 
            ?? "华龙商业集团 (Grupo Comercial Hualong)";

        var branchName = branchId.HasValue
            ? (await _context.Branches.FindAsync(branchId.Value))?.Name ?? "Todas las Sucursales"
            : "Todas las Sucursales (全部分店)";

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("考勤报表 (Asistencia)");

        // Corporate Title Block
        ws.Cell("A1").Value = companyName;
        ws.Cell("A1").Style.Font.Bold = true;
        ws.Cell("A1").Style.Font.FontSize = 15;
        ws.Cell("A1").Style.Font.FontColor = XLColor.White;
        ws.Range("A1:M1").Merge().Style.Fill.BackgroundColor = XLColor.FromHtml("#161b22");
        ws.Range("A1:M1").Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Left;

        ws.Cell("A2").Value = $"Periodo / 期间: {start:yyyy-MM-dd} ~ {end:yyyy-MM-dd} | Sucursal / 门店: {branchName} | Generado / 导出时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}";
        ws.Cell("A2").Style.Font.Italic = true;
        ws.Cell("A2").Style.Font.FontSize = 9;
        ws.Range("A2:M2").Merge().Style.Fill.BackgroundColor = XLColor.FromHtml("#21262d");
        ws.Range("A2:M2").Style.Font.FontColor = XLColor.FromHtml("#8b949e");

        // Bilingual Headers (13 columns)
        string[] headers = [
            "Código / 员工编号",
            "Empleado / 员工姓名",
            "Sucursal / 门店",
            "Departamento / 部门",
            "Fecha / 日期",
            "Entrada / 上班打卡",
            "Sal. Comida / 午休开始",
            "Reg. Comida / 午休结束",
            "Salida / 下班打卡",
            "Retardo (min) / 迟到（分）",
            "Horas Trab / 工作时长",
            "Horas Extra / 加班时长",
            "Estado / 考勤状态"
        ];

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(4, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Font.FontSize = 9.5;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0969da");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Alignment.WrapText = true;
        }
        ws.Row(4).Height = 28;

        // Data rows
        int row = 5;
        foreach (var item in items)
        {
            // Prevent formula interpretation and preserve strings like HL-003
            var codeCell = ws.Cell(row, 1);
            codeCell.SetValue(item.EmployeeCode);
            codeCell.Style.NumberFormat.Format = "@";
            codeCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            ws.Cell(row, 2).Value = item.EmployeeName;
            ws.Cell(row, 3).Value = item.BranchName;
            ws.Cell(row, 4).Value = item.DepartmentName;

            var dateCell = ws.Cell(row, 5);
            dateCell.Value = item.Date.ToString("yyyy-MM-dd");
            dateCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            ws.Cell(row, 6).Value = item.FirstEntry ?? "-";
            ws.Cell(row, 6).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            ws.Cell(row, 7).Value = item.MealExit ?? "-";
            ws.Cell(row, 7).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            ws.Cell(row, 8).Value = item.MealReturn ?? "-";
            ws.Cell(row, 8).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            ws.Cell(row, 9).Value = item.LastExit ?? "-";
            ws.Cell(row, 9).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;

            var lateCell = ws.Cell(row, 10);
            lateCell.Value = item.MinutesLate;
            lateCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

            var workedCell = ws.Cell(row, 11);
            workedCell.Value = item.HoursWorked;
            workedCell.Style.NumberFormat.Format = "0.00";
            workedCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

            var otCell = ws.Cell(row, 12);
            otCell.Value = item.OvertimeHours;
            otCell.Style.NumberFormat.Format = "0.00";
            otCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;

            var bilingualStatus = AttendanceTranslationHelper.ToBilingualStatus(item.Status);
            var statusCell = ws.Cell(row, 13);
            statusCell.Value = bilingualStatus;
            statusCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            statusCell.Style.Font.Bold = true;

            // Status color highlight
            if (bilingualStatus.Contains("Retardo") || bilingualStatus.Contains("迟到"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#fff8c5");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#9a6700");
            }
            else if (bilingualStatus.Contains("Falta") || bilingualStatus.Contains("缺勤"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#ffebe9");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#cf222e");
            }
            else if (bilingualStatus.Contains("A tiempo") || bilingualStatus.Contains("准时"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#dafbe1");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#1a7f37");
            }
            else if (bilingualStatus.Contains("Incompleto") || bilingualStatus.Contains("不全"))
            {
                statusCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#fbefff");
                statusCell.Style.Font.FontColor = XLColor.FromHtml("#8250df");
            }

            row++;
        }

        // Totals row
        if (items.Count > 0)
        {
            ws.Cell(row, 1).Value = "TOTALES / 总计";
            ws.Cell(row, 1).Style.Font.Bold = true;
            ws.Range(row, 1, row, 9).Merge();
            ws.Range(row, 1, row, 9).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            ws.Range(row, 1, row, 9).Style.Fill.BackgroundColor = XLColor.FromHtml("#f6f8fa");

            var totalLateCell = ws.Cell(row, 10);
            totalLateCell.FormulaA1 = $"SUM(J5:J{row - 1})";
            totalLateCell.Style.Font.Bold = true;
            totalLateCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#fff8c5");

            var totalWorkedCell = ws.Cell(row, 11);
            totalWorkedCell.FormulaA1 = $"SUM(K5:K{row - 1})";
            totalWorkedCell.Style.Font.Bold = true;
            totalWorkedCell.Style.NumberFormat.Format = "0.00";
            totalWorkedCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#ddf4ff");

            var totalOtCell = ws.Cell(row, 12);
            totalOtCell.FormulaA1 = $"SUM(L5:L{row - 1})";
            totalOtCell.Style.Font.Bold = true;
            totalOtCell.Style.NumberFormat.Format = "0.00";
            totalOtCell.Style.Fill.BackgroundColor = XLColor.FromHtml("#dafbe1");

            ws.Cell(row, 13).Value = $"{items.Count} registros";
            ws.Cell(row, 13).Style.Font.Bold = true;
            ws.Cell(row, 13).Style.Fill.BackgroundColor = XLColor.FromHtml("#f6f8fa");
        }

        // Freeze header panes
        ws.SheetView.FreezeRows(4);

        // Auto-fit columns
        ws.Columns().AdjustToContents(10, 45);

        // Enable Autofilters on header row
        ws.Range(4, 1, Math.Max(4, row - 1), headers.Length).SetAutoFilter();

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
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);

        var sb = new StringBuilder();
        // CSV Header with bilingual column names
        sb.AppendLine("Código / 员工编号,Empleado / 员工姓名,Sucursal / 门店,Departamento / 部门,Fecha / 日期,Entrada / 上班打卡,Salida a comida / 午休开始,Regreso de comida / 午休结束,Salida / 下班打卡,Retardo (min) / 迟到（分）,Horas trabajadas / 工作时长,Horas extra / 加班时长,Estado / 考勤状态");

        static string EscapeCsv(string? val)
        {
            if (string.IsNullOrEmpty(val)) return "\"\"";
            // Protect against Excel CSV formula injection
            if (val.StartsWith('=') || val.StartsWith('+') || val.StartsWith('-') || val.StartsWith('@'))
            {
                val = "'" + val;
            }
            return $"\"{val.Replace("\"", "\"\"")}\"";
        }

        foreach (var item in items)
        {
            var bilingualStatus = AttendanceTranslationHelper.ToBilingualStatus(item.Status);
            sb.AppendLine(string.Join(",",
                EscapeCsv(item.EmployeeCode),
                EscapeCsv(item.EmployeeName),
                EscapeCsv(item.BranchName),
                EscapeCsv(item.DepartmentName),
                EscapeCsv(item.Date.ToString("yyyy-MM-dd")),
                EscapeCsv(item.FirstEntry ?? "-"),
                EscapeCsv(item.MealExit ?? "-"),
                EscapeCsv(item.MealReturn ?? "-"),
                EscapeCsv(item.LastExit ?? "-"),
                item.MinutesLate.ToString(),
                item.HoursWorked.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                item.OvertimeHours.ToString("F2", System.Globalization.CultureInfo.InvariantCulture),
                EscapeCsv(bilingualStatus)
            ));
        }

        // Write UTF-8 with BOM for Excel compatibility (Chinese + Accents)
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
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var items = await GetReportItemsAsync(start, end, branchId, departmentId, employeeId, status, includeEmptyDays);

        var companyName = await _context.Companies.Select(c => c.Name).FirstOrDefaultAsync() 
            ?? "华龙商业集团 (Grupo Comercial Hualong)";

        var branchName = branchId.HasValue
            ? (await _context.Branches.FindAsync(branchId.Value))?.Name ?? "Todas las Sucursales"
            : "Todas las Sucursales (全部分店)";

        var pdfBytes = _pdfReportService.GenerateAttendanceReportPdf(
            companyName,
            branchName,
            start,
            end,
            items
        );

        var filename = $"Reporte_Asistencia_{start:yyyyMMdd}_{end:yyyyMMdd}.pdf";
        return File(pdfBytes, "application/pdf", filename);
    }
}
