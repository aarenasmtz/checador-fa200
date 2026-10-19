using Attendance.Biometrics.Interfaces;
using Attendance.Domain.Entities;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace Attendance.Biometrics.Providers;

/// <summary>
/// Adaptador reservado para la futura integración del checador físico FA200.
/// En esta etapa NO se implementa comunicación real a ciegas.
/// Se implementará exclusivamente cuando el equipo físico esté disponible en mano.
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

    private bool IsEnabled => bool.TryParse(_configuration["BiometricProviders:FA200:Enabled"], out var enabled) && enabled;

    public Task<bool> TestConnectionAsync(BiometricDevice device, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            _logger.LogWarning("[Fa200BiometricProvider] Intento de conexión a FA200 rechazado: El proveedor está deshabilitado por Feature Flag hasta recibir el dispositivo físico.");
            throw new NotSupportedException("La integración física con el checador FA200 está pendiente de recibir el dispositivo real (Fase Final POC). Use MockBiometricProvider o el Simulador.");
        }

        throw new NotImplementedException("FA200 physical driver implementation pending.");
    }

    public Task<IEnumerable<BiometricEvent>> GetEventsAsync(BiometricDevice device, DateTime? from, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            throw new NotSupportedException("FA200 physical device pending.");
        }

        throw new NotImplementedException();
    }

    public Task<bool> SyncEmployeeAsync(BiometricDevice device, Employee employee, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            throw new NotSupportedException("FA200 physical device pending.");
        }

        throw new NotImplementedException();
    }

    public Task<bool> DeleteEmployeeAsync(BiometricDevice device, string employeeCode, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
        {
            throw new NotSupportedException("FA200 physical device pending.");
        }

        throw new NotImplementedException();
    }
}
