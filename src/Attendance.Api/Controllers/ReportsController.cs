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

    [HttpGet("attendance")]
    public async Task<IActionResult> GetReportData(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

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

        var list = await query
            .OrderBy(a => a.Date)
                .ThenBy(a => a.Employee.EmployeeCode)
            .Select(a => new
            {
                a.Id,
                a.EmployeeId,
                EmployeeCode = a.Employee.EmployeeCode,
                EmployeeName = $"{a.Employee.FirstName} {a.Employee.LastName}",
                BranchName = a.Employee.Branch.Name,
                DepartmentName = a.Employee.Department != null ? a.Employee.Department.Name : "-",
                PositionName = a.Employee.Position != null ? a.Employee.Position.Name : "-",
                Date = a.Date.ToString("yyyy-MM-dd"),
                FirstEntry = a.FirstEntry.HasValue ? a.FirstEntry.Value.ToString(@"hh\:mm") : "-",
                LastExit = a.LastExit.HasValue ? a.LastExit.Value.ToString(@"hh\:mm") : "-",
                a.MinutesLate,
                MinutesWorked = a.MinutesWorked,
                HoursWorked = Math.Round((decimal)a.MinutesWorked / 60, 2),
                OvertimeMinutes = a.OvertimeMinutes,
                OvertimeHours = Math.Round((decimal)a.OvertimeMinutes / 60, 2),
                Status = a.Status.ToString()
            })
            .ToListAsync();

        return Ok(new
        {
            startDate = start.ToString("yyyy-MM-dd"),
            endDate = end.ToString("yyyy-MM-dd"),
            totalRecords = list.Count,
            totalLateMinutes = list.Sum(x => x.MinutesLate),
            totalHoursWorked = list.Sum(x => x.HoursWorked),
            totalOvertimeHours = list.Sum(x => x.OvertimeHours),
            data = list
        });
    }

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

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

        var list = await query
            .OrderBy(a => a.Date)
                .ThenBy(a => a.Employee.EmployeeCode)
            .ToListAsync();

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("考勤报表 (Asistencia)");

        // Corporate Title Block
        ws.Cell("A1").Value = "华龙商业集团 (Grupo Comercial Hualong)";
        ws.Cell("A1").Style.Font.Bold = true;
        ws.Cell("A1").Style.Font.FontSize = 16;
        ws.Cell("A1").Style.Font.FontColor = XLColor.White;
        ws.Range("A1:K1").Merge().Style.Fill.BackgroundColor = XLColor.FromHtml("#161b22");

        ws.Cell("A2").Value = $"期间 (Periodo): {start:yyyy-MM-dd} ~ {end:yyyy-MM-dd} | 导出时间 (Generado): {DateTime.Now:yyyy-MM-dd HH:mm:ss}";
        ws.Cell("A2").Style.Font.Italic = true;
        ws.Range("A2:K2").Merge().Style.Fill.BackgroundColor = XLColor.FromHtml("#21262d");
        ws.Range("A2:K2").Style.Font.FontColor = XLColor.FromHtml("#8b949e");

        // Headers
        string[] headers = [
            "工号 (Código)", "姓名 (Nombre)", "分店 (Sucursal)", "部门 (Depto)", "日期 (Fecha)",
            "上班 (Entrada)", "下班 (Salida)", "迟到分钟 (Retardo min)", "出勤工时 (Horas Trab)",
            "加班工时 (Horas Extra)", "考勤状态 (Estado)"
        ];

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(4, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#0969da");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        // Data rows
        int row = 5;
        foreach (var item in list)
        {
            ws.Cell(row, 1).Value = item.Employee.EmployeeCode;
            ws.Cell(row, 2).Value = $"{item.Employee.FirstName} {item.Employee.LastName}";
            ws.Cell(row, 3).Value = item.Employee.Branch.Name;
            ws.Cell(row, 4).Value = item.Employee.Department?.Name ?? "-";
            ws.Cell(row, 5).Value = item.Date.ToString("yyyy-MM-dd");
            ws.Cell(row, 6).Value = item.FirstEntry.HasValue ? item.FirstEntry.Value.ToString(@"hh\:mm") : "-";
            ws.Cell(row, 7).Value = item.LastExit.HasValue ? item.LastExit.Value.ToString(@"hh\:mm") : "-";
            ws.Cell(row, 8).Value = item.MinutesLate;
            ws.Cell(row, 9).Value = Math.Round((decimal)item.MinutesWorked / 60, 2);
            ws.Cell(row, 10).Value = Math.Round((decimal)item.OvertimeMinutes / 60, 2);
            ws.Cell(row, 11).Value = item.Status.ToString();

            // Status color highlight
            if (item.Status == AttendanceStatus.Late)
                ws.Cell(row, 11).Style.Fill.BackgroundColor = XLColor.FromHtml("#fff8c5");
            else if (item.Status == AttendanceStatus.Absent)
                ws.Cell(row, 11).Style.Fill.BackgroundColor = XLColor.FromHtml("#ffebe9");
            else if (item.Status == AttendanceStatus.OnTime)
                ws.Cell(row, 11).Style.Fill.BackgroundColor = XLColor.FromHtml("#dafbe1");

            row++;
        }

        // Freeze header panes
        ws.SheetView.FreezeRows(4);

        // Auto-fit columns
        ws.Columns().AdjustToContents();

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
        [FromQuery] DateTime? endDate = null)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var list = await _context.AttendanceDailies
            .Include(a => a.Employee).ThenInclude(e => e.Branch)
            .Where(a => a.Date >= start && a.Date <= end)
            .OrderBy(a => a.Date)
            .ToListAsync();

        var sb = new StringBuilder();
        sb.AppendLine("Codigo,Nombre,Sucursal,Fecha,Entrada,Salida,RetardoMin,HorasTrabajadas,HorasExtra,Estado");

        foreach (var item in list)
        {
            sb.AppendLine($"\"{item.Employee.EmployeeCode}\",\"{item.Employee.FirstName} {item.Employee.LastName}\",\"{item.Employee.Branch.Name}\",\"{item.Date:yyyy-MM-dd}\",\"{item.FirstEntry}\",\"{item.LastExit}\",{item.MinutesLate},{Math.Round((decimal)item.MinutesWorked / 60, 2)},{Math.Round((decimal)item.OvertimeMinutes / 60, 2)},\"{item.Status}\"");
        }

        return File(Encoding.UTF8.GetBytes(sb.ToString()), "text/csv", $"Reporte_Asistencia_{start:yyyyMMdd}.csv");
    }

    [HttpGet("export/pdf")]
    public async Task<IActionResult> ExportPdf(
        [FromQuery] DateTime? startDate = null,
        [FromQuery] DateTime? endDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] int? departmentId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? status = null)
    {
        var start = (startDate ?? DateTime.UtcNow.AddDays(-14)).Date;
        var end = (endDate ?? DateTime.UtcNow).Date;

        var query = _context.AttendanceDailies
            .Include(a => a.Employee).ThenInclude(e => e.Branch)
            .Include(a => a.Employee).ThenInclude(e => e.Department)
            .Where(a => a.Date >= start && a.Date <= end)
            .AsNoTracking();

        if (branchId.HasValue) query = query.Where(a => a.Employee.BranchId == branchId.Value);
        if (departmentId.HasValue) query = query.Where(a => a.Employee.DepartmentId == departmentId.Value);
        if (employeeId.HasValue) query = query.Where(a => a.EmployeeId == employeeId.Value);

        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<AttendanceStatus>(status, true, out var attStatus))
            query = query.Where(a => a.Status == attStatus);

        var list = await query
            .OrderBy(a => a.Date)
            .ThenBy(a => a.Employee.EmployeeCode)
            .Select(a => new AttendanceReportItemDto(
                a.Employee.EmployeeCode,
                $"{a.Employee.FirstName} {a.Employee.LastName}",
                a.Employee.Branch.Name,
                a.Employee.Department != null ? a.Employee.Department.Name : "-",
                a.Date,
                a.FirstEntry.HasValue ? a.FirstEntry.Value.ToString(@"hh\:mm") : null,
                a.LastExit.HasValue ? a.LastExit.Value.ToString(@"hh\:mm") : null,
                a.MinutesLate,
                Math.Round((decimal)a.MinutesWorked / 60, 2),
                Math.Round((decimal)a.OvertimeMinutes / 60, 2),
                a.Status.ToString()
            ))
            .ToListAsync();

        var branchName = branchId.HasValue 
            ? (await _context.Branches.FindAsync(branchId.Value))?.Name ?? "Todas las Sucursales" 
            : "Todas las Sucursales (全部分店)";

        var pdfBytes = _pdfReportService.GenerateAttendanceReportPdf(
            "华龙商业集团 (Grupo Comercial Hualong)",
            branchName,
            start,
            end,
            list
        );

        var filename = $"Reporte_Asistencia_{start:yyyyMMdd}_{end:yyyyMMdd}.pdf";
        return File(pdfBytes, "application/pdf", filename);
    }
}
