using System.Linq;

namespace LegacyPayroll.Domain
{
    public class PayrollService
    {
        private readonly EmployeeRepository _repository;

        public PayrollService(EmployeeRepository repository)
        {
            _repository = repository;
        }

        public decimal MonthlyTotal()
        {
            return _repository.All().Sum(e => e.MonthlySalary);
        }
    }
}
