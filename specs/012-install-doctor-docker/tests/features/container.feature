# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-003
Feature: dev-arch runs with Docker only
  As a person who does not want to install a JDK, .NET and Node
  I want an all-in-one image and a Compose definition with a development profile
  So that I have a reproducible alternative installation route

  @TS-027 @FR-020 @P1 @contract
  Scenario: The image is built in stages and the final stage has only runtimes
    Given the product image definition
    Then it has the stages "engine", "analyzer", "web", "runtime" and "dev"
    And the stage "engine" builds from a Maven image with JDK 17
    And the stage "analyzer" builds from the .NET 8 SDK image for the target architecture
    And the stage "web" builds from a Node 20 image with the standalone output
    And the stage "runtime" starts from the .NET 8 runtime image and copies a JRE 17 and Node 20, without any SDK or build tool
    And the stage "runtime" runs as a non-root user, exposes 9002 and declares a health check on "/api/health"
    And every file the image copies from the build context exists in the product

  @TS-028 @FR-021 @FR-022 @P1 @contract
  Scenario: Compose declares only the default and dev profiles without provider configuration
    Given the product Compose definition
    Then its services are exactly "web" without profile and "web-dev" in the profile "dev"
    And no service declares another profile, a separate engine or an MCP network transport
    And the service "web" builds the target "runtime", publishes 9002, persists the analysis data in a named volume and limits its memory
    And the service "web" passes the optional variables "GEMINI_API_KEY", "GOOGLE_GENAI_API_KEY", "LLM_MODEL" and "JAVA_TOOL_OPTIONS"
    And the service "web-dev" builds the target "dev", mounts the product sources and publishes 9003
    And neither the image nor Compose contains configuration of a cloud provider

  @TS-029 @FR-023 @FR-024 @SC-004 @P1 @contract
  Scenario: A CI job builds, starts and smoke-tests the image and publishes it on tags
    Given the product continuous integration definition
    Then the job "docker" builds the image with Compose, starts it and runs the smoke test
    And the job "docker" runs on changes of the container or doctor files, on main and on "dev-arch-v*" tags
    And the job "docker" pushes the image to GHCR only on tags
    And the job "docker" is not an area job
    When a change touches only "apps/dev-arch/web/src/app/page.tsx"
    Then the triggered checks are exactly "web"

  @TS-030 @FR-023 @SC-004 @P1 @contract
  Scenario: The smoke test checks health, runs the doctor in docker mode and analyzes the Java demo
    Given the container smoke test script
    Then it waits for the container health status "healthy"
    And it runs the doctor with "--mode docker" and fails on a doctor failure
    And it submits "engine/test-for-demo/java-standar" to "/api/analyses" and requires a graph with components

  @TS-031 @FR-025 @P1 @validation
  Scenario: The product tests validate the image statically without Docker
    Given the step definitions and test scripts of this feature
    Then none of them runs the "docker" command
    And the build context ignore file of the image excludes "node_modules", "target", ".next" and "engine-dist"

  @TS-032 @FR-020 @P2 @contract
  Scenario: The standalone web output is only produced for the image
    Given the web build configuration
    Then the standalone output and the monorepo tracing root are enabled only when "NEXT_OUTPUT" is "standalone"
