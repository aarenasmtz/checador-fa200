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
    string? MealExit,
    string? MealReturn,
    string? LastExit,
    int MinutesLate,
    int MinutesWorked,
    decimal HoursWorked,
    int OvertimeMinutes,
    decimal OvertimeHours,
    string Status,
    bool RequiresReview = false,
    string? ReviewNotes = null
);
