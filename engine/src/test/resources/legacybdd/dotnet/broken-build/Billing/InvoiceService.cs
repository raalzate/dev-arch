using Contoso.Internal.LedgerSdk;

namespace Ledger.Billing;

public class InvoiceService
{
    private readonly ILedgerClient _ledger;
    private readonly InvoiceRepository _repository;

    public InvoiceService(ILedgerClient ledger, InvoiceRepository repository)
    {
        _ledger = ledger;
        _repository = repository;
    }

    public decimal Total(int customerId)
    {
        // Does not compile: UndefinedTaxTable and the ledger SDK are unresolved.
        return _repository.Amounts(customerId).Sum() * UndefinedTaxTable.Rate(customerId) + _ledger.Fees();
    }
}
