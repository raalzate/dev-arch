# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-004
Feature: Source viewer restricted to the analysis project
  As a dev-arch user and operator
  I want to open the source of a component and nothing else
  So that the viewer cannot be used to read arbitrary server files

  Background:
    Given the web server is running with a stub engine
    And a completed analysis of a ZIP whose entries are "demo/src/App.java" and "demo/pom.xml"

  @TS-034 @FR-017 @FR-019 @P1 @acceptance
  Scenario: A component file is served by its path relative to the project root
    When the source "src/App.java" of that analysis is requested
    Then the response status is 200
    And the content equals the content of the entry "demo/src/App.java"

  @TS-035 @FR-018 @SC-006 @P1 @contract
  Scenario Outline: Paths that escape the project root are rejected without content
    Given the project of that analysis contains a symbolic link "src/link-out.java" pointing outside the project
    When the source "<path>" of that analysis is requested
    Then the response status is <status> with error code "<code>"
    And the response contains no file content

    Examples:
      | path                            | status | code         |
      | /etc/passwd                     | 400    | INVALID_PATH |
      | ../../../../etc/passwd          | 400    | INVALID_PATH |
      | %2e%2e/%2e%2e/etc/passwd        | 400    | INVALID_PATH |
      | src\..\..\pom.xml               | 400    | INVALID_PATH |
      | src/App.java%00.txt             | 400    | INVALID_PATH |
      | C:/Windows/win.ini              | 400    | INVALID_PATH |
      | src/link-out.java               | 404    | NOT_FOUND    |

  @TS-036 @FR-018 @SC-006 @P1 @contract
  Scenario: A file that only exists in another analysis is not served
    Given another completed analysis whose project contains "src/Other.java"
    When the source "src/Other.java" of the first analysis is requested
    Then the response status is 404 with error code "NOT_FOUND"

  @TS-037 @FR-018 @SC-006 @P1 @contract
  Scenario Outline: Directories, missing files, disallowed extensions and oversized files are rejected
    Given the web server source view limit is 1 KB
    And the project of that analysis contains "<fixture>"
    When the source "<path>" of that analysis is requested
    Then the response status is <status> with error code "<code>"

    Examples:
      | fixture                         | path              | status | code                  |
      | a directory "src/pkg"           | src/pkg           | 404    | NOT_FOUND             |
      | nothing else                    | src/Missing.java  | 404    | NOT_FOUND             |
      | a file ".env"                   | .env              | 400    | EXTENSION_NOT_ALLOWED |
      | a file "lib/app.jar"            | lib/app.jar       | 400    | EXTENSION_NOT_ALLOWED |
      | a 2 KB file "src/Big.java"      | src/Big.java      | 413    | FILE_TOO_LARGE        |

  @TS-038 @FR-018 @P1 @contract
  Scenario: The legacy absolute-path form of the viewer is rejected
    When the source viewer is called with only the path "/etc/passwd" and no analysis identifier
    Then the response status is 400 with error code "INVALID_PATH"

  @TS-039 @FR-019 @P2 @acceptance @e2e @slow
  Scenario: The user opens the source of a component from the results
    Given the product is built
    And the web is running
    And a browser session is open on the web
    When the user uploads the ZIP of the demo project "java-standar" and the analysis completes
    And the user opens the source code of a component
    Then the viewer shows the content of that component's file
