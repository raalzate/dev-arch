package com.extractor.legacyinferencebdd;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectDirectories;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PUBLISH_QUIET_PROPERTY_NAME;

/** Cucumber JVM runner for the engine scenarios ({@code @engine}) of 023-legacy-desktop-inference. */
@Suite(failIfNoTests = false)
@SuiteDisplayName("023-legacy-desktop-inference engine scenarios")
@IncludeEngines("cucumber")
@SelectDirectories("../specs/023-legacy-desktop-inference/tests/features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
        value = "com.extractor.legacyinferencebdd,com.extractor.storedprocsbdd")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@engine")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "summary, json:target/cucumber-reports/legacy-inference.json")
@ConfigurationParameter(key = PLUGIN_PUBLISH_QUIET_PROPERTY_NAME, value = "true")
public class RunLegacyInferenceFeaturesTest {
}
