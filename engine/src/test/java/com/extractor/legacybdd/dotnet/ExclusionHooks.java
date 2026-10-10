package com.extractor.legacybdd.dotnet;

import com.extractor.legacybdd.LegacyExclusions;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

/** Skips the scenarios listed in the documented legacy exclusions (011 FR-033) before any other hook runs. */
public class ExclusionHooks {

    @Before(order = 0)
    public void skipDocumentedExclusions(Scenario scenario) {
        LegacyExclusions.abortIfExcluded(scenario);
    }
}
