# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-001 @US-002
Feature: The doctor lists exactly what the system is missing
  As a person installing dev-arch
  I want one command that checks every system dependency with its version and an install hint
  So that I do not discover missing tools in the middle of the build

  @TS-001 @FR-001 @FR-003 @FR-004 @FR-012 @SC-001 @P1 @acceptance @slow
  Scenario: The local diagnosis of the development machine has no failure
    When the doctor is run on this machine with "--mode local --json"
    Then the report has one check per local requirement of the definition
    And every check shows a detected version and a required version
    And no check has the status "FAIL"
    And the exit code is 0

  @TS-002 @FR-003 @FR-004 @FR-008 @SC-002 @P1 @acceptance
  Scenario Outline: A missing requirement is reported with the install hint of the operating system
    Given a simulated "<platform>" system where every requirement is satisfied
    And the requirement "<requirement>" is missing
    When the doctor runs in mode "<mode>"
    Then the check "<requirement>" has the status "<status>"
    And the check "<requirement>" suggests "<hint>"
    And every other check of the mode has the status "OK"

    Examples:
      | platform | mode   | requirement     | status | hint                                         |
      | darwin   | local  | jdk             | FAIL   | brew: brew install openjdk@17                |
      | linux    | local  | maven           | FAIL   | apt: sudo apt-get install -y maven           |
      | win32    | local  | dotnet-sdk      | FAIL   | winget: winget install Microsoft.DotNet.SDK.8 |
      | linux    | local  | dotnet-runtime  | FAIL   | apt: sudo apt-get install -y dotnet-runtime-8.0 |
      | win32    | local  | node            | FAIL   | choco: choco install nodejs-lts              |
      | darwin   | local  | engine-jar      | WARN   | brew: make build                             |
      | linux    | local  | dotnet-analyzer | WARN   | apt: make build                              |
      | win32    | local  | vs-build-tools  | WARN   | winget: winget install Microsoft.VisualStudio.2022.BuildTools |
      | darwin   | local  | docker          | WARN   | brew: brew install --cask docker             |
      | linux    | docker | docker          | FAIL   | apt: sudo apt-get install -y docker-ce docker-compose-plugin (https://docs.docker.com/engine/install/) |
      | darwin   | local  | env             | WARN   | brew: export GEMINI_API_KEY=<key>            |
      | linux    | docker | port            | WARN   | apt: ss -ltnp \| grep 9002                    |
      | win32    | local  | resources       | WARN   | winget: free disk space in %TEMP%            |

  @TS-003 @FR-003 @FR-004 @P1 @acceptance
  Scenario: A JDK older than 17 fails the diagnosis with a non-zero exit code
    Given a simulated "linux" system where every requirement is satisfied
    And the simulated "java -version" reports "11.0.21"
    When the doctor runs in mode "local"
    Then the check "jdk" has the status "FAIL"
    And the overall status is "FAIL" and the exit code is 1

  @TS-004 @FR-003 @FR-012 @SC-001 @P1 @acceptance
  Scenario: A newer .NET SDK with the .NET 8 runtime passes both .NET checks
    Given a simulated "darwin" system where every requirement is satisfied
    And the simulated .NET SDKs are "10.0.105" and the runtimes are "8.0.27, 10.0.5"
    When the doctor runs in mode "local"
    Then the check "dotnet-sdk" has the status "OK"
    And the check "dotnet-runtime" has the status "OK"

  @TS-005 @FR-003 @P1 @acceptance
  Scenario: A .NET SDK without any .NET 8 runtime fails the runtime check
    Given a simulated "linux" system where every requirement is satisfied
    And the simulated .NET SDKs are "10.0.105" and the runtimes are "10.0.5"
    When the doctor runs in mode "local"
    Then the check "dotnet-sdk" has the status "OK"
    And the check "dotnet-runtime" has the status "FAIL" with a detail mentioning "8"

  @TS-006 @FR-008 @P1 @acceptance
  Scenario: The fix option shows the install commands and never runs them
    Given a simulated "darwin" system where every requirement is satisfied
    And the requirement "jdk" is missing
    When the doctor command runs with "--fix"
    Then the output contains "Suggested commands (not executed)"
    And the output contains "brew install openjdk@17"
    And no simulated command other than the detection commands was executed

  @TS-007 @FR-001 @SC-003 @P1 @acceptance
  Scenario: The three entry points produce the same diagnosis
    When the doctor is run on this machine as "npm run doctor --" with "--json --only node,env,resources"
    And the doctor is run on this machine as "npx dev-arch doctor" with "--json --only node,env,resources"
    And the doctor is run on this machine as "make check-env DOCTOR_ARGS=" with "--json --only node,env,resources"
    Then the three reports have the same checks with the same statuses

  @TS-008 @FR-013 @P1 @contract
  Scenario: make doctor keeps its locked placeholder and check-env runs the doctor
    Given the product Makefile
    Then the target "doctor" still only prints "[doctor] not implemented yet (feature 012)"
    And the phony target "check-env" runs the doctor in mode "local"

  @TS-009 @FR-007 @P1 @contract
  Scenario: The JSON report has the documented structure
    Given a simulated "linux" system where every requirement is satisfied
    When the doctor command runs with "--json --mode local"
    Then the output is a JSON report with "tool", "version", "mode", "platform", "status", "checks" and "engine"
    And every check has "id", "name", "status", "detected", "required", "requiredFor", "detail" and "fix"

  @TS-010 @FR-005 @FR-006 @P1 @acceptance
  Scenario: The docker mode checks only the container prerequisites and fails without Docker
    Given a simulated "linux" system where every requirement is satisfied
    And the requirement "docker" is missing
    When the doctor runs in mode "docker"
    Then the checks are exactly "docker, env, port, resources"
    And the overall status is "FAIL" and the exit code is 1

  @TS-011 @FR-005 @P1 @acceptance
  Scenario: Docker missing in local mode is a warning that keeps the exit code at zero
    Given a simulated "darwin" system where every requirement is satisfied
    And the requirement "docker" is missing
    When the doctor runs in mode "local"
    Then the check "docker" has the status "WARN"
    And the overall status is "WARN" and the exit code is 0

  @TS-012 @FR-005 @P2 @acceptance
  Scenario: A stopped Docker daemon fails the docker mode
    Given a simulated "linux" system where every requirement is satisfied
    And the simulated Docker daemon is not reachable
    When the doctor runs in mode "docker"
    Then the check "docker" has the status "FAIL" with a detail mentioning "daemon"

  @TS-013 @FR-009 @P1 @acceptance
  Scenario Outline: Invalid arguments end with a usage error
    When the doctor is run on this machine with "<arguments>"
    Then the exit code is 64
    And the error output lists the options "--mode", "--json", "--fix" and "--only"

    Examples:
      | arguments          |
      | --mode cloud       |
      | --verbose          |
      | --only jdk,unknown |

  @TS-014 @FR-003 @P2 @acceptance
  Scenario: JAVA_HOME without a java binary fails the JDK check
    Given a simulated "linux" system where every requirement is satisfied
    And the simulated JAVA_HOME points to a folder without "bin/java"
    When the doctor runs in mode "local"
    Then the check "jdk" has the status "FAIL" with a detail mentioning "JAVA_HOME"

  @TS-015 @FR-003 @FR-016 @P2 @acceptance
  Scenario Outline: The engine archive is checked against the product version through the engine self-diagnosis
    Given a simulated "darwin" system where every requirement is satisfied
    And the simulated engine archive is "<archive>"
    When the doctor runs in mode "local"
    Then the check "engine-jar" has the status "<status>"

    Examples:
      | archive                         | status |
      | built at the product version    | OK     |
      | built at another version        | WARN   |
      | not answering the self-check    | WARN   |
      | not built                       | WARN   |
      | missing at ENGINE_JAR_PATH      | FAIL   |

  @TS-016 @FR-016 @P2 @acceptance
  Scenario: The analyzer located by the engine self-diagnosis is used and its version compared
    Given a simulated "linux" system where every requirement is satisfied
    And the simulated engine self-diagnosis locates the analyzer at "/opt/x/dotnet-analyzer" with version "1.2.0" in its manifest
    When the doctor runs in mode "local"
    Then the check "dotnet-analyzer" has the status "OK" with a detail mentioning "/opt/x/dotnet-analyzer"
    And the report includes the engine self-diagnosis

  @TS-017 @FR-003 @P2 @acceptance
  Scenario Outline: The port check accepts dev-arch itself and warns on another process
    Given a simulated "linux" system where every requirement is satisfied
    And the simulated port 9002 is "<state>"
    When the doctor runs in mode "docker"
    Then the check "port" has the status "<status>"

    Examples:
      | state                  | status |
      | free                   | OK     |
      | served by dev-arch     | OK     |
      | used by another process | WARN  |

  @TS-018 @FR-010 @FR-011 @P2 @contract
  Scenario: The doctor needs only Node and colors the human table on a terminal
    Given the doctor sources
    Then they import only Node built-in modules and other doctor modules
    And the product manifest declares the script "doctor" and the binary "dev-arch" pointing to the doctor
    And the human table colors the status only when color is enabled
