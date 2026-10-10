using MassTransit;
using Shipping.Consumers;

namespace Shipping.Publishers;

public class ShipmentPublisher
{
    private readonly IPublishEndpoint _publishEndpoint;

    public ShipmentPublisher(IPublishEndpoint publishEndpoint)
    {
        _publishEndpoint = publishEndpoint;
    }

    public Task RequestShipment(Guid orderId, string address)
    {
        return _publishEndpoint.Publish(new ShipmentRequested(orderId, address));
    }
}
