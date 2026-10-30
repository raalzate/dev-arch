@BUG-001
Feature: Bug fix for BUG-001 — a Roslyn operation-tree failure on one node must not drop the code issues of the type
  As an architect
  I want every detectable code issue of a VB type to be reported even when Roslyn cannot build the operation tree of one of its nodes
  So that a legacy constructor pattern does not silently hide the risks of the whole class

  Scenario: Implicit base constructor call with an optional parameter of an unresolved type
    Given a VB legacy project with the file "ContactBase.vb":
      """
      Namespace Sample
          Public Class ContactBase
              Public Property ContactType As Integer
              Protected _permissions As Int64

              Public Sub New(Optional ByVal permissions As Int64 = 0)
                  _permissions = permissions
              End Sub
          End Class
      End Namespace
      """
    And the project file "ContactCompany.vb":
      """
      Namespace Sample
          Public Class ContactCompany
              Inherits ContactBase

              Public Sub New()
                  Me.ContactType = 2
              End Sub

              Public Sub Export()
                  Dim fso = CreateObject("Scripting.FileSystemObject")
                  Try
                      fso.CreateFolder("C:\Export")
                  Catch ex As Exception
                  End Try
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.ContactCompany" has a code issue "LATE_BINDING" of type "BUG_PATTERN" with severity "WARNING" at line 10
    And the component "Sample.ContactCompany" has a code issue "EMPTY_CATCH_BLOCK" of type "BUG_PATTERN" with severity "WARNING" at line 13
    And the component "Sample.ContactCompany" has a code issue "CATCH_GENERIC_EXCEPTION" of type "BUG_PATTERN" with severity "INFO" at line 13
    And the analysis log does not report an error analyzing the type "Sample.ContactCompany"
