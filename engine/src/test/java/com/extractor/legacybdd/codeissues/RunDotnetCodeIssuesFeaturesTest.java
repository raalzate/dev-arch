package com.extractor.legacybdd.codeissues;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectDirectories;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PUBLISH_QUIET_PROPERTY_NAME;

/**
 * Cucumber JVM runner for the hash-locked scenarios of 003-dotnet-code-issues (bug pattern detection, CodeIssue
 * schema/pipeline and graceful degradation of the .NET analyzer).
 * <p>
 * The scenarios run the real {@code dotnet-analyzer} on generated C# projects (see {@link CodeIssuesFixtures});
 * they are skipped with a {@code requires-dotnet} reason when the analyzer is unavailable or reported absent
 * ({@code -Dlegacybdd.analyzer=absent}).
 */
@Suite(failIfNoTests = false)
@SuiteDisplayName("003-dotnet-code-issues BDD scenarios")
@IncludeEngines("cucumber")
@SelectDirectories("../specs/003-dotnet-code-issues/tests/features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.extractor.legacybdd.codeissues")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "summary, json:target/cucumber-reports/legacy-003.json")
@ConfigurationParameter(key = PLUGIN_PUBLISH_QUIET_PROPERTY_NAME, value = "true")
// Exclusions (011 FR-033) come only from specs/011-quality-delivery/legacy-exclusions.md, applied by ExclusionHooks.
public class RunDotnetCodeIssuesFeaturesTest {
}
