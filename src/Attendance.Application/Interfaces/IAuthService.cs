using Attendance.Application.DTOs;
using Attendance.Domain.Entities;

namespace Attendance.Application.Interfaces;

public interface ITokenService
{
    string GenerateAccessToken(User user, IEnumerable<string> roles, IEnumerable<string> permissions);
    string GenerateRefreshToken();
}

public interface IAuthService
{
    Task<LoginResponse?> LoginAsync(LoginRequest request);
    Task<LoginResponse?> RefreshTokenAsync(RefreshTokenRequest request);
    Task<UserDto?> GetCurrentUserAsync(int userId);
}
