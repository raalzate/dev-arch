package com.extractor.testsupport;

import com.extractor.schema.DemoOutputs;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Captures {@code baseline-v1.2.0} (research D1). Runs only with {@code -Dbaseline.capture=true}, on a checkout
 * whose engine sources equal commit {@code 7bc8170}: {@code mvn test -Dtest=RegressionBaselineCaptureTest
 * -Dbaseline.capture=true}.
 */
class RegressionBaselineCaptureTest {

    @Test
    @EnabledIfSystemProperty(named = "baseline.capture", matches = "true")
    void captureTheSixDemoProjects() {
        for (String project : RegressionBaselines.PROJECTS) {
            DemoOutputs.Artifacts artifacts = DemoOutputs.analyzeInto(DemoOutputs.projectDir(project),
                    DemoOutputs.repoRoot().resolve("target/baseline-capture").resolve(project));
            Map<String, String> documents = new LinkedHashMap<>();
            for (String document : RegressionBaselines.DOCUMENTS) {
                documents.put(document, artifacts.byFileName(document));
            }
            RegressionBaselines.store(project, documents);
        }
    }
}
