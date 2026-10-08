# DO NOT MODIFY SCENARIOS
# These .feature files define expected behavior derived from requirements.
# During implementation:
#   - Write step definitions to match these scenarios
#   - Fix code to pass tests, don't modify .feature files
#   - If requirements change, re-run /iikit-04-testify

@US-7 @P2
Feature: The .NET analyzer reports reduced-fidelity VB analyses
  As a user of the product
  I want the .NET analyzer to declare when a VB legacy project was analyzed with reduced fidelity
  So that the engine can warn me and I interpret the results correctly

  @TS-060 @FR-060 @FR-061 @FR-065 @SC-006 @acceptance
  Scenario: A legacy VB project opened without the framework reference assemblies
    Given the analysis host cannot load .NET Framework reference assemblies
    And the synthetic VB project "SyntheticDesktop"
    When the project is analyzed
    Then the analysis declares the source "roslyn-fallback"
    And the analyzer reports exactly the user warnings:
      """
      VB project 'SyntheticDesktop.vbproj' analyzed with reduced fidelity (Adhoc fallback: MSBuild with Visual Studio Build Tools and the VB workload is unavailable). .NET Framework types are unresolved; coupling to framework types and detections that need them may be incomplete. See docs/VB-LEGACY.md.
      """
    And no source file under "bin" or "obj" is part of any component

  @TS-061 @FR-060 @FR-061 @acceptance
  Scenario: A legacy VB project that MSBuild cannot open at all
    Given the analysis host cannot load .NET Framework reference assemblies
    And the VB fixture project "MinimalVbProject/Minimal.vbproj"
    When the project is analyzed
    Then the analysis declares the source "roslyn-fallback"
    And the analyzer reports exactly one user warning, starting with "VB project 'Minimal.vbproj' analyzed with reduced fidelity"
    And no user warning contains an absolute path

  @TS-062 @FR-061 @FR-082 @acceptance
  Scenario: User warnings are deterministic
    Given the analysis host cannot load .NET Framework reference assemblies
    And the synthetic VB project "SyntheticWebServices"
    When the project is analyzed twice
    Then both analyses report the same user warnings
    And the analyzer reports exactly one user warning, starting with "VB project 'SyntheticWebServices.vbproj' analyzed with reduced fidelity"
