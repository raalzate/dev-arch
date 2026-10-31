# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-4 @P2
Feature: Legacy debt rules
  As an architect
  I want deterministic, syntactic detection of the platform's typical debt patterns
  So that the viability can weigh debt and refactorings can be prioritized

  @TS-040 @FR-031 @acceptance
  Scenario: UI calls outside the presentation layer
    Given a VB legacy project with the file "Mixed.vb":
      """
      Namespace Sample
          Public Class PolicyController
              Public Sub Save()
                  MsgBox("Saved")
                  MessageBox.Show("Done")
              End Sub
          End Class

          Public Class PolicyScreen
              Inherits System.Windows.Forms.Form
              Public Sub Notify()
                  MsgBox("Hello")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.PolicyController" has the code issues "UI_CALL_IN_BUSINESS_LAYER" exactly at lines "4, 5"
    And every "UI_CALL_IN_BUSINESS_LAYER" issue of the component "Sample.PolicyController" has type "BUG_PATTERN" and severity "WARNING"
    And the component "Sample.PolicyScreen" has no code issue "UI_CALL_IN_BUSINESS_LAYER"

  @TS-041 @FR-032 @acceptance
  Scenario: SQL built by concatenating variables
    Given a VB legacy project with the file "Sql.vb":
      """
      Namespace Sample
          Public Class Unsafe
              Public Sub Load(ByVal cmd As Object, ByVal db As Object, ByVal id As String)
                  cmd.CommandText = "SELECT * FROM Policies WHERE Id = " & id
                  Dim c = db.GetSqlStringCommand("DELETE FROM Policies WHERE Id = '" & id & "'")
              End Sub
          End Class

          Public Class Safe
              Public Sub Load(ByVal cmd As Object)
                  cmd.CommandText = "SELECT * FROM Policies WHERE Id = @id"
                  cmd.CommandText = "SELECT * " & "FROM Policies"
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Unsafe" has the code issues "SQL_CONCAT_INJECTION" exactly at lines "4, 5"
    And every "SQL_CONCAT_INJECTION" issue of the component "Sample.Unsafe" has type "SECURITY" and severity "CRITICAL"
    And the component "Sample.Safe" has no code issue "SQL_CONCAT_INJECTION"

  @TS-042 @FR-033 @acceptance
  Scenario: Static facades with mutable shared state
    Given a VB legacy project with the file "Facades.vb":
      """
      Namespace Sample
          Public Class PolicyFacade
              Private Shared _cache As Integer = 0
              Public Shared Function Read() As Integer
                  Return _cache
              End Function
              Public Shared Sub Reset()
                  _cache = 0
              End Sub
          End Class

          Public Class Constants
              Public Shared ReadOnly Limit As Integer = 10
              Public Shared Function Max() As Integer
                  Return Limit
              End Function
          End Class

          Public Class Service
              Private Shared _count As Integer
              Public Sub Work()
              End Sub
          End Class

          Module Helpers
              Public Shared _state As Integer
          End Module
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.PolicyFacade" has a code issue "STATIC_FACADE" of type "CODE_STYLE" with severity "INFO" at line 2
    And the component "Sample.Constants" has no code issue "STATIC_FACADE"
    And the component "Sample.Service" has no code issue "STATIC_FACADE"
    And the component "Sample.Helpers" has no code issue "STATIC_FACADE"

  @TS-043 @FR-034 @acceptance
  Scenario: Mixed transaction models in one component
    Given a VB legacy project with the file "Tx.vb":
      """
      Namespace Sample
          Public Class MixedRepo
              Public Sub Save(ByVal cn As Object)
                  Dim tx = cn.BeginTransaction()
                  Using scope As New System.Transactions.TransactionScope()
                  End Using
              End Sub
          End Class

          Public Class SingleRepo
              Public Sub Save(ByVal cn As Object)
                  Dim tx = cn.BeginTransaction()
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.MixedRepo" has a code issue "MIXED_TRANSACTION_MODELS" of type "BUG_PATTERN" with severity "WARNING" at line 5
    And the component "Sample.SingleRepo" has no code issue "MIXED_TRANSACTION_MODELS"

  @TS-044 @FR-035 @acceptance
  Scenario: God classes above both configurable thresholds
    Given a VB legacy project with a class "Sample.Branchy" whose method "Decide" has 6 single-line If statements
    When the project is analyzed with the configuration:
      """
      { "debt": { "godClass": { "minLoc": 5, "minComplexity": 5 } } }
      """
    Then the component "Sample.Branchy" has a code issue "GOD_CLASS" with severity "WARNING" and message "Type 'Branchy' has 11 lines of code and a maximum method complexity of 7 (thresholds 5 and 5). Split it by responsibility."
    When the project is analyzed with the configuration:
      """
      { "debt": { "godClass": { "minLoc": 50, "minComplexity": 5 } } }
      """
    Then the component "Sample.Branchy" has no code issue "GOD_CLASS"

  @TS-045 @FR-030 @FR-040 @acceptance
  Scenario: The rules are disabled by configuration and off for C# by default
    Given a VB legacy project with the file "Mixed.vb":
      """
      Namespace Sample
          Public Class PolicyController
              Public Sub Save()
                  MsgBox("Saved")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed with the configuration:
      """
      { "debt": { "enabled": "off" } }
      """
    Then the component "Sample.PolicyController" has none of the code issues "UI_CALL_IN_BUSINESS_LAYER, SQL_CONCAT_INJECTION, STATIC_FACADE, MIXED_TRANSACTION_MODELS, GOD_CLASS, PROJECT_OPTION_STRICT_OFF"
    And the analysis log states that legacy debt rules are "off" for "Visual Basic" because of "config"

  @TS-046 @FR-030 @acceptance
  Scenario: C# projects run the rules only when enabled
    Given a C# legacy project with the file "Facade.cs":
      """
      namespace Sample
      {
          public class PolicyController
          {
              public void Save() { System.Windows.Forms.MessageBox.Show("Saved"); }
          }
      }
      """
    When the project is analyzed
    Then the component "Sample.PolicyController" has no code issue "UI_CALL_IN_BUSINESS_LAYER"
    And the analysis log states that legacy debt rules are "off" for "C#" because of "auto"

  @TS-047 @FR-036 @FR-041 @SC-004 @acceptance
  Scenario: Two runs produce identical issues
    Given a VB legacy project with the file "Mixed.vb":
      """
      Namespace Sample
          Public Class PolicyController
              Public Sub Save(ByVal cmd As Object, ByVal id As String)
                  MsgBox("Saved")
                  cmd.CommandText = "SELECT * FROM Policies WHERE Id = " & id
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed twice
    Then both serialized outputs are byte-identical
    And the code issues of every component are ordered by location and rule
