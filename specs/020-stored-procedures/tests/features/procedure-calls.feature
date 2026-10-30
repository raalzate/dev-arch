# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: Stored procedures invoked by .NET legacy components
  As an architect evaluating a .NET legacy monolith
  I want each component to list the stored procedures it invokes, prefixed so they are distinct from tables
  So that the microservice proposal can group components by the procedures they share without a database schema

  @TS-001 @FR-001 @FR-005 @SC-001 @acceptance
  Scenario: Enterprise Library GetStoredProcCommand with a literal name
    Given a VB legacy project with the file "PolicyAdapter.vb":
      """
      Namespace Sample
          Public Class PolicyAdapter
              Public Sub Read(ByVal db As Object)
                  Dim cmd = db.GetStoredProcCommand("usp_Policy_Read")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.PolicyAdapter" uses exactly the tables "sp:usp_Policy_Read"

  @TS-002 @FR-002 @FR-005 @SC-001 @acceptance
  Scenario: ADO.NET command of type StoredProcedure with a literal CommandText
    Given a VB legacy project with the file "ClaimAdapter.vb":
      """
      Namespace Sample
          Public Class ClaimAdapter
              Public Sub Save(ByVal cmd As Object)
                  cmd.CommandType = CommandType.StoredProcedure
                  cmd.CommandText = "usp_Claim_Save"
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.ClaimAdapter" uses exactly the tables "sp:usp_Claim_Save"

  @TS-003 @FR-003 @FR-005 @SC-001 @acceptance
  Scenario: Enterprise Library execution methods with the procedure name as second argument
    Given a VB legacy project with the file "ReportAdapter.vb":
      """
      Namespace Sample
          Public Class ReportAdapter
              Public Sub Run(ByVal db As Object)
                  Dim ds = db.ExecuteDataSet(db, "usp_Report_List")
                  db.ExecuteNonQuery(db, "usp_Report_Purge", 30)
                  Dim n = db.ExecuteScalar(db, "usp_Report_Count")
                  Dim r = db.ExecuteReader(db, "usp_Report_Rows")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.ReportAdapter" uses exactly the tables "sp:usp_Report_Count, sp:usp_Report_List, sp:usp_Report_Purge, sp:usp_Report_Rows"

  @TS-004 @FR-004 @FR-005 @SC-001 @acceptance
  Scenario: Dapper query with commandType StoredProcedure
    Given a VB legacy project with the file "DapperAdapter.vb":
      """
      Namespace Sample
          Public Class DapperAdapter
              Public Sub Load(ByVal conn As Object)
                  Dim rows = conn.Query(Of Object)("usp_Customer_List", commandType:=CommandType.StoredProcedure)
                  conn.Execute("usp_Customer_Touch", New With {.Id = 1}, commandType:=CommandType.StoredProcedure)
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.DapperAdapter" uses exactly the tables "sp:usp_Customer_List, sp:usp_Customer_Touch"

  @TS-005 @FR-001 @FR-005 @acceptance
  Scenario: Procedure name split across concatenated literals with line continuations
    Given a VB legacy project with the file "SplitAdapter.vb":
      """
      Namespace Sample
          Public Class SplitAdapter
              Public Sub Read(ByVal db As Object)
                  Dim cmd = db.GetStoredProcCommand("usp_" & _
                                                    "Policy_" + _
                                                    "History")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.SplitAdapter" uses exactly the tables "sp:usp_Policy_History"

  @TS-006 @FR-005 @acceptance
  Scenario: Schema and delimiters are dropped from the canonical name
    Given a VB legacy project with the file "QualifiedAdapter.vb":
      """
      Namespace Sample
          Public Class QualifiedAdapter
              Public Sub Read(ByVal db As Object)
                  Dim a = db.GetStoredProcCommand("[dbo].[usp_Policy_Read]")
                  Dim b = db.GetStoredProcCommand("dbo.usp_Policy_Update")
                  Dim c = db.GetStoredProcCommand("""usp_Policy_Delete""")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.QualifiedAdapter" uses exactly the tables "sp:usp_Policy_Delete, sp:usp_Policy_Read, sp:usp_Policy_Update"

  @TS-007 @FR-006 @SC-007 @acceptance
  Scenario: A non-literal procedure name produces a warning and no procedure
    Given a VB legacy project with the file "DynamicAdapter.vb":
      """
      Namespace Sample
          Public Class DynamicAdapter
              Public Sub Read(ByVal db As Object, ByVal name As String)
                  Dim cmd = db.GetStoredProcCommand(name)
                  Dim other = db.GetStoredProcCommand(String.Format("usp_{0}", name))
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.DynamicAdapter" uses no tables
    And the analyzer reports exactly these procedure warnings:
      """
      Procedure name is not a literal in Sample.DynamicAdapter (DynamicAdapter.vb:4)
      Procedure name is not a literal in Sample.DynamicAdapter (DynamicAdapter.vb:5)
      """
    And no user warning contains an absolute path

  @TS-008 @FR-005 @acceptance
  Scenario: Repeated procedures and literal SQL in the same component are deduplicated and ordered
    Given a VB legacy project with the file "MixedAdapter.vb":
      """
      Namespace Sample
          Public Class MixedAdapter
              Public Sub Work(ByVal db As Object, ByVal cmd As Object)
                  Dim a = db.GetStoredProcCommand("usp_Policy_Read")
                  Dim b = db.GetStoredProcCommand("USP_POLICY_READ")
                  cmd.CommandText = "SELECT Id FROM Policies WHERE Active = 1"
                  Dim c = db.GetStoredProcCommand("usp_Policy_Read")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.MixedAdapter" uses exactly the tables "Policies, sp:usp_Policy_Read"

  @TS-009 @FR-008 @acceptance
  Scenario: A text command is literal SQL, not a procedure
    Given a VB legacy project with the file "TextAdapter.vb":
      """
      Namespace Sample
          Public Class TextAdapter
              Public Sub Read(ByVal cmd As Object)
                  cmd.CommandType = CommandType.Text
                  cmd.CommandText = "SELECT * FROM Customers"
                  Dim reader = cmd.ExecuteReader()
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.TextAdapter" uses exactly the tables "Customers"

  @TS-010 @FR-007 @FR-031 @SC-004 @acceptance
  Scenario Outline: Existing C# fixtures keep their golden output
    Given the C# fixture project "<fixture>"
    When the project is analyzed
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "<golden>"

    Examples:
      | fixture          | golden                       |
      | SampleProject    | SampleProject.golden.json    |
      | CodeIssuesSample | CodeIssuesSample.golden.json |
