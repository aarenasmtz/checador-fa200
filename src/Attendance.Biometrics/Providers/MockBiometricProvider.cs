using Attendance.Biometrics.Interfaces;
using Attendance.Domain.Entities;
using Attendance.Domain.Enums;
using Microsoft.Extensions.Logging;

namespace Attendance.Biometrics.Providers;

public class MockBiometricProvider : IBiometricProvider
{
    private readonly ILogger<MockBiometricProvider> _logger;

    public MockBiometricProvider(ILogger<MockBiometricProvider> logger)
    {
        _logger = logger;
    }

    public string ProviderName => "Mock";

    public Task<bool> TestConnectionAsync(BiometricDevice device, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[MockBiometricProvider] Probando conexión simulada exitosa para dispositivo {DeviceCode} ({DeviceName})", device.Code, device.Name);
        return Task.FromResult(true);
    }

    public Task<IEnumerable<BiometricEvent>> GetEventsAsync(BiometricDevice device, DateTime? from, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[MockBiometricProvider] Obteniendo eventos simulados para dispositivo {DeviceCode} desde {FromDate}", device.Code, from);
        return Task.FromResult<IEnumerable<BiometricEvent>>(Array.Empty<BiometricEvent>());
    }

    public Task<bool> SyncEmployeeAsync(BiometricDevice device, Employee employee, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[MockBiometricProvider] Sincronizando empleado {EmployeeCode} ({FullName}) con dispositivo simulado {DeviceCode}", employee.EmployeeCode, $"{employee.FirstName} {employee.LastName}", device.Code);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteEmployeeAsync(BiometricDevice device, string employeeCode, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[MockBiometricProvider] Eliminando empleado {EmployeeCode} de dispositivo simulado {DeviceCode}", employeeCode, device.Code);
        return Task.FromResult(true);
    }
}
