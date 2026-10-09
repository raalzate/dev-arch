# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-009
Feature: Technology-specific AI documentation with a configurable provider
  As an architect
  I want the AI documentation to use the template of my technology and the provider chosen by the operator
  So that the document speaks the technical language of the analyzed system

  @TS-046 @FR-039 @P3 @acceptance
  Scenario Outline: The prompt template follows the technology
    Given the analysis output fixture "<fixture>"
    When the AI documentation prompt is prepared
    Then the template "<template>" is used

    Examples:
      | fixture          | template        |
      | java-standar     | java-spring-jee |
      | dotnet-ecommerce | aspnet-core     |
      | vb-synthetic     | vb-desktop      |

  @TS-047 @FR-039 @P3 @acceptance
  Scenario: A mixed C# and VB analysis uses the VB desktop template
    Given the analysis output fixture "dotnet-ecommerce" with one component file renamed from ".cs" to ".vb"
    When the AI documentation prompt is prepared
    Then the template "vb-desktop" is used

  @TS-048 @FR-040 @P3 @acceptance
  Scenario: Gemini is the default provider
    Given the server environment has no LLM_PROVIDER
    When the LLM provider is resolved
    Then the provider is "gemini"

  @TS-049 @FR-040 @P3 @acceptance
  Scenario: Anthropic is used when configured and its missing key is reported without secrets
    Given the server environment has LLM_PROVIDER "anthropic" and an ANTHROPIC_API_KEY
    When the LLM provider is resolved
    Then the provider is "anthropic"
    Given the server environment has LLM_PROVIDER "anthropic" and no ANTHROPIC_API_KEY
    When the LLM provider is resolved
    Then the resolution fails with a message naming "ANTHROPIC_API_KEY" and containing no key value

  @TS-050 @FR-040 @P3 @validation
  Scenario: An unknown provider is rejected with the allowed values
    Given the server environment has LLM_PROVIDER "openai"
    When the LLM provider is resolved
    Then the resolution fails with a message naming "openai", "gemini" and "anthropic"
