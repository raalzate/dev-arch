using MassTransit;

namespace Shipping.Consumers;

public record ShipmentRequested(Guid OrderId, string Address);

public class ShipmentRequestedConsumer : IConsumer<ShipmentRequested>
{
    public Task Consume(ConsumeContext<ShipmentRequested> context)
    {
        Console.WriteLine($"Shipping order {context.Message.OrderId}");
        return Task.CompletedTask;
    }
}
