namespace Attendance.Application.DTOs;

public record BranchDto(
    int Id,
    int CompanyId,
    string Code,
    string Name,
    string? Address,
    string TimeZone,
    string Status,
    int EmployeeCount,
    int DeviceCount
);

public record CreateBranchRequest(
    string Code,
    string Name,
    string? Address,
    string TimeZone = "America/Mexico_City"
);

public record UpdateBranchRequest(
    string Name,
    string? Address,
    string TimeZone,
    string Status
);

public record DepartmentDto(
    int Id,
    int CompanyId,
    string Name,
    string Status,
    int EmployeeCount
);

public record CreateDepartmentRequest(string Name);

public record PositionDto(
    int Id,
    int CompanyId,
    string Name,
    string Status,
    int EmployeeCount
);

public record CreatePositionRequest(string Name);
