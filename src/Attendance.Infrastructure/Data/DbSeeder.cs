using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Attendance.Infrastructure.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext context)
    {
        // 1. Roles and Permissions
        if (!await context.Roles.AnyAsync())
        {
            var superAdminRole = new Role { Name = "SUPERADMIN", Description = "Super Administrador con acceso total" };
            var adminRole = new Role { Name = "ADMIN", Description = "Administrador del sistema" };
            var hrRole = new Role { Name = "RH", Description = "Recursos Humanos y control de personal" };
            var supervisorRole = new Role { Name = "SUPERVISOR", Description = "Supervisor de sucursal asignada" };
            var viewerRole = new Role { Name = "CONSULTA", Description = "Solo consulta y reportes" };

            context.Roles.AddRange(superAdminRole, adminRole, hrRole, supervisorRole, viewerRole);
            await context.SaveChangesAsync();

            var permissions = new List<Permission>
            {
                new() { Code = "employees.view", Module = "Employees", Description = "Ver lista y detalle de empleados" },
                new() { Code = "employees.manage", Module = "Employees", Description = "Crear, editar y desactivar empleados" },
                new() { Code = "attendance.view", Module = "Attendance", Description = "Ver asistencias" },
                new() { Code = "attendance.reprocess", Module = "Attendance", Description = "Reprocesar asistencias" },
                new() { Code = "devices.view", Module = "Devices", Description = "Ver dispositivos biométricos" },
                new() { Code = "devices.manage", Module = "Devices", Description = "Administrar dispositivos y simulador" },
                new() { Code = "reports.view", Module = "Reports", Description = "Ver reportes" },
                new() { Code = "reports.export", Module = "Reports", Description = "Exportar reportes a Excel/PDF" },
                new() { Code = "incidents.manage", Module = "Incidents", Description = "Aprobar o rechazar incidencias" },
                new() { Code = "users.manage", Module = "Users", Description = "Administrar usuarios del sistema" },
            };
            context.Permissions.AddRange(permissions);
            await context.SaveChangesAsync();

            foreach (var perm in permissions)
            {
                context.RolePermissions.Add(new RolePermission { RoleId = superAdminRole.Id, PermissionId = perm.Id });
                context.RolePermissions.Add(new RolePermission { RoleId = adminRole.Id, PermissionId = perm.Id });
            }
            await context.SaveChangesAsync();

            // Default Admin User (Password: Admin123!)
            var adminUser = new User
            {
                Username = "admin",
                Email = "admin@hualong.com",
                FullName = "Administrador General",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                Status = CommonStatus.Active,
                CreatedAt = DateTime.UtcNow
            };
            context.Users.Add(adminUser);
            await context.SaveChangesAsync();

            context.UserRoles.Add(new UserRole { UserId = adminUser.Id, RoleId = superAdminRole.Id });
            await context.SaveChangesAsync();
        }

        // 2. Company & Branches
        if (!await context.Companies.AnyAsync())
        {
            var company = new Company
            {
                Name = "华龙商业集团 (Grupo Comercial Hualong)",
                TaxId = "HLG20260901X1",
                Status = CommonStatus.Active
            };
            context.Companies.Add(company);
            await context.SaveChangesAsync();

            var branches = new List<Branch>
            {
                new() { CompanyId = company.Id, Code = "CENTRO", Name = "中心店 (Sucursal Centro)", Address = "Av. Reforma 120, CDMX", TimeZone = "America/Mexico_City" },
                new() { CompanyId = company.Id, Code = "NORTE", Name = "北区店 (Sucursal Norte)", Address = "Av. Insurgentes Nte 450, CDMX", TimeZone = "America/Mexico_City" },
                new() { CompanyId = company.Id, Code = "SUR", Name = "南区店 (Sucursal Sur)", Address = "Calzada de Tlalpan 890, CDMX", TimeZone = "America/Mexico_City" },
                new() { CompanyId = company.Id, Code = "PLAZA", Name = "广场店 (Sucursal Plaza)", Address = "Periférico Sur 2100, CDMX", TimeZone = "America/Mexico_City" },
            };
            context.Branches.AddRange(branches);
            await context.SaveChangesAsync();

            // 3. Departments & Positions
            var departments = new List<Department>
            {
                new() { CompanyId = company.Id, Name = "管理部 (Administración)" },
                new() { CompanyId = company.Id, Name = "人事部 (Recursos Humanos)" },
                new() { CompanyId = company.Id, Name = "运营部 (Operaciones)" },
                new() { CompanyId = company.Id, Name = "销售部 (Ventas)" },
                new() { CompanyId = company.Id, Name = "技术部 (Tecnología/TI)" },
            };
            context.Departments.AddRange(departments);
            await context.SaveChangesAsync();

            var positions = new List<Position>
            {
                new() { CompanyId = company.Id, Name = "总经理 (Gerente General)" },
                new() { CompanyId = company.Id, Name = "店长 (Gerente de Sucursal)" },
                new() { CompanyId = company.Id, Name = "主管 (Supervisor)" },
                new() { CompanyId = company.Id, Name = "收银员 (Cajero)" },
                new() { CompanyId = company.Id, Name = "销售代表 (Vendedor)" },
                new() { CompanyId = company.Id, Name = "助理 (Auxiliar)" },
            };
            context.Positions.AddRange(positions);
            await context.SaveChangesAsync();

            // 4. Schedules
            var standardSchedule = new Schedule
            {
                CompanyId = company.Id,
                Name = "标准白班 (Turno Estándar Matutino 08:00 - 18:00)",
                StartTime = new TimeSpan(8, 0, 0),
                EndTime = new TimeSpan(18, 0, 0),
                ToleranceMinutes = 10,
                MealStartTime = new TimeSpan(13, 0, 0),
                MealEndTime = new TimeSpan(14, 0, 0),
                ExpectedHours = 9.0m,
                Status = CommonStatus.Active
            };
            context.Schedules.Add(standardSchedule);
            await context.SaveChangesAsync();

            for (int i = 1; i <= 6; i++) // Monday to Saturday
            {
                context.WorkDays.Add(new WorkDay
                {
                    ScheduleId = standardSchedule.Id,
                    DayOfWeek = (DayOfWeek)i,
                    IsWorkingDay = true
                });
            }
            context.WorkDays.Add(new WorkDay
            {
                ScheduleId = standardSchedule.Id,
                DayOfWeek = DayOfWeek.Sunday,
                IsWorkingDay = false // Rest day
            });
            await context.SaveChangesAsync();

            // 5. Ready for real production: No simulated devices, no fake employees, no simulated attendances.
            // Biometric devices, real employees, and real punches will be added by administrator.
        }
    }
}

