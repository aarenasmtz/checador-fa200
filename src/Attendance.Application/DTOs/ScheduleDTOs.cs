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
    bool HasMealBreak,
    string MealBreakMode,
    string? MealStartTime,
    string? MealEndTime,
    int? MealDurationMinutes,
    int MealToleranceMinutes,
    bool IsOvernight,
    string? EntryWindowStart,
    string? EntryWindowEnd,
    string? MealExitWindowStart,
    string? MealExitWindowEnd,
    string? MealReturnWindowStart,
    string? MealReturnWindowEnd,
    string? ExitWindowStart,
    string? ExitWindowEnd,
    decimal ExpectedHours,
    string Status,
    List<WorkDayDto> WorkDays,
    int AssignedEmployeesCount
);

public record CreateScheduleRequest(
    string Name,
    string StartTime,
    string EndTime,
    int ToleranceMinutes = 10,
    bool HasMealBreak = true,
    string MealBreakMode = "Fixed",
    string? MealStartTime = null,
    string? MealEndTime = null,
    int? MealDurationMinutes = 60,
    int MealToleranceMinutes = 5,
    bool IsOvernight = false,
    string? EntryWindowStart = null,
    string? EntryWindowEnd = null,
    string? MealExitWindowStart = null,
    string? MealExitWindowEnd = null,
    string? MealReturnWindowStart = null,
    string? MealReturnWindowEnd = null,
    string? ExitWindowStart = null,
    string? ExitWindowEnd = null,
    decimal ExpectedHours = 8.0m,
    List<int>? WorkingDays = null
);

public record UpdateScheduleRequest(
    string Name,
    string StartTime,
    string EndTime,
    int ToleranceMinutes = 10,
    bool HasMealBreak = true,
    string MealBreakMode = "Fixed",
    string? MealStartTime = null,
    string? MealEndTime = null,
    int? MealDurationMinutes = 60,
    int MealToleranceMinutes = 5,
    bool IsOvernight = false,
    string? EntryWindowStart = null,
    string? EntryWindowEnd = null,
    string? MealExitWindowStart = null,
    string? MealExitWindowEnd = null,
    string? MealReturnWindowStart = null,
    string? MealReturnWindowEnd = null,
    string? ExitWindowStart = null,
    string? ExitWindowEnd = null,
    decimal ExpectedHours = 8.0m,
    List<int>? WorkingDays = null,
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
