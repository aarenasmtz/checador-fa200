using Attendance.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Application.Interfaces;

public interface IAppDbContext
{
    DbSet<Company> Companies { get; }
    DbSet<Branch> Branches { get; }
    DbSet<Department> Departments { get; }
    DbSet<Position> Positions { get; }
    DbSet<Employee> Employees { get; }
    DbSet<Schedule> Schedules { get; }
    DbSet<WorkDay> WorkDays { get; }
    DbSet<EmployeeSchedule> EmployeeSchedules { get; }
    DbSet<Holiday> Holidays { get; }
    DbSet<BiometricDevice> BiometricDevices { get; }
    DbSet<BiometricEvent> BiometricEvents { get; }
    DbSet<AttendanceDaily> AttendanceDailies { get; }
    DbSet<AttendanceIncident> AttendanceIncidents { get; }
    DbSet<LeaveRequest> LeaveRequests { get; }
    DbSet<User> Users { get; }
    DbSet<Role> Roles { get; }
    DbSet<Permission> Permissions { get; }
    DbSet<UserRole> UserRoles { get; }
    DbSet<RolePermission> RolePermissions { get; }
    DbSet<AuditLog> AuditLogs { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
