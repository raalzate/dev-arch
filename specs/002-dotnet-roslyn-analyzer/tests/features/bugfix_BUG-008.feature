@BUG-008
Feature: Bug fix for BUG-008 — file enumeration order independent of the file system
  Scenario: Loose C# sources analyzed from two directories with different creation order
    Given two directories with the same loose C# sources created in opposite order and no project file
    When both directories are analyzed with the .NET analyzer
    Then both dependency graphs are identical once the directory path is replaced
    And every file enumeration of the engine that feeds the analysis is sorted before use
