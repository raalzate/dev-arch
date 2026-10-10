using Microsoft.Extensions.Configuration;

namespace Payments.Payments;

public class PaymentGatewayClient
{
    private readonly IConfiguration _configuration;

    public PaymentGatewayClient(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public string Endpoint()
    {
        return _configuration["Payments:GatewayUrl"] + "?key=" + _configuration["Payments:ApiKey"];
    }
}
