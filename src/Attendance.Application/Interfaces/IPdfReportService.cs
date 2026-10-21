namespace Attendance.Application.Interfaces;

public record RawPunchDto(
    string Time,
    string Method,
    int NativePunchCode,
    string? DeviceName
);

public record AttendanceReportItemDto(
    int EmployeeId,
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
    decimal? HoursWorked,
    string HoursWorkedFormatted,
    int OvertimeMinutes,
    decimal OvertimeHours,
    string Status,
    string BilingualStatus,
    bool RequiresReview = false,
    string? ReviewNotes = null,
    bool IsConfirmed = true,
    bool IsFuture = false,
    string? JustificationInfo = null,
    IReadOnlyList<RawPunchDto>? RawPunches = null
);

public interface IPdfReportService
{
    byte[] GenerateAttendanceReportPdf(
        string companyName,
        string branchName,
        DateTime startDate,
        DateTime endDate,
        IReadOnlyList<AttendanceReportItemDto> items,
        string? filterSummary = null);
}
