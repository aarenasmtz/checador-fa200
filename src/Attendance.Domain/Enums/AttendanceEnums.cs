namespace Attendance.Domain.Enums;

public enum CommonStatus
{
    Inactive = 0,
    Active = 1
}

public enum BiometricMethod
{
    Face = 1,
    Fingerprint = 2,
    Card = 3,
    Manual = 4
}

public enum BiometricEventType
{
    Auto = 0,
    Entry = 1,
    Exit = 2,
    MealExit = 3,
    MealReturn = 4,
    Punch = 5
}

public enum DeviceConnectionMode
{
    Unknown = 0,
    TcpIp = 1,
    AdmsPush = 2,
    LocalAgent = 3,
    Usb = 4
}

public enum DeviceStatus
{
    Simulated = 0,
    Online = 1,
    Offline = 2,
    Syncing = 3,
    Error = 4
}

public enum EventProcessingStatus
{
    Pending = 0,
    Processed = 1,
    Error = 2,
    Ignored = 3,
    PendingLink = 4
}

public enum AttendanceStatus
{
    Absent = 0,
    OnTime = 1,
    Late = 2,
    EarlyExit = 3,
    Incomplete = 4,
    RestDay = 5,
    Holiday = 6,
    Vacation = 7,
    Permission = 8,
    Disability = 9
}

public enum IncidentType
{
    PunchMiss = 1,
    JustifiedAbsence = 2,
    JustifiedLate = 3,
    Permission = 4,
    Vacation = 5,
    Disability = 6,
    HomeOffice = 7,
    FieldWork = 8,
    ScheduleCorrection = 9
}

public enum IncidentStatus
{
    Pending = 0,
    Approved = 1,
    Rejected = 2
}

public enum LeaveType
{
    Vacation = 1,
    Medical = 2,
    Personal = 3,
    Maternity = 4,
    Other = 5
}
