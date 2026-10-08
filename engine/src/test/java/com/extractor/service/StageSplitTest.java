package com.extractor.service;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.schema.DemoOutputs;
import com.extractor.testsupport.RegressionBaselines;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 008 FR-001..FR-003: extraction followed by a pure inference equals the full analysis. */
class StageSplitTest {

    @ParameterizedTest
    @ValueSource(strings = {"java-standar", "dotnet-ecommerce"})
    void extractionThenInferenceEqualsTheBaseline(String project) throws Exception {
        if (DemoOutputs.isDotNet(project)) {
            Assumptions.assumeTrue(DemoOutputs.dotNetAnalyzerAvailable());
        }
        Path dir = DemoOutputs.projectDir(project);
        ExtractionResult extraction = new ExtractionService().extract(dir, AnalysisOptions.DEFAULT,
                InferenceConfig.defaults().detection(), AnalysisProgressListener.NOOP);
        Map<String, String> baseline = RegressionBaselines.load(project);
        assertEquals(baseline.get(DemoOutputs.GRAPH),
                DemoOutputs.cliMapper().writeValueAsString(extraction.graph()));
        InferenceInput input = InferenceInput.of(extraction);
        String architecture = DemoOutputs.cliMapper().writeValueAsString(
                new InferenceService().infer(input, InferenceConfig.defaults()));
        assertEquals(baseline.get(DemoOutputs.ARCHITECTURE), architecture);
        // pure: the same input inferred again without the project on disk gives the same document
        assertEquals(architecture, DemoOutputs.cliMapper().writeValueAsString(
                new InferenceService().infer(new InferenceInput(extraction.graph(),
                        extraction.projectDependencies(), extraction.secretsLocations()),
                        InferenceConfig.defaults())));
    }
}
