# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @US-2 @US-3 @US-4 @US-5 @P1
Feature: Extended static analysis of Visual Basic projects
  As an architect
  I want official analyzer rules, dead code, duplication, maintainability, SARIF import and layer suppressions
  So that the inventory reaches the level of a standard analyzer without external binaries

  @TS-001 @FR-010 @FR-011 @SC-001 @acceptance
  Scenario: Official analyzer rules of several categories with the closed issue types
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed
    Then the component "Acme.Extended.Rules.Rethrow" has a code issue "CA2200" whose message starts with "[reliability]"
    And the component "Acme.Extended.Rules.WeakHash" has a code issue "CA5351" whose message starts with "[security][CWE-327]"
    And the component "Acme.Extended.Rules.WeakHash" has exactly 1 code issue "CA5351"
    And the code issue "CA5351" of "Acme.Extended.Rules.WeakHash" has type "SECURITY"
    And the component "Acme.Extended.Rules.CatchAll" has a code issue "CA1031" whose message starts with "[design]"
    And the component "Acme.Extended.Rules.Culture" has a code issue "CA1305" whose message starts with "[globalization]"
    And the component "Acme.Extended.Rules.Wasteful" has a code issue "CA1806" whose message starts with "[performance]"
    And the code issue "CA1806" of "Acme.Extended.Rules.Wasteful" has type "PERFORMANCE"
    And the extended issues cover at least 5 distinct categories
    And every code issue has a type among "BUG_PATTERN, CODE_STYLE, SECURITY, PERFORMANCE"

  @TS-002 @FR-001 @acceptance
  Scenario: The extended pass is off on request
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "extended": "off" } }
      """
    Then no component has a code issue whose rule starts with "CA"
    And the component "Acme.Extended.Dead.Orphans" has no code issue "UNUSED_PUBLIC_MEMBER"
    And the component "Acme.Extended.Dup.CopyA" has no code issue "DUPLICATED_CODE"
    And the component "Acme.Extended.Rules.Rethrow" has no annotation starting with "Maintainability:"
    And the analysis log states that extended analysis is "off"

  @TS-003 @FR-001 @FR-010 @acceptance
  Scenario: An explicit rule list restricts the official rules
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "rules": ["CA2200"] } }
      """
    Then the component "Acme.Extended.Rules.Rethrow" has exactly 1 code issue "CA2200"
    And the component "Acme.Extended.Rules.WeakHash" has no code issue "CA5351"

  @TS-004 @FR-020 @SC-002 @acceptance
  Scenario: Unused public members are reported and used ones are not
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed
    Then the component "Acme.Extended.Dead.Orphans" has the code issues "UNUSED_PUBLIC_MEMBER" exactly at lines "6, 10"
    And the component "Acme.Extended.Dead.Helpers" has no code issue "UNUSED_PUBLIC_MEMBER"
    And the component "Acme.Extended.Forms.MainForm" has no code issue "UNUSED_PUBLIC_MEMBER"
    And the component "Acme.Extended.Program" has no code issue "UNUSED_PUBLIC_MEMBER"

  @TS-005 @FR-030 @SC-002 @acceptance
  Scenario: Duplicated methods across components are reported
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed
    Then the component "Acme.Extended.Dup.CopyA" has a code issue "DUPLICATED_CODE" with severity "WARNING" and message containing "Acme.Extended.Dup.CopyB"
    And the component "Acme.Extended.Dup.CopyB" has a code issue "DUPLICATED_CODE" with severity "WARNING" and message containing "Acme.Extended.Dup.CopyA"
    And the component "Acme.Extended.Dup.Unique" has no code issue "DUPLICATED_CODE"

  @TS-006 @FR-030 @acceptance
  Scenario: The duplication threshold is configurable
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "duplicateMinTokens": 400 } }
      """
    Then the component "Acme.Extended.Dup.CopyA" has no code issue "DUPLICATED_CODE"

  @TS-007 @FR-040 @acceptance
  Scenario: Maintainability index annotation
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed
    Then the component "Acme.Extended.Rules.Rethrow" has an annotation "Maintainability:<n>" with n between 0 and 100
    And the component "Acme.Extended.Dead.Orphans" has an annotation "Maintainability:<n>" with n between 0 and 100

  @TS-008 @FR-050 @SC-002 @acceptance
  Scenario: SARIF results are merged into the matching components
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "sarif": ["reports/sonar.sarif"] } }
      """
    Then the component "Acme.Extended.Rules.Rethrow" has exactly 1 code issue "S1234"
    And the component "Acme.Extended.Rules.Rethrow" has a code issue "S1234" whose message starts with "[source:SonarQube]"
    And the code issue "S1234" of "Acme.Extended.Rules.Rethrow" has type "BUG_PATTERN"
    And the component "Acme.Extended.Rules.WeakHash" has a code issue "S2070" whose message starts with "[source:SonarQube][CWE-328]"
    And the code issue "S2070" of "Acme.Extended.Rules.WeakHash" has type "SECURITY"
    And the analyzer reports a user warning starting with "SARIF reports/sonar.sarif: 1 result(s) without a matching component"

  @TS-009 @FR-050 @acceptance
  Scenario: A missing SARIF file is a warning, not a failure
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "sarif": ["reports/missing.sarif"] } }
      """
    Then the analyzer reports a user warning starting with "SARIF reports/missing.sarif: file not found"
    And the component "Acme.Extended.Rules.Rethrow" has a code issue "CA2200" whose message starts with "[reliability]"

  @TS-010 @FR-060 @acceptance
  Scenario: Layer suppressions remove rules for a fine layer only
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed with the configuration:
      """
      { "analysis": { "layerSuppressions": ["Presentación:UNUSED_PUBLIC_MEMBER", "Presentación:HIGH_CYCLOMATIC_COMPLEXITY"] } }
      """
    Then the component "Acme.Extended.Forms.BusyForm" has no code issue "HIGH_CYCLOMATIC_COMPLEXITY"
    And the component "Acme.Extended.Rules.BusyController" has exactly 1 code issue "HIGH_CYCLOMATIC_COMPLEXITY"

  @TS-011 @FR-070 @SC-003 @acceptance
  Scenario: C# projects are untouched by the extended pass
    Given the C# fixture project "SampleProject"
    When the project is analyzed
    Then no component has a code issue whose rule starts with "CA"
    And the analysis log states that extended analysis is "off (auto: C# compilation)"

  @TS-012 @FR-070 @FR-080 @SC-001 @acceptance
  Scenario: Golden output of the synthetic extended project
    Given the synthetic VB project "SyntheticExtended"
    When the project is analyzed twice
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "SyntheticExtended.golden.json"
    And both serialized outputs are byte-identical
    And the serialized output validates against the dependency-graph contract "1.0.0"

  @TS-013 @FR-080 @acceptance
  Scenario: The fixture ships its files and README
    Then the synthetic VB corpus contains the files:
      | path                                                 |
      | SyntheticExtended/SyntheticExtended.vbproj           |
      | SyntheticExtended/README.md                          |
      | SyntheticExtended/Rules/Rethrow.vb                   |
      | SyntheticExtended/Dead/Orphans.vb                    |
      | SyntheticExtended/Dup/CopyA.vb                       |
      | SyntheticExtended/reports/sonar.sarif                |
    And every synthetic VB project declares in its README that it is synthetic and fictitious

  @TS-014 @FR-010 @acceptance
  Scenario: End-of-life dependency issues use a type of the closed contract enum
    Given the synthetic VB project "SyntheticIntegrations"
    When the project is analyzed
    Then the code issue "EOL_DEPENDENCY" of "Acme.Integrations.Rules.NoIntegration" has type "SECURITY"
    And the serialized output validates against the dependency-graph contract "1.0.0"
