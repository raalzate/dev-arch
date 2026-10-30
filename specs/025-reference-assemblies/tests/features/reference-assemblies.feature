# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: .NET Framework reference assemblies for the Adhoc fallback
  As an analyst on macOS or Linux
  I want the VB Adhoc compilations to resolve .NET Framework types from a configured reference-assembly folder
  So that framework coupling and the rules that need those types work without Windows

  @TS-001 @FR-001 @FR-010 @SC-001 @acceptance
  Scenario: SQL command types resolve and the security rule fires
    Given the synthetic VB project "SyntheticExtended"
    And the .NET Framework 4.8 reference assemblies of the test host
    When the project is analyzed with the configuration using the reference assemblies:
      """
      { "analysis": { "extended": "on", "referenceAssemblies": "<REFS>" } }
      """
    Then the component "Acme.Extended.Rules.SqlQuery" has a code issue "CA2100" whose message starts with "[security][CWE-89]"
    And the code issue "CA2100" of "Acme.Extended.Rules.SqlQuery" has type "SECURITY"
    And the analysis log contains "reference assemblies from"

  @TS-002 @FR-020 @acceptance
  Scenario: Without the folder the host runtime assemblies are used and the rule cannot fire
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "extended": "on" } }
      """
    Then the component "Acme.Extended.Rules.SqlQuery" has no code issue "CA2100"
    And the analysis log does not contain "reference assemblies from"

  @TS-003 @FR-011 @acceptance
  Scenario: A missing folder is a warning, not a failure
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "referenceAssemblies": "no/such/folder" } }
      """
    Then the analyzer reports a user warning starting with "Reference assemblies directory not found: no/such/folder"
    And the component "Acme.Extended.Rules.SqlQuery" has loc 12

  @TS-004 @FR-010 @SC-001 @acceptance
  Scenario: Double run with reference assemblies is byte-identical
    Given the synthetic VB project "SyntheticExtended"
    And the .NET Framework 4.8 reference assemblies of the test host
    When the project is analyzed twice with the configuration using the reference assemblies:
      """
      { "analysis": { "extended": "on", "referenceAssemblies": "<REFS>" } }
      """
    Then both serialized outputs are byte-identical
    And the serialized output validates against the dependency-graph contract "1.0.0"
