using Attendance.Domain.Enums;
using System.Security.Cryptography;
using System.Text;

namespace Attendance.Domain.Entities;

public class BiometricDevice
{
    public int Id { get; set; }
    public int BranchId { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    public string Provider { get; set; } = "Mock"; // "Mock", "FA200", etc.
    public string Model { get; set; } = "FA200";
    public string? SerialNumber { get; set; }

    public string? IpAddress { get; set; }
    public int? Port { get; set; }

    public DeviceConnectionMode ConnectionMode { get; set; } = DeviceConnectionMode.LocalAgent;
    public DeviceStatus Status { get; set; } = DeviceStatus.Simulated;

    public DateTime? LastConnectionAt { get; set; }
    public DateTime? LastEventAt { get; set; }
    public DateTime? LastSyncAt { get; set; }
    public int PendingQueueCount { get; set; } = 0;
    public string? LastErrorMessage { get; set; }
    public string? FirmwareVersion { get; set; }

    public Branch Branch { get; set; } = null!;
    public ICollection<BiometricEvent> Events { get; set; } = new List<BiometricEvent>();
}

public class BiometricEvent
{
    public long Id { get; set; }
    public int DeviceId { get; set; }
    public int? EmployeeId { get; set; }
    public string? UserClockId { get; set; }

    public string? ExternalEventId { get; set; }

    public DateTime DeviceTimestamp { get; set; }
    public DateTime ReceivedAtUtc { get; set; } = DateTime.UtcNow;

    public BiometricMethod Method { get; set; } = BiometricMethod.Face;
    public BiometricEventType EventType { get; set; } = BiometricEventType.Auto;
    public int NativePunchCode { get; set; } = 255;
    public string? ClassifiedAs { get; set; } // "ENTRY", "MEAL_EXIT", "MEAL_RETURN", "EXIT", "ADDITIONAL", "IGNORED"

    public string EventHash { get; set; } = string.Empty;
    public string? RawPayload { get; set; }

    public EventProcessingStatus ProcessingStatus { get; set; } = EventProcessingStatus.Pending;
    public DateTime? ProcessedAtUtc { get; set; }

    public BiometricDevice Device { get; set; } = null!;
    public Employee? Employee { get; set; }

    public static string ComputeHash(string deviceCode, string userClockId, DateTime timestamp, BiometricMethod method)
    {
        var raw = $"{deviceCode}:{userClockId}:{timestamp:yyyy-MM-ddTHH:mm:ss}:{method}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}

public class AttendanceDaily
{
    public long Id { get; set; }
    public int EmployeeId { get; set; }
    public DateTime Date { get; set; }

    public TimeSpan? FirstEntry { get; set; }
    public TimeSpan? MealExit { get; set; }
    public TimeSpan? MealReturn { get; set; }
    public TimeSpan? LastExit { get; set; }

    public TimeSpan? ExpectedEntry { get; set; }
    public TimeSpan? ExpectedExit { get; set; }
    public TimeSpan? ExpectedMealStart { get; set; }
    public TimeSpan? ExpectedMealEnd { get; set; }

    public int MinutesLate { get; set; } = 0;
    public int? MealDurationMinutes { get; set; }
    public int MealMinutesLate { get; set; } = 0;
    public int MinutesWorked { get; set; } = 0;
    public int OvertimeMinutes { get; set; } = 0;

    public AttendanceStatus Status { get; set; } = AttendanceStatus.Absent;
    public string Origin { get; set; } = "BIOMETRICO"; // "BIOMETRICO", "MANUAL", "SISTEMA"
    public string ClassificationOrigin { get; set; } = "INFERRED"; // "DEVICE_CODE", "INFERRED_WINDOW", "MANUAL_OVERRIDE"
    public bool RequiresReview { get; set; } = false;
    public string? ReviewNotes { get; set; }

    public bool IsManualOverride { get; set; } = false;
    public AttendanceStatus? OriginalStatus { get; set; }
    public string? ModifiedBy { get; set; }
    public DateTime? ModifiedAt { get; set; }
    public string? ModificationReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Employee Employee { get; set; } = null!;
}

public class AttendanceIncident
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public DateTime AttendanceDate { get; set; }

    public IncidentType Type { get; set; }
    public int Minutes { get; set; } = 0;
    public string Description { get; set; } = string.Empty;

    public IncidentStatus Status { get; set; } = IncidentStatus.Pending;
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public Employee Employee { get; set; } = null!;
}

public class LeaveRequest
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }

    public LeaveType Type { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }

    public string Reason { get; set; } = string.Empty;
    public IncidentStatus Status { get; set; } = IncidentStatus.Pending;

    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }

    public Employee Employee { get; set; } = null!;
}
