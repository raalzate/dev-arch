package com.extractor.desktopbdd;

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
 * Cucumber JVM runner for the engine scenarios ({@code @engine}) of 021-desktop-identity-layers. Shares the
 * configuration, bridge and demo steps of 020 ({@code storedprocsbdd}).
 */
@Suite(failIfNoTests = false)
@SuiteDisplayName("021-desktop-identity-layers engine scenarios")
@IncludeEngines("cucumber")
@SelectDirectories("../specs/021-desktop-identity-layers/tests/features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.extractor.desktopbdd,com.extractor.storedprocsbdd")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@engine")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "summary, json:target/cucumber-reports/desktop-identity.json")
@ConfigurationParameter(key = PLUGIN_PUBLISH_QUIET_PROPERTY_NAME, value = "true")
public class RunDesktopIdentityFeaturesTest {
}
