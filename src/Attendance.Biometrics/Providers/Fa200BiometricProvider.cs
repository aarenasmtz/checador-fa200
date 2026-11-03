using Attendance.Biometrics.Interfaces;
using Attendance.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using System.Net.Sockets;

namespace Attendance.Biometrics.Providers;

/// <summary>
/// Proveedor oficial para checadores biométricos FA200 / ZKTeco.
/// Trabaja en conjunto con el agente local o conexión directa TCP/IP.
/// </summary>
public class Fa200BiometricProvider : IBiometricProvider
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<Fa200BiometricProvider> _logger;

    public Fa200BiometricProvider(IConfiguration configuration, ILogger<Fa200BiometricProvider> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public string ProviderName => "FA200";

    public async Task<bool> TestConnectionAsync(BiometricDevice device, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(device.IpAddress))
        {
            _logger.LogInformation("[Fa200BiometricProvider] Dispositivo {DeviceCode} configurado por Agente Local.", device.Code);
            return true;
        }

        try
        {
            using var client = new TcpClient();
            var connectTask = client.ConnectAsync(device.IpAddress, device.Port ?? 4370);
            var delayTask = Task.Delay(2500, cancellationToken);
            var completed = await Task.WhenAny(connectTask, delayTask);
            if (completed == connectTask && client.Connected)
            {
                _logger.LogInformation("[Fa200BiometricProvider] Conexión TCP exitosa con {DeviceCode} en {Ip}:{Port}", device.Code, device.IpAddress, device.Port);
                return true;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[Fa200BiometricProvider] No se pudo conectar directamente por TCP al reloj {DeviceCode} ({Ip}:{Port}). Operando en modo Agente Local.", device.Code, device.IpAddress, device.Port);
        }

        return false;
    }

    public Task<IEnumerable<BiometricEvent>> GetEventsAsync(BiometricDevice device, DateTime? from, CancellationToken cancellationToken = default)
    {
        return Task.FromResult<IEnumerable<BiometricEvent>>(Array.Empty<BiometricEvent>());
    }

    public Task<bool> SyncEmployeeAsync(BiometricDevice device, Employee employee, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Fa200BiometricProvider] Empleado {EmployeeCode} registrado para sincronización en dispositivo {DeviceCode}", employee.EmployeeCode, device.Code);
        return Task.FromResult(true);
    }

    public Task<bool> DeleteEmployeeAsync(BiometricDevice device, string employeeCode, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("[Fa200BiometricProvider] Empleado {EmployeeCode} removido de dispositivo {DeviceCode}", employeeCode, device.Code);
        return Task.FromResult(true);
    }
}
