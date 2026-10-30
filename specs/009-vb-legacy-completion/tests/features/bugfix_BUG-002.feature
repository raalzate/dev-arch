@BUG-002
Feature: Bug fix for BUG-002 — SQL literal analysis bounded by size, never by wall-clock time
  As an architect
  I want the tables of a component to depend only on its source code
  So that two analyses of the same project are byte-identical on any machine (Constitution IV)

  Scenario: A SQL literal within the size bound is analyzed
    Given a VB legacy project with a class "Sample.Repository" whose method "Load" has a SQL literal of 8192 characters starting with "SELECT * FROM Customers WHERE Notes = '"
    When the project is analyzed twice
    Then the component "Sample.Repository" uses exactly the tables "Customers"
    And both serialized outputs are byte-identical

  Scenario: A SQL literal beyond the size bound is ignored deterministically
    Given a VB legacy project with a class "Sample.Repository" whose method "Load" has a SQL literal of 8193 characters starting with "SELECT * FROM Customers WHERE Notes = '"
    When the project is analyzed twice
    Then the component "Sample.Repository" uses no tables
    And the analysis log reports that a SQL literal of 8193 characters exceeds the bound of 8192 and was ignored
    And both serialized outputs are byte-identical

  Scenario: The parser has no regular-expression match timeout
    Then the SQL table parser builds its regular expressions without a match timeout
