# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-3 @P1
Feature: Coupling, cohesion and complexity metrics for VB components
  As an architect
  I want VB components to carry the same quality metrics as C# components
  So that proposals and reports compare VB and C# on the same scale

  @TS-020 @FR-020 @FR-021 @acceptance
  Scenario: Coupling counts distinct project types and ignores system and unresolved types
    Given a VB legacy project with the file "Engine.vb":
      """
      Namespace Sample
          Public Class Engine
              Private _repo As Repository
              Public Function Run(ByVal input As Request) As String
                  Dim helper As New Formatter()
                  Dim conn As New SqlConnection()
                  Dim text As String = helper.Format(input)
                  _repo.Store(text)
                  Return text
              End Function
          End Class

          Public Class Repository
              Public Sub Store(ByVal value As String)
              End Sub
          End Class

          Public Class Request
          End Class

          Public Class Formatter
              Public Function Format(ByVal r As Request) As String
                  Return ""
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Engine" has cbo 3
    And the component "Sample.Formatter" has cbo 1
    And the component "Sample.Repository" has cbo 0

  @TS-021 @FR-020 @acceptance
  Scenario: Lack of cohesion uses the C# formula and case-insensitive field access
    Given a VB legacy project with the file "Counter.vb":
      """
      Namespace Sample
          Public Class Counter
              Private _total As Integer
              Private _name As String

              Public Sub Add(ByVal n As Integer)
                  _total = _total + n
              End Sub

              Public Function Describe() As String
                  Return _NAME & ":" & _Total.ToString()
              End Function

              Public Sub Reset()
              End Sub

              Public Shared Function Create() As Counter
                  Return New Counter()
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Counter" has lcom 0.75

  @TS-022 @FR-020 @acceptance
  Scenario: Cyclomatic complexity counts VB decision points
    Given a VB legacy project with the file "Grader.vb":
      """
      Namespace Sample
          Public Class Grader
              Public Function Grade(ByVal score As Integer, ByVal bonus As Boolean) As String
                  If score > 90 AndAlso bonus Then
                      Return "A+"
                  ElseIf score > 80 Then
                      Return "A"
                  End If
                  For i As Integer = 0 To 3
                      score = score + 1
                  Next
                  Select Case score
                      Case 1, 2
                          Return "low"
                      Case Else
                          Return If(bonus, "B", "C")
                  End Select
              End Function

              Public Sub Noop()
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Grader" has complexity max 8 and average 4.5

  @TS-023 @FR-022 @acceptance
  Scenario Outline: High cyclomatic complexity thresholds match C#
    Given a VB legacy project with a class "Sample.Branchy" whose method "Decide" has <ifs> single-line If statements
    When the project is analyzed
    Then the component "Sample.Branchy" has complexity max <cc> and average <cc>
    And the component "Sample.Branchy" has <count> code issue "HIGH_CYCLOMATIC_COMPLEXITY" with type "CODE_STYLE", severity "<severity>" and message "<message>"

    Examples:
      | ifs | cc | count | severity | message                                                |
      | 9   | 10 | 0     | -        | -                                                      |
      | 10  | 11 | 1     | WARNING  | Method 'Decide' cyclomatic complexity 11 exceeds 10    |
      | 15  | 16 | 1     | ERROR    | Method 'Decide' cyclomatic complexity 16 exceeds 15    |

  @TS-024 @FR-020 @acceptance
  Scenario: Modules have zero lack of cohesion and still report complexity
    Given a VB legacy project with the file "Tools.vb":
      """
      Namespace Sample
          Public Module Tools
              Private _cache As String
              Public Function Pick(ByVal a As Boolean) As String
                  If a Then Return _cache
                  Return ""
              End Function
              Public Sub Clear()
                  _cache = ""
              End Sub
          End Module
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Tools" has lcom 0
    And the component "Sample.Tools" has complexity max 2 and average 1.5

  @TS-025 @FR-020 @FR-021 @FR-022 @SC-001 @acceptance
  Scenario: Metrics of the synthetic desktop corpus
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the components have these metrics:
      | component                                | cbo | lcom | complexity_max | complexity_avg |
      | LegacyShop.Business.CustomerController   | 2   | 0    | 2              | 1.5            |
      | LegacyShop.DataAccess.CustomerDataAccess | 1   | 0.7  | 2              | 1.333          |
      | LegacyShop.DataAccess.InvoiceAdapter     | 0   | 1    | 4              | 2.5            |
      | LegacyShop.Reports.MonthlySalesReport    | 0   | 1    | 16             | 8.5            |
      | LegacyShop.Forms.CustomerForm            | 2   | 1    | 3              | 1.667          |
    And the component "LegacyShop.Reports.MonthlySalesReport" has a code issue "HIGH_CYCLOMATIC_COMPLEXITY" with severity "ERROR" and message "Method 'Build' cyclomatic complexity 16 exceeds 15"

  @TS-026 @FR-023 @acceptance
  Scenario: Lines of code of VB components are unchanged
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the component "LegacyShop.Business.CustomerController" has loc 15
