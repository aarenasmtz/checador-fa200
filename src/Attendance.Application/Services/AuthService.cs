using Attendance.Application.DTOs;
using Attendance.Application.Interfaces;
using Attendance.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Application.Services;

public class AuthService : IAuthService
{
    private readonly IAppDbContext _context;
    private readonly ITokenService _tokenService;

    public AuthService(IAppDbContext context, ITokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
    }

    public async Task<LoginResponse?> LoginAsync(LoginRequest request)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Username == request.Username || u.Email == request.Username);

        if (user == null || user.Status != CommonStatus.Active)
            return null;

        bool isPasswordValid = BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash);
        if (!isPasswordValid)
            return null;

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Code)
            .Distinct()
            .ToList();

        var accessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
        var refreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _context.SaveChangesAsync();

        var userDto = new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.BranchId,
            user.Status.ToString(),
            roles,
            permissions
        );

        return new LoginResponse(
            accessToken,
            refreshToken,
            DateTime.UtcNow.AddHours(24),
            userDto
        );
    }

    public async Task<LoginResponse?> RefreshTokenAsync(RefreshTokenRequest request)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.RefreshToken == request.RefreshToken);

        if (user == null || user.RefreshTokenExpiryTime <= DateTime.UtcNow || user.Status != CommonStatus.Active)
            return null;

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Code)
            .Distinct()
            .ToList();

        var newAccessToken = _tokenService.GenerateAccessToken(user, roles, permissions);
        var newRefreshToken = _tokenService.GenerateRefreshToken();

        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = DateTime.UtcNow.AddDays(7);
        await _context.SaveChangesAsync();

        var userDto = new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.BranchId,
            user.Status.ToString(),
            roles,
            permissions
        );

        return new LoginResponse(
            newAccessToken,
            newRefreshToken,
            DateTime.UtcNow.AddHours(24),
            userDto
        );
    }

    public async Task<UserDto?> GetCurrentUserAsync(int userId)
    {
        var user = await _context.Users
            .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                    .ThenInclude(r => r.RolePermissions)
                        .ThenInclude(rp => rp.Permission)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null) return null;

        var roles = user.UserRoles.Select(ur => ur.Role.Name).ToList();
        var permissions = user.UserRoles
            .SelectMany(ur => ur.Role.RolePermissions)
            .Select(rp => rp.Permission.Code)
            .Distinct()
            .ToList();

        return new UserDto(
            user.Id,
            user.Username,
            user.Email,
            user.FullName,
            user.BranchId,
            user.Status.ToString(),
            roles,
            permissions
        );
    }
}
