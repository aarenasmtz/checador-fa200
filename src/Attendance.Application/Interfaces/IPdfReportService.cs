namespace Attendance.Application.Interfaces;

public interface IPdfReportService
{
    byte[] GenerateAttendanceReportPdf(
        string companyName,
        string branchName,
        DateTime startDate,
        DateTime endDate,
        IReadOnlyList<AttendanceReportItemDto> items);
}

public record AttendanceReportItemDto(
    string EmployeeCode,
    string EmployeeName,
    string BranchName,
    string DepartmentName,
    DateTime Date,
    string? FirstEntry,
    string? LastExit,
    int MinutesLate,
    decimal HoursWorked,
    decimal OvertimeHours,
    string Status
);
