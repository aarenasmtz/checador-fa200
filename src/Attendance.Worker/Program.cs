using Attendance.Application.Interfaces;
using Attendance.Application.Services;
using Attendance.Infrastructure.Data;
using Attendance.Worker;
using Microsoft.EntityFrameworkCore;

var builder = Host.CreateApplicationBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=localhost;Database=AttendanceDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<IAttendanceProcessingService, AttendanceProcessingService>();

builder.Services.AddHostedService<Worker>();

var host = builder.Build();
host.Run();
