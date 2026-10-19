using Attendance.Biometrics.Interfaces;
using Microsoft.Extensions.DependencyInjection;

namespace Attendance.Biometrics.Factory;

public interface IBiometricProviderFactory
{
    IBiometricProvider GetProvider(string providerName);
}

public class BiometricProviderFactory : IBiometricProviderFactory
{
    private readonly IServiceProvider _serviceProvider;

    public BiometricProviderFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IBiometricProvider GetProvider(string providerName)
    {
        var providers = _serviceProvider.GetServices<IBiometricProvider>();
        var match = providers.FirstOrDefault(p => p.ProviderName.Equals(providerName, StringComparison.OrdinalIgnoreCase));

        return match ?? providers.First(p => p.ProviderName == "Mock");
    }
}
