namespace Attendance.Application.DTOs;

public record EmployeeDto(
    int Id,
    int CompanyId,
    int BranchId,
    string BranchName,
    int? DepartmentId,
    string? DepartmentName,
    int? PositionId,
    string? PositionName,
    string EmployeeCode,
    string FirstName,
    string LastName,
    string? Email,
    string? Phone,
    DateTime HireDate,
    DateTime? TerminationDate,
    string Status,
    string BiometricExternalId,
    string? CurrentScheduleName
);

public record CreateEmployeeRequest(
    int BranchId,
    int? DepartmentId,
    int? PositionId,
    string EmployeeCode,
    string FirstName,
    string LastName,
    string? Email,
    string? Phone,
    DateTime HireDate,
    string? BiometricExternalId,
    int? ScheduleId
);

public record UpdateEmployeeRequest(
    int BranchId,
    int? DepartmentId,
    int? PositionId,
    string FirstName,
    string LastName,
    string? Email,
    string? Phone,
    DateTime? TerminationDate,
    string Status,
    string? BiometricExternalId,
    int? ScheduleId
);

public record EmployeeDetailDto(
    int Id,
    string EmployeeCode,
    string FullName,
    string FirstName,
    string LastName,
    string BranchName,
    string? DepartmentName,
    string? PositionName,
    string? CurrentScheduleName,
    string? Email,
    string? Phone,
    DateTime HireDate,
    string Status,
    string BiometricExternalId,
    int TotalPunchesThisMonth,
    int DaysPresentThisMonth,
    int DaysLateThisMonth,
    int DaysAbsentThisMonth,
    int TotalMinutesWorkedThisMonth,
    int TotalOvertimeMinutesThisMonth
);
