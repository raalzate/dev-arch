# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-1 @P1
Feature: Synthetic integrations corpus, goldens and documentation
  As a maintainer
  I want a redistributable fixture exercising every recognized integration and dependency form
  So that continuous integration guards the rules

  @TS-030 @FR-043 @SC-002 @acceptance
  Scenario: The synthetic integrations project declares its integrations and dependencies
    Given the synthetic VB project "SyntheticIntegrations"
    When the project is analyzed
    Then the component "Acme.Integrations.Clients.OfacGateway" has the annotation "Integration:wcf:Ofac"
    And the component "Acme.Integrations.Clients.OfacGateway" has the annotation "Integration:wcf:Ofac.IOfacService@ofac.example.invalid"
    And the component "Acme.Integrations.Clients.HolidayGateway" has the annotation "Integration:soap:Holiday"
    And the component "Acme.Integrations.Clients.PricingClient" has the annotation "Integration:wcf:IPricing"
    And the component "Acme.Integrations.Clients.LegacySoapClient" has the annotation "Integration:soap:LegacySoapClient"
    And the component "Acme.Integrations.Clients.RatesClient" has the annotation "Integration:rest:rates.example.invalid"
    And the component "Acme.Integrations.Clients.RatesClient" has the annotation "Integration:rest:BisiBaseURL"
    And the component "Acme.Integrations.Rules.NoIntegration" has no annotation starting with "Integration:"
    And the component "Acme.Integrations.Rules.NoIntegration" has exactly the external dependencies "Microsoft.Practices.EnterpriseLibrary.Data, Newtonsoft.Json, RestSharp, project:Acme.Billing"
    And the component "Acme.Integrations.Rules.NoIntegration" has exactly 1 code issue "EOL_DEPENDENCY"
    And the analyzer reports a user warning starting with "Referenced projects not included in the analyzed sources: Acme.Billing"
    And the analyzer reports a user warning starting with "Setup project(s) without support since Visual Studio 2010: Installer.vdproj"

  @TS-031 @FR-043 @FR-042 @SC-004 @acceptance
  Scenario: Golden output of the synthetic integrations project
    Given the synthetic VB project "SyntheticIntegrations"
    When the project is analyzed twice
    Then the serialized output, with the fixture root replaced by "<ROOT>", equals the golden file "SyntheticIntegrations.golden.json"
    And both serialized outputs are byte-identical

  @TS-032 @FR-043 @acceptance
  Scenario: The fixture ships its files and README
    Then the synthetic VB corpus contains the files:
      | project               | file                                   |
      | SyntheticIntegrations | SyntheticIntegrations.vbproj           |
      | SyntheticIntegrations | README.md                              |
      | SyntheticIntegrations | app.config                             |
      | SyntheticIntegrations | packages.config                        |
      | SyntheticIntegrations | Service References/Ofac/Ofac.svcmap    |
      | SyntheticIntegrations | Web References/Holiday/Reference.map   |
      | SyntheticIntegrations | Clients/RatesClient.vb                 |
      | SyntheticIntegrations | Setup/Installer.vdproj                 |

  @TS-033 @FR-044 @acceptance
  Scenario: The documentation describes the integrations, dependencies and configuration
    Then the product document "docs/VB-LEGACY.md" mentions each of:
      | text                       |
      | Integration:wcf            |
      | Integration:soap           |
      | Integration:rest           |
      | Dependency:eol             |
      | EOL_DEPENDENCY             |
      | eol-dependencies.json      |
      | integrations.outbound      |
      | dependencies.eol           |
      | Referenced projects not included |
    And the product document "engine/CONFIGURATION.md" mentions each of:
      | text                    |
      | integrations.outbound   |
      | dependencies.enabled    |
      | dependencies.eol        |
