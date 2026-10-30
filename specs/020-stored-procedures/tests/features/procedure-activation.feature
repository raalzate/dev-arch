# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-4 @P2
Feature: Stored procedure detection is enabled only where it applies
  As the product owner
  I want detection on by default for VB sources and off for C# unless configured
  So that no existing output changes and a C# legacy project can still opt in

  @TS-030 @FR-030 @FR-032 @acceptance
  Scenario: VB projects detect procedures without configuration
    Given a VB legacy project with the file "Adapter.vb":
      """
      Namespace Sample
          Public Class Adapter
              Public Sub Read(ByVal db As Object)
                  Dim cmd = db.GetStoredProcCommand("usp_Read")
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed
    Then the component "Sample.Adapter" uses exactly the tables "sp:usp_Read"
    And the analysis log states that stored procedure detection is "on" for "Visual Basic" because of "auto"

  @TS-031 @FR-030 @FR-031 @FR-032 @SC-004 @acceptance
  Scenario: C# projects do not detect procedures without configuration
    Given a C# legacy project with the file "Adapter.cs":
      """
      namespace Sample
      {
          public class Adapter
          {
              public void Read(dynamic db)
              {
                  var cmd = db.GetStoredProcCommand("usp_Read");
              }
          }
      }
      """
    When the project is analyzed
    Then the component "Sample.Adapter" uses no tables
    And the analysis log states that stored procedure detection is "off" for "C#" because of "auto"

  @TS-032 @FR-007 @FR-030 @acceptance
  Scenario: C# projects detect procedures when enabled by configuration
    Given a C# legacy project with the file "Adapter.cs":
      """
      namespace Sample
      {
          public class Adapter
          {
              public void Read(dynamic db, dynamic cmd, dynamic conn)
              {
                  var a = db.GetStoredProcCommand("usp_Policy_Read");
                  var ds = db.ExecuteDataSet(db, "usp_" + "Policy_List");
                  cmd.CommandType = CommandType.StoredProcedure;
                  cmd.CommandText = "dbo.usp_Policy_Save";
                  var rows = conn.Query<object>("usp_Policy_Rows", commandType: CommandType.StoredProcedure);
                  var other = db.GetStoredProcCommand(string.Format("usp_{0}", "x"));
              }
          }
      }
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedures": "on" } }
      """
    Then the component "Sample.Adapter" uses exactly the tables "sp:usp_Policy_List, sp:usp_Policy_Read, sp:usp_Policy_Rows, sp:usp_Policy_Save"
    And the analyzer reports exactly the user warnings:
      """
      Procedure name is not a literal in Sample.Adapter (Adapter.cs:12)
      """
    And the analysis log states that stored procedure detection is "on" for "C#" because of "config"

  @TS-033 @FR-030 @acceptance
  Scenario: VB projects can disable detection by configuration
    Given a VB legacy project with the file "Adapter.vb":
      """
      Namespace Sample
          Public Class Adapter
              Public Sub Read(ByVal db As Object, ByVal cmd As Object)
                  Dim c = db.GetStoredProcCommand("usp_Read")
                  cmd.CommandText = "SELECT * FROM Customers"
              End Sub
          End Class
      End Namespace
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedures": "off" } }
      """
    Then the component "Sample.Adapter" uses exactly the tables "Customers"
    And the analysis log states that stored procedure detection is "off" for "Visual Basic" because of "config"

  @TS-034 @FR-030 @validation
  Scenario: An invalid configuration file is rejected with an error
    Given a VB legacy project with the file "Adapter.vb":
      """
      Namespace Sample
          Public Class Adapter
          End Class
      End Namespace
      """
    When the analyzer is run with the configuration:
      """
      { "dataAccess": { "procedures": "sometimes" } }
      """
    Then the analyzer exits with code 1
    And the analyzer error output contains "invalid --config"
