# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: Tables used by VB legacy components through ADO.NET
  As an architect evaluating a VB.NET desktop monolith
  I want each component to list the database tables it reads or writes through literal SQL and typed DataSets
  So that the microservice proposal groups components by the data they share

  @TS-001 @FR-001 @FR-002 @acceptance
  Scenario: SELECT with schema, delimiters, aliases and JOIN
    Given a VB legacy project with the file "Repo.vb":
      """
      Namespace Sample
          Public Class CustomerRepo
              Public Sub Load()
                  Dim cmd As New SqlCommand("SELECT c.Id, o.Total FROM dbo.Customers c INNER JOIN [Orders] o ON o.CustomerId = c.Id")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.CustomerRepo" uses exactly the tables "Customers, Orders"

  @TS-002 @FR-001 @FR-002 @acceptance
  Scenario: INSERT, UPDATE, DELETE and MERGE targets
    Given a VB legacy project with the file "Writer.vb":
      """
      Namespace Sample
          Public Class Writer
              Public Sub Save(ByVal cmd As Object)
                  cmd.CommandText = "INSERT INTO Customers (Name) VALUES (@n)"
                  cmd.CommandText = "update [sales].[Invoices] set Paid = 1 where Id = @id"
                  cmd.CommandText = "DELETE FROM AuditLog WHERE CreatedOn < @limit"
                  cmd.CommandText = "MERGE INTO Stock AS s USING StockImport AS i ON s.Sku = i.Sku WHEN MATCHED THEN UPDATE SET s.Qty = i.Qty;"
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Writer" uses exactly the tables "AuditLog, Customers, Invoices, Stock, StockImport"

  @TS-003 @FR-001 @acceptance
  Scenario: SQL split across concatenated literals with line continuations
    Given a VB legacy project with the file "Reader.vb":
      """
      Namespace Sample
          Public Class Reader
              Public Function Query(ByVal id As Integer) As String
                  Dim sql As String = "SELECT p.Name, c.Name " & _
                                      "FROM Products p " + _
                                      "LEFT JOIN Categories c ON c.Id = p.CategoryId " & _
                                      "WHERE p.Id = " & id.ToString()
                  Return sql
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Reader" uses exactly the tables "Categories, Products"

  @TS-004 @FR-001 @validation
  Scenario: Variable parts of a concatenated statement never produce tables
    Given a VB legacy project with the file "Dynamic.vb":
      """
      Namespace Sample
          Public Class Dynamic
              Public Sub Run(ByVal tableName As String)
                  Dim a As String = "SELECT * FROM " & tableName
                  Dim b As String = "SELECT * FROM " & tableName & " t JOIN Regions r ON r.Id = t.RegionId"
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Dynamic" uses exactly the tables "Regions"

  @TS-005 @FR-004 @SC-003 @validation
  Scenario Outline: Literals that are not table-producing SQL
    Given a VB legacy project with a class "Sample.Messages" containing the string literal "<literal>"
    When the project is analyzed
    Then the component "Sample.Messages" uses no tables

    Examples:
      | literal                                  |
      | Select a customer from the list          |
      | Update the record set                    |
      | Insert into the box                      |
      | Delete from the list first               |
      | EXEC usp_PurgeCustomers                  |
      | SELECT * FROM #Staging                   |
      | SELECT * FROM @pending                   |
      | SELECT * FROM dbo.fnActiveCustomers(1)   |
      | C:\Reports\select from here.txt          |

  @TS-006 @FR-002 @acceptance
  Scenario: Table names are deduplicated without regard to case and keep the first spelling
    Given a VB legacy project with the file "Mixed.vb":
      """
      Namespace Sample
          Public Class Mixed
              Public Sub Run()
                  Dim a As String = "select * from customers"
                  Dim b As String = "SELECT Id FROM [CUSTOMERS] WHERE Id = 1"
                  Dim c As String = "select x.Id from Sales.dbo.Orders x"
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Mixed" uses exactly the tables "Orders, customers"

  @TS-007 @FR-003 @acceptance
  Scenario: Typed DataSet table adapters and typed tables resolve to database tables
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the component "LegacyShop.DataAccess.InvoiceAdapter" uses exactly the tables "InvoiceLines, Invoices"

  @TS-008 @FR-001 @FR-003 @SC-001 @SC-003 @acceptance
  Scenario: Every expected table of the synthetic desktop corpus is detected and nothing else
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the components using tables are exactly:
      | component                                | tables                      |
      | LegacyShop.DataAccess.CustomerDataAccess | AuditLog, Customers, Orders |
      | LegacyShop.DataAccess.InvoiceAdapter     | InvoiceLines, Invoices      |
      | LegacyShop.Modules.DbMaintenance         | TempImport                  |
      | LegacyShop.Reports.MonthlySalesReport    | Invoices                    |

  @TS-009 @FR-001 @SC-003 @acceptance
  Scenario: Every expected table of the synthetic web services corpus is detected and nothing else
    Given the synthetic VB project "SyntheticWebServices"
    When the project is analyzed
    Then the components using tables are exactly:
      | component                          | tables |
      | LegacyShop.Services.OrderService   | Orders |
