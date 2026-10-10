# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify
@US-007
Feature: The local test command never validates a stale .NET analyzer
  As a developer
  I want the local tests to republish the .NET analyzer when its sources changed
  So that what passes locally is what gets published

  @TS-030 @FR-029 @SC-007 @P2 @acceptance
  Scenario Outline: The freshness decision of the published analyzer
    Given analyzer sources and <state>
    When the analyzer freshness check is executed <mode>
    Then the decision is "<decision>"

    Examples:
      | state                                                     | mode                | decision                                  |
      | a publication stamp newer than every source               | normally            | reuse                                     |
      | a publication stamp older than the file "Program.cs"      | normally            | rebuild: Program.cs is newer              |
      | a publication stamp older than the file "DotNetAnalyzer.csproj" | normally      | rebuild: DotNetAnalyzer.csproj is newer   |
      | a publication stamp older than a file under "obj"         | normally            | reuse                                     |
      | no publication stamp                                      | normally            | rebuild: missing                          |
      | a publication stamp newer than every source               | with the force flag | rebuild: forced                           |

  @TS-031 @FR-029 @FR-030 @SC-007 @P2 @contract
  Scenario: The product test and contract check scripts use the freshness decision
    Given the product test script
    Then the engine subset republishes the .NET analyzer when the freshness check does not answer "reuse"
    And it announces whether the analyzer was reused or rebuilt
    Given the contract check script
    Then it republishes its .NET analyzer when the freshness check does not answer "reuse" or when a rebuild is forced
