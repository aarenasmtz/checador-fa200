using Attendance.Domain.Entities;

namespace Attendance.Biometrics.Interfaces;

public interface IBiometricProvider
{
    string ProviderName { get; }

    Task<bool> TestConnectionAsync(
        BiometricDevice device,
        CancellationToken cancellationToken = default);

    Task<IEnumerable<BiometricEvent>> GetEventsAsync(
        BiometricDevice device,
        DateTime? from,
        CancellationToken cancellationToken = default);

    Task<bool> SyncEmployeeAsync(
        BiometricDevice device,
        Employee employee,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteEmployeeAsync(
        BiometricDevice device,
        string employeeCode,
        CancellationToken cancellationToken = default);
}
