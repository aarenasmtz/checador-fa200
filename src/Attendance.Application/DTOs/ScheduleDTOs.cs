namespace Attendance.Application.DTOs;

public record WorkDayDto(
    int Id,
    int DayOfWeek,
    string DayName,
    bool IsWorkingDay
);

public record ScheduleDto(
    int Id,
    int CompanyId,
    string Name,
    string StartTime,
    string EndTime,
    int ToleranceMinutes,
    string? MealStartTime,
    string? MealEndTime,
    decimal ExpectedHours,
    string Status,
    List<WorkDayDto> WorkDays,
    int AssignedEmployeesCount
);

public record CreateScheduleRequest(
    string Name,
    string StartTime,
    string EndTime,
    int ToleranceMinutes,
    string? MealStartTime,
    string? MealEndTime,
    decimal ExpectedHours,
    List<int> WorkingDays // e.g. [1, 2, 3, 4, 5, 6]
);

public record UpdateScheduleRequest(
    string Name,
    string StartTime,
    string EndTime,
    int ToleranceMinutes,
    string? MealStartTime,
    string? MealEndTime,
    decimal ExpectedHours,
    List<int> WorkingDays,
    string? Status = "Active"
);

public record HolidayDto(
    int Id,
    int CompanyId,
    DateTime Date,
    string Name
);

public record CreateHolidayRequest(
    DateTime Date,
    string Name
);
