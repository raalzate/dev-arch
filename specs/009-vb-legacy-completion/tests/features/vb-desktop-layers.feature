# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-5 @P2
Feature: Layers of a legacy desktop application
  As an architect
  I want forms, reports, data access objects, modules and web services written in VB to land in coherent layers
  So that the layered view of the legacy system is readable

  @TS-040 @FR-040 @acceptance
  Scenario Outline: Layers of the synthetic corpus
    Given the synthetic VB project "<project>"
    When the project is analyzed
    Then the component "<component>" is in layer "<layer>"

    Examples:
      | project              | component                                | layer       |
      | SyntheticDesktop     | LegacyShop.Forms.CustomerForm            | Web         |
      | SyntheticDesktop     | LegacyShop.Forms.MainWindow              | Web         |
      | SyntheticDesktop     | LegacyShop.Reports.MonthlySalesReport    | Web         |
      | SyntheticDesktop     | LegacyShop.DataAccess.CustomerDataAccess | Datos       |
      | SyntheticDesktop     | LegacyShop.DataAccess.InvoiceAdapter     | Datos       |
      | SyntheticDesktop     | LegacyShop.Modules.DbMaintenance         | Datos       |
      | SyntheticDesktop     | LegacyShop.Modules.AppGlobals            | Compartida  |
      | SyntheticDesktop     | LegacyShop.Business.CustomerController   | Negocio     |
      | SyntheticWebServices | LegacyShop.Services.CustomerWebService   | Controlador |
      | SyntheticWebServices | LegacyShop.Services.OrderService         | Controlador |

  @TS-041 @FR-040 @acceptance
  Scenario Outline: Naming conventions of legacy desktop classes
    Given a VB legacy project with an empty class "Sample.<name>"
    When the project is analyzed
    Then the component "Sample.<name>" is in layer "<layer>"

    Examples:
      | name                | layer      |
      | frmLogin            | Web        |
      | SalesForm           | Web        |
      | Platform            | Compartida |
      | rptInvoices         | Web        |
      | InventoryReporte    | Web        |
      | CustomerDAL         | Datos      |
      | OrdersDal           | Datos      |
      | Medal               | Compartida |
      | LedgerDataLayer     | Datos      |
      | PricingTableAdapter | Datos      |
      | BillingController   | Negocio    |
      | AuditRepository     | Datos      |

  @TS-042 @FR-040 @acceptance
  Scenario: Base types of forms, user controls, reports and data sets
    Given a VB legacy project with the file "Bases.vb":
      """
      Namespace Sample
          Public Class AddressPicker
              Inherits System.Windows.Forms.UserControl
          End Class

          Public Class SalesSummary
              Inherits CrystalDecisions.CrystalReports.Engine.ReportClass
          End Class

          Public Class Catalog
              Inherits System.Data.DataSet
          End Class

          Public Class BaseWindow
              Inherits System.Windows.Forms.Form
          End Class

          Public Class Settings
              Inherits BaseWindow
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.AddressPicker" is in layer "Web"
    And the component "Sample.SalesSummary" is in layer "Web"
    And the component "Sample.Catalog" is in layer "Datos"
    And the component "Sample.BaseWindow" is in layer "Web"
    And the component "Sample.Settings" is in layer "Web"

  @TS-043 @FR-040 @acceptance
  Scenario: Priority between presentation, controller, data and module rules
    Given a VB legacy project with the file "Priority.vb":
      """
      Namespace Sample
          Public Class OrdersForm
              Public Sub Load()
                  Dim sql As String = "SELECT * FROM Orders"
              End Sub
          End Class

          Public Class SyncController
              Public Sub Run()
                  Dim sql As String = "DELETE FROM SyncQueue"
              End Sub
          End Class

          Public Class PricingService
              Public Sub Run()
                  Dim sql As String = "UPDATE Prices SET Amount = 0"
              End Sub
          End Class

          Public Module BillingService
              Public Sub Run()
              End Sub
          End Module

          Public Module LegacySql
              Public Sub Purge()
                  Dim sql As String = "DELETE FROM Staging"
              End Sub
          End Module
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.OrdersForm" is in layer "Web"
    And the component "Sample.SyncController" is in layer "Negocio"
    And the component "Sample.PricingService" is in layer "Datos"
    And the component "Sample.BillingService" is in layer "Compartida"
    And the component "Sample.LegacySql" is in layer "Datos"

  @TS-044 @FR-041 @acceptance
  Scenario: Interfaces keep the general classification
    Given a VB legacy project with the file "Contracts.vb":
      """
      Namespace Sample
          Public Interface IReportService
          End Interface

          Public Interface ICustomerForm
          End Interface
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.IReportService" is in layer "Negocio"
    And the component "Sample.ICustomerForm" is in layer "Compartida"

  @TS-045 @FR-040 @acceptance
  Scenario: Rules of feature 004 are preserved for business facades and adapters
    Given a VB legacy project with the file "Facades.vb":
      """
      Namespace Sample
          Public Class AccountingController
              Public Function Total() As Decimal
                  Return 0
              End Function
          End Class

          Public Class LedgerAdapter
              Public Function Load() As Object
                  Return Nothing
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.AccountingController" is in layer "Negocio"
    And the component "Sample.LedgerAdapter" is in layer "Datos"
