package com.extractor.vblegacybdd;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectDirectories;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PUBLISH_QUIET_PROPERTY_NAME;

/**
 * Cucumber JVM runner for the engine scenarios ({@code @engine}) of 009-vb-legacy-completion (research D9).
 * The remaining 009 scenarios run with Reqnroll in {@code DotNetAnalyzer.Tests}.
 */
@Suite(failIfNoTests = false)
@SuiteDisplayName("009-vb-legacy-completion engine scenarios")
@IncludeEngines("cucumber")
@SelectDirectories("../specs/009-vb-legacy-completion/tests/features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.extractor.vblegacybdd")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@engine")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "summary, json:target/cucumber-reports/vb-legacy-completion.json")
@ConfigurationParameter(key = PLUGIN_PUBLISH_QUIET_PROPERTY_NAME, value = "true")
public class RunVbLegacyCompletionFeaturesTest {
}
