# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-006
Feature: Detect nested and multi-module projects
  As a user who uploads a repository whose Java or .NET project is not at the root folder
  I want the engine to optionally look for project markers in subfolders
  So that the right analyzer is chosen and I am told which modules were found

  @TS-033 @FR-023 @SC-010 @US-006 @P3 @acceptance
  Scenario Outline: The default depth keeps the current detection of the demo projects
    When the project type of the demo project "<project>" is detected with the default configuration
    Then the detected type is "<type>"
    And no nested-marker warning is reported

    Examples:
      | project                 | type   |
      | java-standar            | JAVA   |
      | jee-architecture-master | JAVA   |
      | legacy-erp              | JAVA   |
      | dotnet-ecommerce        | DOTNET |
      | dotnet-legacy-clinic    | DOTNET |
      | dotnet-unstructured     | UNKNOWN |

  @TS-034 @FR-023 @FR-024 @SC-010 @US-006 @P3 @acceptance
  Scenario Outline: Nested markers are found within the configured depth
    Given a project folder without root markers containing <markers>
    When its project type is detected with "detection.maxDepth" = <depth>
    Then the detected type is "<type>"
    And the nested-marker warning lists "<modules>"

    Examples:
      | markers                                            | depth | type   | modules                  |
      | "backend/pom.xml" and "backend/core/pom.xml"       | 2     | JAVA   | backend, backend/core    |
      | "src/App/App.csproj" and "src/App.sln"             | 2     | DOTNET | src, src/App             |
      | "legacy/Forms/Forms.vbproj"                        | 2     | DOTNET | legacy/Forms             |

  @TS-035 @FR-024 @SC-010 @US-006 @P3 @validation
  Scenario: Markers of both languages in subfolders are ambiguous
    Given a project folder without root markers containing "api/pom.xml" and "ui/Ui.csproj"
    When its project type is detected with "detection.maxDepth" = 1
    Then the detection fails with a message containing "Ambiguous project type"
    And the message lists "api" and "ui"

  @TS-036 @FR-023 @FR-024 @SC-010 @US-006 @P3 @validation
  Scenario Outline: Markers that are too deep, ignored or below the default depth are not used
    Given a project folder without root markers containing <markers>
    When its project type is detected with "detection.maxDepth" = <depth>
    Then the detected type is "UNKNOWN"
    And no nested-marker warning is reported

    Examples:
      | markers                                   | depth |
      | "a/b/c/pom.xml"                           | 2     |
      | "target/pom.xml" and "node_modules/x/X.csproj" | 3 |
      | "backend/pom.xml"                         | 0     |

  @TS-037 @FR-024 @US-006 @P3 @validation
  Scenario: Root markers win over nested markers
    Given a project folder with a root "pom.xml" and a nested "tools/Tool.csproj"
    When its project type is detected with "detection.maxDepth" = 3
    Then the detected type is "JAVA"
    And no nested-marker warning is reported

  @TS-048 @FR-024 @US-006 @P3 @acceptance
  Scenario: The unstructured .NET demo is detected as .NET with a nested search
    When the project type of the demo project "dotnet-unstructured" is detected with "detection.maxDepth" = 1
    Then the detected type is "DOTNET"
    And the nested-marker warning lists "Api"

  @TS-038 @FR-024 @US-006 @P3 @acceptance
  Scenario: A nested Java project is analyzed with the Java analyzer and the modules are reported
    Given a copy of the demo project "java-standar" moved into the subfolder "backend" of an empty folder
    When that folder is analyzed with the analyze_project tool with the inline configuration {"detection": {"maxDepth": 1}}
    Then the analysis succeeds with at least one component
    And the response warnings contain "Nested project markers found (java): backend"
