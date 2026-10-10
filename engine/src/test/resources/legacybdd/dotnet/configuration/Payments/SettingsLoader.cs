using Microsoft.Extensions.Configuration;

namespace Payments.Payments;

public class SettingsLoader
{
    public IConfigurationRoot Load()
    {
        return new ConfigurationBuilder()
            .AddJsonFile("appsettings.json")
            .Build();
    }
}
