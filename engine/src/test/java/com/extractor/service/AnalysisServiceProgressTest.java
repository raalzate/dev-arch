package com.extractor.service;

import com.extractor.testsupport.DemoProjects;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 007-native-engine-runtime FR-023, research D3: phases emitted by the shared core. */
class AnalysisServiceProgressTest {

    @TempDir
    Path tmp;

    private static String json(Object value) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        mapper.enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        return mapper.writeValueAsString(value);
    }

    @Test
    void emitsDetectionExtractionAndInferenceInOrder() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        List<AnalysisPhase> phases = new ArrayList<>();
        new AnalysisService().analyzeProject(project, AnalysisOptions.DEFAULT, phases::add);
        assertEquals(List.of(AnalysisPhase.DETECTION, AnalysisPhase.EXTRACTION, AnalysisPhase.INFERENCE), phases);
        assertEquals("detection", AnalysisPhase.DETECTION.wireName());
        assertEquals("writing", AnalysisPhase.WRITING.wireName());
    }

    @Test
    void listenerDoesNotChangeTheOutputs() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        AnalysisResult plain = new AnalysisService().analyzeProject(project);
        AnalysisResult observed = new AnalysisService().analyzeProject(project, AnalysisOptions.DEFAULT, p -> { });
        assertEquals(json(plain.getDependencyGraph()), json(observed.getDependencyGraph()));
        assertEquals(json(plain.getArchitecture()), json(observed.getArchitecture()));
        assertEquals(json(plain.getApiContracts()), json(observed.getApiContracts()));
    }
}
