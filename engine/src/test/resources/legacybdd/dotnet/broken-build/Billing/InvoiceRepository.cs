namespace Ledger.Billing;

public class InvoiceRepository
{
    public IEnumerable<decimal> Amounts(int customerId)
    {
        return new[] { 10m * customerId, 20m };
    }
}
