namespace Attendance.Application.DTOs;

public record LoginRequest(string Username, string Password);

public record LoginResponse(
    string AccessToken,
    string RefreshToken,
    DateTime ExpiresAt,
    UserDto User
);

public record RefreshTokenRequest(string AccessToken, string RefreshToken);

public record UserDto(
    int Id,
    string Username,
    string Email,
    string FullName,
    int? BranchId,
    string Status,
    List<string> Roles,
    List<string> Permissions
);

public record CreateUserRequest(
    string Username,
    string Email,
    string FullName,
    string Password,
    int? BranchId,
    List<string> Roles
);

public record RoleDto(
    int Id,
    string Name,
    string? Description,
    List<string> Permissions
);

public record PermissionDto(
    int Id,
    string Code,
    string Module,
    string Description
);
