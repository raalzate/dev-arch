using Azure.Messaging.ServiceBus;

namespace Billing.Messaging;

public class PaymentReceivedListener
{
    private readonly ServiceBusProcessor _processor;

    public PaymentReceivedListener(ServiceBusClient client)
    {
        _processor = client.CreateProcessor("payments");
        _processor.ProcessMessageAsync += OnMessage;
        _processor.ProcessErrorAsync += OnError;
    }

    public Task StartAsync()
    {
        return _processor.StartProcessingAsync();
    }

    private static Task OnMessage(ProcessMessageEventArgs args)
    {
        Console.WriteLine(args.Message.Body.ToString());
        return args.CompleteMessageAsync(args.Message);
    }

    private static Task OnError(ProcessErrorEventArgs args)
    {
        Console.WriteLine(args.Exception.Message);
        return Task.CompletedTask;
    }
}
