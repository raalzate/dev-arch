# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-2 @P1
Feature: Code issues characteristic of VB legacy code
  As an architect
  I want the risk patterns of VB legacy code and the general patterns already reported for C# to be detected
  So that I can estimate the risk of extracting each component

  @TS-010 @FR-010 @FR-015 @SC-002 @acceptance
  Scenario: On Error Resume Next
    Given a VB legacy project with the file "Legacy.vb":
      """
      Namespace Sample
          Public Class Legacy
              Public Sub Run()
                  On Error Resume Next
                  Dim x As Integer = 1
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Legacy" has a code issue "ON_ERROR_RESUME_NEXT" of type "BUG_PATTERN" with severity "WARNING" at line 4

  @TS-011 @FR-011 @SC-002 @acceptance
  Scenario: Option Strict Off is reported on every component declared in the file
    Given a VB legacy project with the file "Loose.vb":
      """
      Option Strict Off
      Option Explicit On

      Namespace Sample
          Public Class First
          End Class

          Public Module Second
          End Module
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.First" has a code issue "OPTION_STRICT_OFF" of type "CODE_STYLE" with severity "WARNING" at line 1
    And the component "Sample.Second" has a code issue "OPTION_STRICT_OFF" of type "CODE_STYLE" with severity "WARNING" at line 1

  @TS-012 @FR-012 @SC-002 @acceptance
  Scenario: GoTo statement
    Given a VB legacy project with the file "Jumper.vb":
      """
      Namespace Sample
          Public Class Jumper
              Public Sub Run(ByVal n As Integer)
      Again:
                  n = n - 1
                  If n > 0 Then GoTo Again
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Jumper" has a code issue "GOTO_STATEMENT" of type "CODE_STYLE" with severity "INFO" at line 6

  @TS-013 @FR-013 @SC-002 @acceptance
  Scenario: Late binding is reported once per affected line
    Given a VB legacy project with the file "Automation.vb":
      """
      Namespace Sample
          Public Class Automation
              Public Sub Export()
                  Dim app As Object = CreateObject("Excel.Application")
                  app.Visible = True
                  app.Workbooks.Add().Sheets(1).Name = "Data"
                  Dim known As String = "abc"
                  Dim size As Integer = known.Length
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Automation" has the code issues "LATE_BINDING" exactly at lines "4, 5, 6"
    And every "LATE_BINDING" issue of the component "Sample.Automation" has type "BUG_PATTERN" and severity "WARNING"

  @TS-014 @FR-014 @SC-002 @acceptance
  Scenario: Empty catch block
    Given a VB legacy project with the file "Swallow.vb":
      """
      Namespace Sample
          Public Class Swallow
              Public Sub Run()
                  Try
                      Dim x As Integer = 1
                  Catch ex As System.IO.IOException
                  End Try
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Swallow" has a code issue "EMPTY_CATCH_BLOCK" of type "BUG_PATTERN" with severity "WARNING" at line 6
    And the component "Sample.Swallow" has no code issue "CATCH_GENERIC_EXCEPTION"

  @TS-015 @FR-014 @SC-002 @acceptance
  Scenario: Catching the generic exception
    Given a VB legacy project with the file "Broad.vb":
      """
      Namespace Sample
          Public Class Broad
              Public Function Run() As Integer
                  Try
                      Return 1
                  Catch ex As Exception
                      Return 0
                  End Try
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Broad" has a code issue "CATCH_GENERIC_EXCEPTION" of type "BUG_PATTERN" with severity "INFO" at line 6
    And the component "Sample.Broad" has no code issue "EMPTY_CATCH_BLOCK"

  @TS-016 @FR-014 @SC-002 @acceptance
  Scenario: Select Case without Case Else
    Given a VB legacy project with the file "Picker.vb":
      """
      Namespace Sample
          Public Class Picker
              Public Function Name(ByVal code As Integer) As String
                  Select Case code
                      Case 1
                          Return "one"
                  End Select
                  Return ""
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Picker" has a code issue "MISSING_SWITCH_DEFAULT" of type "BUG_PATTERN" with severity "INFO" at line 4

  @TS-017 @FR-014 @FR-033 @SC-002 @acceptance
  Scenario: Hard-coded secret in a declaration marks the component as sensitive
    Given a VB legacy project with the file "Settings.vb":
      """
      Namespace Sample
          Public Class Settings
              Private Const ApiPassword As String = "Synthetic-Secret-1"
              Private ReadOnly _label As String = "visible"
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Settings" has a code issue "HARDCODED_SECRET_IN_CODE" of type "BUG_PATTERN" with severity "CRITICAL" at line 3
    And the component "Sample.Settings" has exactly 1 code issue "HARDCODED_SECRET_IN_CODE"
    And the component "Sample.Settings" is marked as handling sensitive data
    And the serialized output does not contain "Synthetic-Secret-1"

  @TS-018 @FR-010 @FR-011 @FR-012 @FR-013 @FR-014 @SC-002 @validation
  Scenario: Clean VB code produces none of the VB or general issues
    Given a VB legacy project with the file "Clean.vb":
      """
      Option Strict On

      Namespace Sample
          Public Class Clean
              Public Function Run(ByVal code As Integer) As String
                  On Error GoTo Handler
                  Dim text As String = "abc"
                  Select Case code
                      Case 1
                          Return text.ToUpper()
                      Case Else
                          Return text
                  End Select
                  Exit Function
      Handler:
                  Return ""
              End Function

              Public Function Safe() As Integer
                  Try
                      Return 1
                  Catch ex As System.IO.IOException
                      Return 2
                  End Try
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Clean" has none of the code issues "ON_ERROR_RESUME_NEXT, OPTION_STRICT_OFF, GOTO_STATEMENT, LATE_BINDING, EMPTY_CATCH_BLOCK, CATCH_GENERIC_EXCEPTION, MISSING_SWITCH_DEFAULT, HARDCODED_SECRET_IN_CODE"
    And the component "Sample.Clean" is not marked as handling sensitive data

  @TS-019 @FR-010 @FR-011 @FR-012 @FR-013 @FR-014 @FR-022 @FR-033 @SC-001 @acceptance
  Scenario: Issues of the synthetic desktop corpus
    Given the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the components have exactly these code issue counts:
      | component                                | rule                        | count |
      | LegacyShop.Forms.CustomerForm            | OPTION_STRICT_OFF           | 1     |
      | LegacyShop.Forms.CustomerForm            | ON_ERROR_RESUME_NEXT        | 1     |
      | LegacyShop.Forms.CustomerForm            | LATE_BINDING                | 3     |
      | LegacyShop.Forms.CustomerForm            | MISSING_SWITCH_DEFAULT      | 1     |
      | LegacyShop.Modules.AppGlobals            | GOTO_STATEMENT              | 1     |
      | LegacyShop.Modules.AppGlobals            | HARDCODED_SECRET_IN_CODE    | 1     |
      | LegacyShop.Modules.AppGlobals            | PLAINTEXT_SECRET_IN_CONFIG  | 1     |
      | LegacyShop.DataAccess.CustomerDataAccess | CATCH_GENERIC_EXCEPTION     | 1     |
      | LegacyShop.DataAccess.CustomerDataAccess | EMPTY_CATCH_BLOCK           | 1     |
      | LegacyShop.DataAccess.CustomerDataAccess | PLAINTEXT_SECRET_IN_CONFIG  | 1     |
      | LegacyShop.Modules.DbMaintenance         | PLAINTEXT_SECRET_IN_CONFIG  | 1     |
      | LegacyShop.Reports.MonthlySalesReport    | HIGH_CYCLOMATIC_COMPLEXITY  | 1     |
    And the code issues of every component are ordered by location and rule
