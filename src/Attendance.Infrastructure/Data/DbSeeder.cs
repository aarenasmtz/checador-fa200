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

            // 5. Biometric Devices (4 FA200 simulated devices)
            var devices = new List<BiometricDevice>
            {
                new() { BranchId = branches[0].Id, Code = "FA200-CENTRO-01", Name = "FA200 中心店主出入口", Model = "FA200", Status = DeviceStatus.Simulated, Provider = "Mock", IpAddress = "192.168.1.101", Port = 4370 },
                new() { BranchId = branches[1].Id, Code = "FA200-NORTE-01", Name = "FA200 北区店大门", Model = "FA200", Status = DeviceStatus.Simulated, Provider = "Mock", IpAddress = "192.168.2.101", Port = 4370 },
                new() { BranchId = branches[2].Id, Code = "FA200-SUR-01", Name = "FA200 南区店考勤机", Model = "FA200", Status = DeviceStatus.Simulated, Provider = "Mock", IpAddress = "192.168.3.101", Port = 4370 },
                new() { BranchId = branches[3].Id, Code = "FA200-PLAZA-01", Name = "FA200 广场店主入口", Model = "FA200", Status = DeviceStatus.Simulated, Provider = "Mock", IpAddress = "192.168.4.101", Port = 4370 },
            };
            context.BiometricDevices.AddRange(devices);
            await context.SaveChangesAsync();

            // 6. Employees (50 employees with Chinese and Spanish names)
            var employees = new List<Employee>();
            string[] chineseNames = [
                "张伟", "李强", "王敏", "刘军", "陈亮", "杨平", "赵敏", "黄俊", "周刚", "吴海",
                "孙芳", "朱浩", "胡健", "高远", "林洁", "徐鹏", "何娜", "郭飞", "马丽", "罗丹",
                "梁波", "宋婷", "郑磊", "谢晨", "韩雪", "唐明", "冯宇", "于涛", "董静", "萧峰",
                "程凯", "曹杰", "袁帅", "邓颖", "许强", "付勇", "沈浩", "曾敏", "彭辉", "吕倩",
                "苏晴", "卢振", "蒋林", "蔡斌", "贾旭", "丁毅", "魏民", "薛燕", "叶挺", "潘婷"
            ];
            string[] pinyinNames = [
                "Zhang Wei", "Li Qiang", "Wang Min", "Liu Jun", "Chen Liang", "Yang Ping", "Zhao Min", "Huang Jun", "Zhou Gang", "Wu Hai",
                "Sun Fang", "Zhu Hao", "Hu Jian", "Gao Yuan", "Lin Jie", "Xu Peng", "He Na", "Guo Fei", "Ma Li", "Luo Dan",
                "Liang Bo", "Song Ting", "Zheng Lei", "Xie Chen", "Han Xue", "Tang Ming", "Feng Yu", "Yu Tao", "Dong Jing", "Xiao Feng",
                "Cheng Kai", "Cao Jie", "Yuan Shuai", "Deng Ying", "Xu Qiang", "Fu Yong", "Shen Hao", "Zeng Min", "Peng Hui", "Lv Qian",
                "Su Qing", "Lu Zhen", "Jiang Lin", "Cai Bin", "Jia Xu", "Ding Yi", "Wei Min", "Xue Yan", "Ye Ting", "Pan Ting"
            ];

            for (int i = 0; i < 50; i++)
            {
                var empCode = $"EMP{(i + 1):D4}";
                var branchIdx = i % branches.Count;
                var deptIdx = i % departments.Count;
                var posIdx = i % positions.Count;

                var emp = new Employee
                {
                    CompanyId = company.Id,
                    BranchId = branches[branchIdx].Id,
                    DepartmentId = departments[deptIdx].Id,
                    PositionId = positions[posIdx].Id,
                    EmployeeCode = empCode,
                    FirstName = chineseNames[i],
                    LastName = pinyinNames[i],
                    Email = $"employee{i + 1}@hualong.com",
                    Phone = $"55-5000-{(i + 1):D4}",
                    HireDate = DateTime.UtcNow.AddMonths(-12).Date,
                    Status = CommonStatus.Active,
                    BiometricExternalId = empCode
                };
                employees.Add(emp);
            }
            context.Employees.AddRange(employees);
            await context.SaveChangesAsync();

            // Link Schedule to Employees
            foreach (var emp in employees)
            {
                context.EmployeeSchedules.Add(new EmployeeSchedule
                {
                    EmployeeId = emp.Id,
                    ScheduleId = standardSchedule.Id,
                    ValidFrom = DateTime.UtcNow.AddYears(-1)
                });
            }
            await context.SaveChangesAsync();

            // 7. Seed Attendance Events for the past 14 days
            var today = DateTime.UtcNow.Date;
            var rand = new Random(42);

            for (int d = 14; d >= 0; d--)
            {
                var currentDate = today.AddDays(-d);
                if (currentDate.DayOfWeek == DayOfWeek.Sunday) continue; // Skip Sunday rest day

                foreach (var emp in employees)
                {
                    var roll = rand.Next(100);
                    var device = devices.First(dev => dev.BranchId == emp.BranchId);

                    // 80% OnTime, 10% Late, 5% Absent, 5% EarlyExit
                    if (roll < 80)
                    {
                        // On time: entry 07:50 - 08:05, exit 18:00 - 18:15
                        var entryMin = rand.Next(-10, 6);
                        var entryTime = new TimeSpan(8, 0, 0).Add(TimeSpan.FromMinutes(entryMin));
                        var exitMin = rand.Next(0, 20);
                        var exitTime = new TimeSpan(18, 0, 0).Add(TimeSpan.FromMinutes(exitMin));

                        CreatePunchPair(context, device, emp, currentDate, entryTime, exitTime, AttendanceStatus.OnTime, 0, (int)(exitTime - entryTime).TotalMinutes);
                    }
                    else if (roll < 90)
                    {
                        // Late: entry 08:15 - 08:45, exit 18:00
                        var lateMin = rand.Next(15, 46);
                        var entryTime = new TimeSpan(8, 0, 0).Add(TimeSpan.FromMinutes(lateMin));
                        var exitTime = new TimeSpan(18, 5, 0);

                        CreatePunchPair(context, device, emp, currentDate, entryTime, exitTime, AttendanceStatus.Late, lateMin - 10, (int)(exitTime - entryTime).TotalMinutes);
                    }
                    else if (roll < 95)
                    {
                        // Early Exit: entry 07:55, exit 16:30
                        var entryTime = new TimeSpan(7, 55, 0);
                        var exitTime = new TimeSpan(16, 30, 0);
                        CreatePunchPair(context, device, emp, currentDate, entryTime, exitTime, AttendanceStatus.EarlyExit, 0, (int)(exitTime - entryTime).TotalMinutes);
                    }
                    else
                    {
                        // Absent
                        context.AttendanceDailies.Add(new AttendanceDaily
                        {
                            EmployeeId = emp.Id,
                            Date = currentDate,
                            Status = AttendanceStatus.Absent,
                            ExpectedEntry = new TimeSpan(8, 0, 0),
                            ExpectedExit = new TimeSpan(18, 0, 0),
                            MinutesLate = 0,
                            MinutesWorked = 0,
                            OvertimeMinutes = 0
                        });
                    }
                }
            }
            await context.SaveChangesAsync();
        }
    }

    private static void CreatePunchPair(
        AppDbContext context,
        BiometricDevice device,
        Employee emp,
        DateTime date,
        TimeSpan entryTime,
        TimeSpan exitTime,
        AttendanceStatus status,
        int lateMinutes,
        int workedMinutes)
    {
        var entryDt = date.Add(entryTime);
        var exitDt = date.Add(exitTime);

        var entryHash = BiometricEvent.ComputeHash(device.Code, emp.EmployeeCode, entryDt, BiometricMethod.Face);
        var exitHash = BiometricEvent.ComputeHash(device.Code, emp.EmployeeCode, exitDt, BiometricMethod.Fingerprint);

        var event1 = new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = entryDt,
            ReceivedAtUtc = entryDt.ToUniversalTime(),
            Method = BiometricMethod.Face,
            EventType = BiometricEventType.Entry,
            EventHash = entryHash,
            ProcessingStatus = EventProcessingStatus.Processed,
            ProcessedAtUtc = DateTime.UtcNow
        };

        var event2 = new BiometricEvent
        {
            DeviceId = device.Id,
            EmployeeId = emp.Id,
            DeviceTimestamp = exitDt,
            ReceivedAtUtc = exitDt.ToUniversalTime(),
            Method = BiometricMethod.Fingerprint,
            EventType = BiometricEventType.Exit,
            EventHash = exitHash,
            ProcessingStatus = EventProcessingStatus.Processed,
            ProcessedAtUtc = DateTime.UtcNow
        };

        context.BiometricEvents.Add(event1);
        context.BiometricEvents.Add(event2);

        var daily = new AttendanceDaily
        {
            EmployeeId = emp.Id,
            Date = date,
            FirstEntry = entryTime,
            LastExit = exitTime,
            ExpectedEntry = new TimeSpan(8, 0, 0),
            ExpectedExit = new TimeSpan(18, 0, 0),
            MinutesLate = lateMinutes,
            MinutesWorked = workedMinutes,
            OvertimeMinutes = Math.Max(0, workedMinutes - 540), // > 9 hours
            Status = status
        };

        context.AttendanceDailies.Add(daily);
    }
}
