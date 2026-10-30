# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-2 @P1
Feature: Desktop layers and entry points by evidence
  As an architect
  I want forms, controls, reports and batch processes recognized by inheritance, associated files or the project output type
  So that the proposal distinguishes user interface, reports, batch and business logic

  @TS-010 @FR-010 @FR-014 @acceptance
  Scenario: A form inheriting transitively from a third-party form base is Presentación
    Given a VB legacy project with the file "Forms.vb":
      """
      Namespace Sample
          Public Class BaseScreen
              Inherits DevExpress.XtraEditors.XtraForm
          End Class

          Public Class PolicyScreen
              Inherits BaseScreen
          End Class

          Public Class PolicyPanel
              Inherits DevExpress.XtraEditors.XtraUserControl
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.PolicyScreen" has the annotation "Layer:Presentación"
    And the component "Sample.PolicyScreen" is in layer "Web"
    And the component "Sample.PolicyPanel" has the annotation "Layer:Presentación"
    And the component "Sample.BaseScreen" has the annotation "Layer:Presentación"

  @TS-011 @FR-010 @acceptance
  Scenario: A class with a Designer sibling file is Presentación
    Given a VB legacy project with the file "SearchControl.vb":
      """
      Namespace Sample
          Partial Public Class SearchControl
              Public Sub Reset()
              End Sub
          End Class
      End Namespace
      """
    And the project file "SearchControl.Designer.vb":
      """
      <Global.Microsoft.VisualBasic.CompilerServices.DesignerGenerated()> _
      Partial Class SearchControl
          Inherits System.Windows.Forms.UserControl
          Private components As System.ComponentModel.IContainer
      End Class
      """
    When the project is analyzed
    Then the component "Sample.SearchControl" has the annotation "Layer:Presentación"
    And the component "Sample.SearchControl" is in layer "Web"

  @TS-012 @FR-011 @FR-014 @acceptance
  Scenario: Report classes are Reportes
    Given a VB legacy project with the file "Reports.vb":
      """
      Namespace Sample
          Public Class PolicyListing
              Inherits DataDynamics.ActiveReports.ActiveReport3
          End Class

          Public Class Statement
              Public Sub Render()
                  Dim viewer As New Microsoft.Reporting.WinForms.LocalReport()
              End Sub
          End Class
      End Namespace
      """
    And the project file "Statement.rdlc":
      """
      <Report xmlns="http://schemas.microsoft.com/sqlserver/reporting/2008/01/reportdefinition" />
      """
    When the project is analyzed
    Then the component "Sample.PolicyListing" has the annotation "Layer:Reportes"
    And the component "Sample.PolicyListing" is in layer "Web"
    And the component "Sample.Statement" has the annotation "Layer:Reportes"

  @TS-013 @FR-012 @FR-014 @acceptance
  Scenario: A module with Sub Main is a batch entry point
    Given a VB legacy project with the file "Program.vb":
      """
      Namespace Sample
          Module NightlyProcess
              Sub Main()
                  Console.WriteLine("running")
              End Sub
          End Module

          Module Helpers
              Public Function Twice(ByVal n As Integer) As Integer
                  Return n * 2
              End Function
          End Module
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.NightlyProcess" has the annotation "Layer:Batch"
    And the component "Sample.NightlyProcess" has the annotation "EntryPoint:Main"
    And the component "Sample.NightlyProcess" is in layer "Negocio"
    And the component "Sample.Helpers" has no annotation starting with "Layer:"
    And the component "Sample.Helpers" is in layer "Compartida"

  @TS-014 @FR-013 @acceptance
  Scenario: Validators are business logic
    Given a VB legacy project with the file "Validators.vb":
      """
      Namespace Sample
          Public Class PolicyValidator
              Public Function IsValid() As Boolean
                  Return True
              End Function
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.PolicyValidator" is in layer "Negocio"

  @TS-015 @FR-016 @FR-040 @SC-003 @acceptance
  Scenario Outline: Existing C# fixtures keep their golden output
    Given the C# fixture project "<fixture>"
    When the project is analyzed
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "<golden>"

    Examples:
      | fixture          | golden                       |
      | SampleProject    | SampleProject.golden.json    |
      | CodeIssuesSample | CodeIssuesSample.golden.json |
