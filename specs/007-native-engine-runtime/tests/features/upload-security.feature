# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-003
Feature: Safe and bounded project uploads
  As the operator of a dev-arch instance
  I want no upload to write outside its area, exhaust the disk or overload the server
  So that the web can be exposed beyond the developer machine

  @TS-023 @FR-013 @SC-005 @P1 @contract
  Scenario: An upload above the size limit is rejected before processing
    Given the web server is running with an upload limit of 1 MB
    When a ZIP of 2 MB is submitted for analysis
    Then the response status is 413 with error code "UPLOAD_TOO_LARGE"
    And the error reports the limit in bytes
    And no file of that submission remains on disk

  @TS-024 @FR-014 @SC-005 @P1 @contract
  Scenario Outline: A ZIP with an entry escaping the extraction area is rejected entirely
    Given the web server is running with a stub engine
    When a ZIP whose entries are "src/App.java" and "<entry>" is submitted for analysis
    Then the response status is 400 with error code "<code>"
    And the error names the entry "<entry>"
    And no file was written outside the analysis area
    And no analysis area remains for that submission

    Examples:
      | entry                  | code                   |
      | ../../evil.txt         | ZIP_ENTRY_OUTSIDE_ROOT |
      | a/../../evil.txt       | ZIP_ENTRY_OUTSIDE_ROOT |
      | /tmp/evil.txt          | ZIP_ENTRY_OUTSIDE_ROOT |
      | C:/evil.txt            | ZIP_ENTRY_OUTSIDE_ROOT |
      | dir\..\..\evil.txt     | ZIP_ENTRY_OUTSIDE_ROOT |
      | link-to-etc (symlink)  | ZIP_SYMLINK            |

  @TS-025 @FR-015 @SC-005 @P1 @contract
  Scenario Outline: A ZIP above the decompression limits is rejected
    Given the web server is running with an uncompressed limit of 10 MB and an entry limit of 100
    When a ZIP with <entries> entries and <size> MB uncompressed is submitted for analysis
    Then the response status is <status> with error code "<code>"
    And the error reports the exceeded limit

    Examples:
      | entries | size | status | code                    |
      | 5       | 20   | 413    | UNCOMPRESSED_TOO_LARGE  |
      | 150     | 1    | 400    | ZIP_TOO_MANY_ENTRIES    |

  @TS-026 @FR-015 @SC-005 @P2 @validation
  Scenario: A ZIP that understates its uncompressed size fails during extraction
    Given the web server is running with an uncompressed limit of 10 MB and an entry limit of 100
    When a ZIP that declares 1 MB but expands to 20 MB is submitted for analysis
    Then the analysis ends with status "failed" and error code "UNCOMPRESSED_TOO_LARGE"
    And its analysis area no longer contains extracted files

  @TS-027 @FR-016 @SC-005 @P1 @contract
  Scenario: A file that is not a ZIP is rejected
    Given the web server is running with a stub engine
    When a plain text file is submitted for analysis
    Then the response status is 400 with error code "INVALID_ZIP"
    And no file of that submission remains on disk

  @TS-028 @FR-016 @P2 @validation
  Scenario: Security rejections are logged without file contents
    Given the web server is running with a stub engine
    When a ZIP whose entries are "src/App.java" and "../../evil.txt" is submitted for analysis
    Then the server log records the rejection with the reason "ZIP_ENTRY_OUTSIDE_ROOT" and the entry "../../evil.txt"
    And the server log does not contain the contents of any entry

  @TS-029 @FR-014 @P2 @validation
  Scenario Outline: Duplicate or case-colliding entries are rejected deterministically
    Given the web server is running with a stub engine
    When a ZIP whose entries are "<first>" and "<second>" is submitted for analysis
    Then the response status is 400 with error code "ZIP_DUPLICATE_ENTRY"

    Examples:
      | first        | second       |
      | src/App.java | src/App.java |
      | src/App.java | src/app.java |

  @TS-086 @FR-037 @SC-015 @P2 @validation
  Scenario: A disk that fills up while storing the upload rejects the submission without leftovers
    Given the web server is running with a stub engine and a disk that fills up while storing the upload
    When the ZIP of the demo project "java-standar" is submitted for analysis
    Then the response status is 507 with error code "STORAGE_FULL"
    And no file of that submission remains on disk

  @TS-087 @FR-037 @SC-015 @P2 @validation
  Scenario Outline: A disk that fills up during the analysis fails it and removes partial files
    Given the web server is running with a stub engine and a disk that fills up while <stage>
    When the ZIP of the demo project "java-standar" is submitted for analysis
    Then the analysis ends with status "failed" and error code "STORAGE_FULL"
    And the failure message mentions "disk space" without a stack trace
    And its analysis area contains no extracted sources and no partial result documents

    Examples:
      | stage                   |
      | extracting the project  |
      | writing the results     |

  @TS-030 @FR-011 @P1 @contract
  Scenario: Submissions beyond the running quota and the queue are rejected before upload
    Given the web server is running with 1 concurrent analysis, a queue of 1 and a stub engine that takes 30 seconds per analysis
    When three analyses are submitted one after another
    Then the first analysis is "running" and the second is "queued"
    And the third submission is rejected with status 429, error code "TOO_MANY_ANALYSES" and a retry delay
    And the body of the third submission was not stored

  @TS-031 @FR-011 @P1 @acceptance
  Scenario: A queued analysis starts when a slot is released
    Given the web server is running with 1 concurrent analysis, a queue of 1 and a stub engine that takes 2 seconds per analysis
    When two analyses are submitted one after another
    Then the second analysis is "queued" while the first runs
    And both analyses complete

  @TS-032 @FR-012 @SC-011 @P1 @acceptance
  Scenario: Expired analyses are removed by the periodic cleanup
    Given the web server is running with a retention of 1 hour and a controllable clock
    And a completed analysis that finished 2 hours ago
    And a failed analysis that finished 2 hours ago
    When the periodic cleanup runs
    Then the areas of both analyses no longer exist on disk
    And requesting their status answers 404 with error code "NOT_FOUND"

  @TS-033 @FR-012 @P1 @validation
  Scenario: Active analyses never expire
    Given the web server is running with a retention of 1 hour and a controllable clock
    And an analysis that has been running for 2 hours
    When the periodic cleanup runs
    Then that analysis and its area still exist
