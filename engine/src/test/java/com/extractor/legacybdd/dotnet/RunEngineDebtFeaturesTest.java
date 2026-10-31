package com.extractor.legacybdd.dotnet;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectDirectories;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PUBLISH_QUIET_PROPERTY_NAME;

/**
 * Cucumber JVM runner for 014b-engine-debt (bugfix scenarios of the engine debt, e.g. BUG-008 file enumeration order),
 * with the 002 glue. Kept outside specs/002 so the imported specifications stay byte-identical (006 TS).
 */
@Suite(failIfNoTests = false)
@SuiteDisplayName("014b-engine-debt scenarios")
@IncludeEngines("cucumber")
@SelectDirectories("../specs/014b-engine-debt/tests/features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.extractor.legacybdd.dotnet")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME, value = "summary, json:target/cucumber-reports/engine-debt.json")
@ConfigurationParameter(key = PLUGIN_PUBLISH_QUIET_PROPERTY_NAME, value = "true")
public class RunEngineDebtFeaturesTest {
}
