package com.extractor.testsupport;

import com.extractor.schema.DemoOutputs;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 008 FR-005 / SC-001 (core path): default outputs byte-identical to baseline-v1.2.0. */
class DefaultOutputsRegressionTest {

    static List<String> projects() {
        return RegressionBaselines.PROJECTS;
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("projects")
    void defaultOutputsEqualTheBaseline(String project) {
        if (DemoOutputs.isDotNet(project)) {
            Assumptions.assumeTrue(DemoOutputs.dotNetAnalyzerAvailable(), "dotnet-analyzer not available");
        }
        Map<String, String> baseline = RegressionBaselines.load(project);
        DemoOutputs.Artifacts artifacts = DemoOutputs.of(project);
        for (String document : RegressionBaselines.DOCUMENTS) {
            assertEquals(baseline.get(document), artifacts.byFileName(document), document + " of " + project);
        }
    }
}
