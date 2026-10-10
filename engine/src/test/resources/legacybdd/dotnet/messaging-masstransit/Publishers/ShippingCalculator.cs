namespace Shipping.Publishers;

public class ShippingCalculator
{
    public decimal Cost(decimal weightKg)
    {
        return weightKg <= 1 ? 5m : 5m + (weightKg - 1) * 2m;
    }
}
