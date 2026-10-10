using Azure.Messaging.ServiceBus;

namespace Billing.Messaging;

public class InvoiceSender
{
    private readonly ServiceBusSender _sender;

    public InvoiceSender(ServiceBusClient client)
    {
        _sender = client.CreateSender("invoices");
    }

    public Task SendAsync(string invoiceJson)
    {
        return _sender.SendMessageAsync(new ServiceBusMessage(invoiceJson));
    }
}
