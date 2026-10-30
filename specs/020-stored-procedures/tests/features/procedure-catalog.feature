# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-2 @P1
Feature: Procedures translated to tables with a catalog
  As an architect who has the database scripts or a dependency export
  I want each sp: entry translated to the tables the procedure reads or writes
  So that the proposal is based on the real data model

  Background:
    Given a VB legacy project with the file "PolicyAdapter.vb":
      """
      Namespace Sample
          Public Class PolicyAdapter
              Public Sub Read(ByVal db As Object)
                  Dim a = db.GetStoredProcCommand("usp_Policy_Read")
                  Dim b = db.GetStoredProcCommand("[dbo].[usp_Policy_Archive]")
                  Dim c = db.GetStoredProcCommand("usp_Unknown")
              End Sub
          End Class
      End Namespace
      """

  @TS-011 @FR-010 @FR-011 @FR-014 @SC-003 @acceptance
  Scenario: Script catalog complements the procedures with their tables
    Given the procedure catalog directory "Catalog/procs" with the script "policy.sql":
      """
      CREATE PROCEDURE [dbo].[usp_Policy_Read] @Id INT AS
      BEGIN
          SELECT p.Id, h.Name FROM dbo.Policies p INNER JOIN PolicyHolders h ON h.Id = p.HolderId WHERE p.Id = @Id;
      END
      GO
      CREATE OR ALTER PROCEDURE dbo.usp_Policy_Archive @Id INT AS
      BEGIN
          INSERT INTO PolicyArchive SELECT * FROM Policies WHERE Id = @Id;
          DELETE FROM Policies WHERE Id = @Id;
          EXEC dbo.usp_Audit_Write @Id;
      END
      GO
      ALTER PROC usp_Audit_Write @Id INT AS
          INSERT INTO AuditLog (PolicyId) VALUES (@Id);
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs" } }
      """
    Then the component "Sample.PolicyAdapter" uses exactly the tables "AuditLog, Policies, PolicyArchive, PolicyHolders, sp:usp_Policy_Archive, sp:usp_Policy_Read, sp:usp_Unknown"
    And the analyzer reports exactly the user warnings:
      """
      Procedure catalog 'procs': 1 procedure(s) not found: usp_unknown
      """

  @TS-012 @FR-010 @FR-012 @SC-003 @acceptance
  Scenario: CSV catalog is equivalent to the script catalog
    Given the procedure catalog file "Catalog/procs.csv":
      """
      procedimiento,tabla,operación
      dbo.usp_Policy_Read,Policies,SELECT
      dbo.usp_Policy_Read,PolicyHolders,SELECT
      "[dbo].[usp_Policy_Archive]","PolicyArchive",INSERT
      USP_POLICY_ARCHIVE,Policies,DELETE
      usp_Policy_Archive,AuditLog,INSERT
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs.csv" } }
      """
    Then the component "Sample.PolicyAdapter" uses exactly the tables "AuditLog, Policies, PolicyArchive, PolicyHolders, sp:usp_Policy_Archive, sp:usp_Policy_Read, sp:usp_Unknown"

  @TS-013 @FR-014 @FR-015 @acceptance
  Scenario: Replace mode keeps sp: only for unresolved procedures
    Given the procedure catalog file "Catalog/procs.csv":
      """
      procedure,table,operation
      usp_Policy_Read,Policies,SELECT
      usp_Policy_Archive,PolicyArchive,INSERT
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs.csv", "catalogMode": "replace" } }
      """
    Then the component "Sample.PolicyAdapter" uses exactly the tables "Policies, PolicyArchive, sp:usp_Unknown"

  @TS-014 @FR-013 @acceptance
  Scenario: Duplicate definitions resolve to the lowest ordinal path and warn
    Given the procedure catalog directory "Catalog/procs" with the script "a_policy.sql":
      """
      CREATE PROCEDURE usp_Policy_Read AS SELECT * FROM Policies
      """
    And the procedure catalog directory "Catalog/procs" with the script "b_policy.sql":
      """
      CREATE PROCEDURE usp_Policy_Read AS SELECT * FROM PoliciesLegacy
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs", "catalogMode": "replace" } }
      """
    Then the component "Sample.PolicyAdapter" uses exactly the tables "Policies, sp:usp_Policy_Archive, sp:usp_Unknown"
    And the analyzer reports exactly the user warnings:
      """
      Procedure catalog 'procs': 2 procedure(s) not found: usp_policy_archive, usp_unknown
      Procedure catalog 'procs': duplicate definition of usp_policy_read in b_policy.sql; a_policy.sql used
      """

  @TS-015 @FR-016 @acceptance
  Scenario: A missing catalog path degrades to sp: with a warning
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/missing" } }
      """
    Then the component "Sample.PolicyAdapter" uses exactly the tables "sp:usp_Policy_Archive, sp:usp_Policy_Read, sp:usp_Unknown"
    And the analyzer reports exactly one user warning, starting with "Procedure catalog 'missing' not loaded: path not found"
    And no user warning contains an absolute path

  @TS-016 @FR-016 @acceptance
  Scenario: A CSV without the required header is rejected with a warning
    Given the procedure catalog file "Catalog/bad.csv":
      """
      name,object
      usp_Policy_Read,Policies
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/bad.csv" } }
      """
    Then the component "Sample.PolicyAdapter" uses exactly the tables "sp:usp_Policy_Archive, sp:usp_Policy_Read, sp:usp_Unknown"
    And the analyzer reports exactly one user warning, starting with "Procedure catalog 'bad.csv' not loaded: CSV header must be"

  @TS-017 @FR-011 @acceptance
  Scenario: Transitive EXEC resolution terminates on cycles without duplicating tables
    Given the procedure catalog directory "Catalog/procs" with the script "cycle.sql":
      """
      CREATE PROCEDURE usp_Policy_Read AS
          SELECT * FROM Policies
          EXEC usp_Policy_Archive
      GO
      CREATE PROCEDURE usp_Policy_Archive AS
          INSERT INTO PolicyArchive SELECT * FROM Policies
          EXECUTE usp_Policy_Read
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs", "catalogMode": "replace" } }
      """
    Then the component "Sample.PolicyAdapter" uses exactly the tables "Policies, PolicyArchive, sp:usp_Unknown"

  @TS-018 @FR-050 @SC-005 @acceptance
  Scenario: Two runs with a catalog are byte-identical
    Given the procedure catalog file "Catalog/procs.csv":
      """
      procedure,table,operation
      usp_Policy_Read,Policies,SELECT
      """
    When the project is analyzed twice with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs.csv" } }
      """
    Then both serialized outputs are byte-identical
    And both analyses report the same user warnings

  @TS-019 @FR-017 @SC-007 @acceptance
  Scenario: The output never contains catalog bodies or absolute paths
    Given the procedure catalog directory "Catalog/procs" with the script "secret.sql":
      """
      CREATE PROCEDURE usp_Policy_Read AS
          -- password=hunter2
          SELECT * FROM Policies WHERE Token = 'abc123secret'
      """
    When the project is analyzed with the configuration:
      """
      { "dataAccess": { "procedureCatalog": "Catalog/procs" } }
      """
    Then the serialized output does not contain "hunter2"
    And the serialized output does not contain "abc123secret"
    And no user warning contains an absolute path
