using Attendance.Domain.Enums;

namespace Attendance.Domain.Entities;

public class Company
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? TaxId { get; set; }
    public CommonStatus Status { get; set; } = CommonStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public ICollection<Branch> Branches { get; set; } = new List<Branch>();
    public ICollection<Department> Departments { get; set; } = new List<Department>();
    public ICollection<Position> Positions { get; set; } = new List<Position>();
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<Schedule> Schedules { get; set; } = new List<Schedule>();
    public ICollection<Holiday> Holidays { get; set; } = new List<Holiday>();
}

public class Branch
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string TimeZone { get; set; } = "America/Mexico_City";
    public CommonStatus Status { get; set; } = CommonStatus.Active;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Company Company { get; set; } = null!;
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
    public ICollection<BiometricDevice> Devices { get; set; } = new List<BiometricDevice>();
}

public class Department
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public CommonStatus Status { get; set; } = CommonStatus.Active;

    public Company Company { get; set; } = null!;
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}

public class Position
{
    public int Id { get; set; }
    public int CompanyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public CommonStatus Status { get; set; } = CommonStatus.Active;

    public Company Company { get; set; } = null!;
    public ICollection<Employee> Employees { get; set; } = new List<Employee>();
}
