using System.Collections.Generic;

namespace LegacyPayroll.Domain
{
    public class EmployeeRepository
    {
        public IList<Employee> All()
        {
            return new List<Employee> { new Employee { Id = 1, MonthlySalary = 1000m } };
        }
    }
}
