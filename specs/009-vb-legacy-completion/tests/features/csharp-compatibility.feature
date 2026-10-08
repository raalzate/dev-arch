# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-8 @P1
Feature: C# analyses are unchanged by the VB legacy completion
  As a maintainer
  I want the outputs of existing C# projects to stay byte-identical and free of new warnings
  So that the VB work never regresses the public contract (Constitution I)

  @TS-070 @FR-080 @FR-042 @SC-004 @acceptance
  Scenario Outline: C# fixture outputs are byte-identical to the outputs captured before the feature
    Given the C# fixture project "<fixture>"
    When the project is analyzed
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "<golden>"

    Examples:
      | fixture          | golden                       |
      | SampleProject    | SampleProject.golden.json    |
      | CodeIssuesSample | CodeIssuesSample.golden.json |

  @TS-071 @FR-063 @SC-006 @acceptance
  Scenario Outline: C# analyses report no user warnings, including the reduced-fidelity C# load
    Given the <kind> "<project>"
    When the project is analyzed
    Then the analyzer reports no user warnings

    Examples:
      | kind               | project             |
      | C# fixture project | SampleProject       |
      | C# fixture project | CodeIssuesSample    |
      | C# demo project    | dotnet-unstructured |
