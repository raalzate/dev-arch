# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-005
Feature: Header with top spacing and a product icon
  As a person using the web
  I want breathing room above the header and a recognizable icon
  So that the application looks finished and is easy to find among tabs

  @TS-029 @FR-024 @US-005 @P3 @contract
  Scenario: The web declares its own tab icon
    Given the web application sources
    Then the application declares an SVG tab icon
    And the generic favicon is no longer shipped

  @TS-030 @FR-023 @FR-024 @FR-025 @US-005 @P3 @contract
  Scenario: The header has top spacing, shows the brand mark and stays hidden in print
    Given the application shell source
    Then the header has top padding
    And the header shows the brand mark before the product name
    And the header is hidden when printing

  @TS-031 @FR-023 @FR-024 @SC-007 @US-005 @P3 @acceptance @e2e
  Scenario Outline: The header shows the icon with space above in every theme and width
    Given the web open in the browser with the theme "<theme>" at a width of <width> pixels
    Then the brand mark is visible in the header
    And the top of the header content is at least 8 pixels below the top of the window
    And the page has no horizontal scroll
    And the document declares the dev-arch tab icon

    Examples:
      | theme | width |
      | light | 1280  |
      | dark  | 1280  |
      | light | 390   |
      | dark  | 390   |

  @TS-032 @FR-005 @SC-003 @US-005 @P2 @acceptance @e2e
  Scenario: The analysis link opens that analysis in the web
    Given a completed analysis in the web
    When the browser opens the link "/?analysis=<id>" of that analysis
    Then the web shows the summary of that analysis
