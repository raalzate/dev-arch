# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001
Feature: Results coherent with the analyzed technology
  As an architect modernizing a legacy system
  I want the interface to identify the technology and show only meaningful, non-empty sections
  So that I never have to interpret zero counters of concepts that do not exist in my technology

  @TS-001 @FR-001 @FR-001a @FR-002 @P1 @acceptance
  Scenario Outline: The technology profile is derived from the analysis origin and file languages
    Given the analysis output fixture "<fixture>"
    When its technology profile is computed
    Then the technology is "<technology>" with the label "<label>"

    Examples:
      | fixture          | technology | label      |
      | java-standar     | java       | Java       |
      | dotnet-ecommerce | csharp     | .NET · C#  |
      | vb-synthetic     | vb         | VB.NET     |

  @TS-002 @FR-001a @P1 @acceptance
  Scenario: A .NET analysis with C# and VB components is mixed
    Given the analysis output fixture "dotnet-ecommerce" with one component file renamed from ".cs" to ".vb"
    When its technology profile is computed
    Then the technology is "dotnet-mixed" with the label ".NET · C# + VB"

  @TS-003 @FR-003 @FR-005 @SC-001 @P1 @acceptance
  Scenario Outline: A .NET analysis has no Java-only section
    Given the analysis output fixture "<fixture>"
    When the sections of every step are resolved
    Then no visible section and no "Sin hallazgos" entry has an identifier starting with "java-"

    Examples:
      | fixture          |
      | dotnet-ecommerce |
      | vb-synthetic     |

  @TS-004 @FR-003 @FR-005 @SC-001 @P1 @acceptance
  Scenario: A Java analysis has no .NET-only section
    Given the analysis output fixture "java-standar"
    When the sections of every step are resolved
    Then no visible section and no "Sin hallazgos" entry has an identifier starting with "csharp-", "vb-" or "dotnet-"

  @TS-005 @FR-003 @FR-004 @SC-002 @P1 @acceptance
  Scenario Outline: Visible sections are never empty and empty applicable sections are summarized
    Given the analysis output fixture "<fixture>"
    When the sections of every step are resolved
    Then every visible section has at least one item
    And every applicable section without items is absent from the visible sections and named in the "Sin hallazgos" entries of its step

    Examples:
      | fixture          |
      | java-standar     |
      | dotnet-ecommerce |
      | vb-synthetic     |

  @TS-006 @FR-005 @FR-006 @P1 @acceptance
  Scenario: A VB desktop analysis shows the VB sections with desktop layer names
    Given the analysis output fixture "vb-synthetic"
    When the sections of every step are resolved
    Then the visible sections include "vb-desktop-ui", "vb-legacy-risks", "dotnet-app-config" and "data-access"
    And the layer "Web" is labeled "Presentación (formularios y reportes)"
    And the layer "Compartida" is labeled "Módulos compartidos"

  @TS-007 @FR-007 @P1 @acceptance
  Scenario: A reduced-fidelity origin is flagged
    Given the analysis output fixture "vb-synthetic"
    When its technology profile is computed
    Then the profile is marked as reduced fidelity

  @TS-008 @FR-002 @FR-003 @FR-005 @SC-001 @SC-002 @SC-003 @P1 @acceptance @e2e @slow
  Scenario: A C# analysis in the browser shows no Java-only and no empty section
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "dotnet-ecommerce" and the analysis completes
    And the user visits every step of the flow
    Then the technology badge reads ".NET · C#"
    And no step shows a section whose identifier starts with "java-"
    And no step shows the text "EJB" or "@Deprecated"
    And every section shown in any step declares at least one item

  @TS-009 @FR-002 @FR-005 @FR-006 @FR-007 @SC-001 @SC-002 @SC-003 @P1 @acceptance @e2e @slow
  Scenario: A VB desktop analysis in the browser shows the VB sections and the reduced fidelity warning
    Given the product is built with the .NET analyzer staged next to the engine
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the VB synthetic desktop project and the analysis completes
    And the user visits every step of the flow
    Then the technology badge reads "VB.NET"
    And the summary shows the reduced fidelity warning
    And the findings step shows the sections "vb-desktop-ui" and "vb-legacy-risks"
    And no step shows a section whose identifier starts with "java-"
    And every section shown in any step declares at least one item

  @TS-010 @FR-002 @FR-005 @SC-001 @SC-002 @SC-003 @P1 @acceptance @e2e @slow
  Scenario: A Java analysis in the browser shows no .NET-only section
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user visits every step of the flow
    Then the technology badge reads "Java"
    And no step shows a section whose identifier starts with "csharp-", "vb-" or "dotnet-"
    And every section shown in any step declares at least one item
