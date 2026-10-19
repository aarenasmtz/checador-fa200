using Attendance.Application.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Infrastructure.Data;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Serilog;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// Configure Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .WriteTo.Console()
    .WriteTo.File(Environment.GetEnvironmentVariable("LOG_FILE_PATH") ?? "logs/attendance-api-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

// Add Database Context
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Server=localhost;Database=AttendanceDb;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True;";

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<Attendance.Application.Interfaces.ITokenService, Attendance.Infrastructure.Services.TokenService>();
builder.Services.AddScoped<Attendance.Application.Interfaces.IAuthService, Attendance.Application.Services.AuthService>();

builder.Services.AddScoped<Attendance.Application.Services.IAttendanceProcessingService, Attendance.Application.Services.AttendanceProcessingService>();
builder.Services.AddScoped<Attendance.Application.Services.IBiometricIngestionService, Attendance.Application.Services.BiometricIngestionService>();

builder.Services.AddScoped<Attendance.Biometrics.Interfaces.IBiometricProvider, Attendance.Biometrics.Providers.MockBiometricProvider>();
builder.Services.AddScoped<Attendance.Biometrics.Interfaces.IBiometricProvider, Attendance.Biometrics.Providers.Fa200BiometricProvider>();
builder.Services.AddScoped<Attendance.Biometrics.Factory.IBiometricProviderFactory, Attendance.Biometrics.Factory.BiometricProviderFactory>();
builder.Services.AddScoped<Attendance.Application.Interfaces.IPdfReportService, Attendance.Infrastructure.Services.PdfReportService>();

// Health Checks
builder.Services.AddHealthChecks();

// Add Controllers


builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// Add Authentication & JWT Bearer
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var secretKey = Encoding.UTF8.GetBytes(jwtSettings["Secret"] ?? "SuperSecretKeyForAttendanceBiometricControlSystem2026!#$");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(secretKey),
        ValidateIssuer = true,
        ValidIssuer = jwtSettings["Issuer"] ?? "AttendanceSystemApi",
        ValidateAudience = true,
        ValidAudience = jwtSettings["Audience"] ?? "AttendanceSystemClients",
        ValidateLifetime = true,
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("ProductionCors", policy =>
    {
        policy.WithOrigins(
            "https://checador.baifenbai.com",
            "https://checador.wpcbajio.com",
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials();
    });
});

// Configure Swagger with JWT Support
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Sistema de Control de Asistencia y Checador Biométrico API",
        Version = "v1",
        Description = "API REST corporativa para gestión de asistencia, sucursales y dispositivos biométricos FA200."
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Auto-migrate & Seed Database in Development
using (var scope = app.Services.CreateScope())
{
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    try
    {
        await context.Database.EnsureCreatedAsync();
        await DbSeeder.SeedAsync(context);
        Log.Information("Base de datos y datos semilla verificados exitosamente.");
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Error al inicializar la base de datos.");
    }
}

// Pipeline Configuration
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "Attendance API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("ProductionCors");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

Log.Information("====================================================================");
Log.Information("🚀 API de Control de Asistencia iniciada y lista para recibir peticiones");
Log.Information("📡 Escuchando en: http://localhost:5081");
Log.Information("📚 Swagger UI: http://localhost:5081/swagger");
Log.Information("====================================================================");

app.Run();

public partial class Program { }
