package com.extractor.runtimebdd;

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
 * Cucumber JVM runner for the engine scenarios ({@code @engine}) of 007-native-engine-runtime (research D12).
 * The remaining 007 scenarios run with Cucumber-JS ({@code cucumber.mjs} excludes {@code @engine}).
 */
@Suite(failIfNoTests = false)
@SuiteDisplayName("007-native-engine-runtime engine scenarios")
@IncludeEngines("cucumber")
@SelectDirectories("../specs/007-native-engine-runtime/tests/features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME, value = "com.extractor.runtimebdd")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@engine")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "summary, json:target/cucumber-reports/native-runtime.json")
@ConfigurationParameter(key = PLUGIN_PUBLISH_QUIET_PROPERTY_NAME, value = "true")
public class RunNativeEngineRuntimeFeaturesTest {
}
