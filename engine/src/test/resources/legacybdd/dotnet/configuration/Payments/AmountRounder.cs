namespace Payments.Payments;

public class AmountRounder
{
    public decimal Round(decimal amount)
    {
        return Math.Round(amount, 2, MidpointRounding.ToEven);
    }
}
