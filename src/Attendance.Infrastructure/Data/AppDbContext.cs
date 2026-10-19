using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Attendance.Infrastructure.Data;

public class AppDbContext : DbContext, IAppDbContext
{

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<Company> Companies => Set<Company>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Position> Positions => Set<Position>();
    public DbSet<Employee> Employees => Set<Employee>();
    public DbSet<Schedule> Schedules => Set<Schedule>();
    public DbSet<WorkDay> WorkDays => Set<WorkDay>();
    public DbSet<EmployeeSchedule> EmployeeSchedules => Set<EmployeeSchedule>();
    public DbSet<Holiday> Holidays => Set<Holiday>();
    public DbSet<BiometricDevice> BiometricDevices => Set<BiometricDevice>();
    public DbSet<BiometricEvent> BiometricEvents => Set<BiometricEvent>();
    public DbSet<AttendanceDaily> AttendanceDailies => Set<AttendanceDaily>();
    public DbSet<AttendanceIncident> AttendanceIncidents => Set<AttendanceIncident>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<User> Users => Set<User>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<UserRole> UserRoles => Set<UserRole>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Security composite keys
        modelBuilder.Entity<UserRole>()
            .HasKey(ur => new { ur.UserId, ur.RoleId });

        modelBuilder.Entity<RolePermission>()
            .HasKey(rp => new { rp.RoleId, rp.PermissionId });

        // Unique constraints
        modelBuilder.Entity<Company>()
            .Property(c => c.Name).HasMaxLength(150).IsUnicode(true);

        modelBuilder.Entity<Branch>()
            .HasIndex(b => new { b.CompanyId, b.Code }).IsUnique();

        modelBuilder.Entity<Branch>()
            .Property(b => b.Name).HasMaxLength(150).IsUnicode(true);

        modelBuilder.Entity<Schedule>()
            .Property(s => s.ExpectedHours).HasPrecision(4, 2);

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.EmployeeCode).IsUnique();

        modelBuilder.Entity<Employee>()
            .HasIndex(e => e.BiometricExternalId).IsUnique();

        modelBuilder.Entity<Employee>()
            .Property(e => e.FirstName).HasMaxLength(100).IsUnicode(true);

        modelBuilder.Entity<Employee>()
            .Property(e => e.LastName).HasMaxLength(100).IsUnicode(true);

        modelBuilder.Entity<BiometricDevice>()
            .HasIndex(d => d.Code).IsUnique();

        // Critical Idempotency Index
        modelBuilder.Entity<BiometricEvent>()
            .HasIndex(e => e.EventHash).IsUnique();

        modelBuilder.Entity<BiometricEvent>()
            .HasIndex(e => new { e.EmployeeId, e.DeviceTimestamp });

        // Daily Attendance single record per employee per day
        modelBuilder.Entity<AttendanceDaily>()
            .HasIndex(a => new { a.EmployeeId, a.Date }).IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Username).IsUnique();

        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email).IsUnique();

        modelBuilder.Entity<Role>()
            .HasIndex(r => r.Name).IsUnique();

        modelBuilder.Entity<Permission>()
            .HasIndex(p => p.Code).IsUnique();

        // Foreign Key Relationships
        modelBuilder.Entity<Employee>()
            .HasOne(e => e.Company)
            .WithMany(c => c.Employees)
            .HasForeignKey(e => e.CompanyId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Employee>()
            .HasOne(e => e.Branch)
            .WithMany(b => b.Employees)
            .HasForeignKey(e => e.BranchId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BiometricDevice>()
            .HasOne(d => d.Branch)
            .WithMany(b => b.Devices)
            .HasForeignKey(d => d.BranchId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BiometricEvent>()
            .HasOne(e => e.Device)
            .WithMany(d => d.Events)
            .HasForeignKey(e => e.DeviceId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<BiometricEvent>()
            .HasOne(e => e.Employee)
            .WithMany(emp => emp.BiometricEvents)
            .HasForeignKey(e => e.EmployeeId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AttendanceDaily>()
            .HasOne(a => a.Employee)
            .WithMany(e => e.AttendanceDailies)
            .HasForeignKey(a => a.EmployeeId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
