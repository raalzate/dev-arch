package com.extractor.extendedbdd;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.SelectDirectories;
import org.junit.platform.suite.api.Suite;
import org.junit.platform.suite.api.SuiteDisplayName;

import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PUBLISH_QUIET_PROPERTY_NAME;

/** Cucumber JVM runner for the engine scenarios ({@code @engine}) of 024-extended-static-analysis. */
@Suite(failIfNoTests = false)
@SuiteDisplayName("024-extended-static-analysis engine scenarios")
@IncludeEngines("cucumber")
@SelectDirectories("../specs/024-extended-static-analysis/tests/features")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
        value = "com.extractor.extendedbdd,com.extractor.legacyinferencebdd,com.extractor.storedprocsbdd")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@engine")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "summary, json:target/cucumber-reports/extended-analysis.json")
@ConfigurationParameter(key = PLUGIN_PUBLISH_QUIET_PROPERTY_NAME, value = "true")
public class RunExtendedAnalysisFeaturesTest {
}
