using Attendance.Domain.Enums;

namespace Attendance.Domain.Entities;

public class Employee
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public int BranchId { get; set; }
    public int? DepartmentId { get; set; }
    public int? PositionId { get; set; }

    public string EmployeeCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Phone { get; set; }

    public DateTime HireDate { get; set; } = DateTime.UtcNow.Date;
    public DateTime? TerminationDate { get; set; }

    public CommonStatus Status { get; set; } = CommonStatus.Active;
    public string BiometricExternalId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Company Company { get; set; } = null!;
    public Branch Branch { get; set; } = null!;
    public Department? Department { get; set; }
    public Position? Position { get; set; }

    public ICollection<EmployeeSchedule> EmployeeSchedules { get; set; } = new List<EmployeeSchedule>();
    public ICollection<BiometricEvent> BiometricEvents { get; set; } = new List<BiometricEvent>();
    public ICollection<AttendanceDaily> AttendanceDailies { get; set; } = new List<AttendanceDaily>();
    public ICollection<AttendanceIncident> Incidents { get; set; } = new List<AttendanceIncident>();
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
}

public class Schedule
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;

    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }

    public int ToleranceMinutes { get; set; } = 10;
    public TimeSpan? MealStartTime { get; set; }
    public TimeSpan? MealEndTime { get; set; }

    public decimal ExpectedHours { get; set; } = 8.0m;
    public CommonStatus Status { get; set; } = CommonStatus.Active;

    public Company Company { get; set; } = null!;
    public ICollection<WorkDay> WorkDays { get; set; } = new List<WorkDay>();
    public ICollection<EmployeeSchedule> EmployeeSchedules { get; set; } = new List<EmployeeSchedule>();
}

public class WorkDay
{
    public int Id { get; set; }
    public int ScheduleId { get; set; }
    public DayOfWeek DayOfWeek { get; set; }
    public bool IsWorkingDay { get; set; } = true;

    public Schedule Schedule { get; set; } = null!;
}

public class EmployeeSchedule
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public int ScheduleId { get; set; }

    public DateTime ValidFrom { get; set; }
    public DateTime? ValidTo { get; set; }

    public Employee Employee { get; set; } = null!;
    public Schedule Schedule { get; set; } = null!;
}

public class Holiday
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public DateTime Date { get; set; }
    public string Name { get; set; } = string.Empty;

    public Company Company { get; set; } = null!;
}
