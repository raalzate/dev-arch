namespace Billing.Messaging;

public class InvoiceFormatter
{
    public string Format(string number, decimal total)
    {
        return $"{number}: {total:0.00}";
    }
}
