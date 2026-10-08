package com.extractor.inference.config;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 008 research D3/D4, data-model.md: defaults, partial merge and validation. */
class InferenceConfigLoaderTest {

    @Test
    void defaultsAreThe120Literals() {
        InferenceConfig d = InferenceConfig.defaults();
        assertEquals(0, d.detection().maxDepth());
        assertEquals(0.75, d.clustering().singleDomainRatio());
        assertEquals(0.5, d.clustering().largeClusterRatio());
        assertEquals(0.25, d.evidence().weights().table());
        assertEquals(0.35, d.evidence().weights().call());
        assertEquals(0.30, d.evidence().weights().token());
        assertEquals(0.10, d.evidence().weights().event());
        assertEquals(0.1, d.evidence().edgeThreshold());
        assertEquals(0.5, d.evidence().callDensitySaturation());
        assertEquals(0.4, d.evidence().strongSignals().table());
        assertEquals(0.35, d.evidence().strongSignals().call());
        assertEquals(0.6, d.evidence().strongSignals().token());
        assertEquals(0.65, d.evidence().evidenceThreshold());
        assertEquals(2, d.evidence().minStrongSignals());
        assertEquals(List.of("service", "controller", "repository", "repo", "usecase", "operations", "listener",
                "publisher", "adapter", "factory", "handler", "db"), d.evidence().roleKeywords());
        assertEquals(List.of("entity", "model", "data", "dto", "event", "command", "query"),
                d.evidence().excludeTokens());
        assertEquals(3, d.evidence().minPackageTokenLength());
        assertEquals(List.of("publisher", "event"), d.evidence().eventPublisherKeywords());
        assertEquals(List.of("listener", "consumer"), d.evidence().eventConsumerKeywords());
        ConsolidationConfig c = d.consolidation();
        assertEquals(List.of("Componente de Negocio", "Componente Desconocido", "Componente de Infraestructura",
                "Componente de Configuración"), c.genericNames());
        assertEquals(50, c.domainMergeMaxSize());
        assertEquals(0.3, c.significantInfrastructureRatio());
        assertEquals(0.8, c.supportRatio());
        assertEquals(40, c.maxMergedSizeWithoutSimilarity());
        assertEquals(0.75, c.highTokenSimilarity());
        assertEquals(0.15, c.separationCallDensity());
        assertEquals(0.2, c.separationTableJaccard());
        assertEquals(0.7, c.strongCandidate().minCohesion());
        assertEquals(0.3, c.strongCandidate().maxCoupling());
        assertEquals(3, c.strongCandidate().minSize());
        List<String> infra = List.of("config", "configuration", "security", "application", "exception", "error",
                "filter", "interceptor", "aspect", "swagger", "openapi", "main");
        assertEquals(infra, c.infrastructureKeywords());
        ViabilityConfig v = d.viability();
        assertEquals(0.5, v.weights().cohesion());
        assertEquals(0.35, v.weights().coupling());
        assertEquals(0.15, v.weights().data());
        assertEquals(0.7, v.cohesionBlend().average());
        assertEquals(0.3, v.cohesionBlend().density());
        assertEquals(0.5, v.noTablesDataCohesion());
        assertEquals(3, v.smallSize().below());
        assertEquals(0.6, v.smallSize().penalty());
        assertEquals(50, v.largeSize().above());
        assertEquals(0.5, v.largeSize().minDensity());
        assertEquals(0.7, v.largeSize().penalty());
        assertEquals(0.7, v.thresholds().high());
        assertEquals(0.5, v.thresholds().medium());
        RationaleConfig r = v.rationale();
        assertEquals(List.of(0.7, 0.5, 0.3, 0.5, 5.0, 10.0, 0.3, 0.6, 0.6, 0.3),
                List.of(r.cohesionGood(), r.cohesionFair(), r.couplingGood(), r.couplingFair(), r.cboGood(),
                        r.cboFair(), r.lcomGood(), r.lcomFair(), r.dataGood(), r.dataFair()));
        assertEquals(0.8, d.recommendation().supportRatio());
        assertEquals(infra, d.recommendation().infrastructureKeywords());
        assertEquals("legacy", d.recommendation().dataJaccardMode());
        assertEquals(0.8, d.recommendation().legacyDataJaccard());
        NamingConfig n = d.naming();
        assertEquals(0.8, n.infrastructureRatio());
        assertEquals(List.of("config", "security", "auth", "swagger", "email", "notification", "log", "audit",
                "application"), List.copyOf(n.infrastructureLabels().keySet()));
        assertEquals("Aplicación Principal", n.infrastructureLabels().get("application"));
        assertEquals(35, n.excludeTokens().size());
        assertEquals(3, n.minTokenLength());
        assertTrue(d.isDefault());
    }

    @Test
    void absentOrNullConfigurationIsTheDefaults() {
        assertSame(InferenceConfig.defaults(), InferenceConfigLoader.fromJson(null));
        assertSame(InferenceConfig.defaults(), InferenceConfigLoader.fromObject(null));
        assertEquals(InferenceConfig.defaults(), InferenceConfigLoader.fromText("{}"));
    }

    @Test
    void partialConfigurationKeepsEveryOtherDefault() {
        InferenceConfig c = InferenceConfigLoader.fromObject(
                Map.of("viability", Map.of("thresholds", Map.of("high", 0.8))));
        assertEquals(0.8, c.viability().thresholds().high());
        assertEquals(0.5, c.viability().thresholds().medium());
        assertEquals(InferenceConfig.defaults().evidence(), c.evidence());
        assertTrue(!c.isDefault());
    }

    @Test
    void arraysAndTheLabelMapReplaceTheDefault() {
        InferenceConfig c = InferenceConfigLoader.fromText(
                "{\"naming\":{\"infrastructureLabels\":{\"gateway\":\"Pasarela\"},\"excludeTokens\":[]}}");
        assertEquals(Map.of("gateway", "Pasarela"), c.naming().infrastructureLabels());
        assertEquals(List.of(), c.naming().excludeTokens());
    }

    @Test
    void explicitDefaultsEqualTheDefaults() {
        String json = InferenceConfigLoader.toJson(InferenceConfig.defaults());
        assertEquals(InferenceConfig.defaults(), InferenceConfigLoader.fromText(json));
        assertEquals(json, InferenceConfigLoader.toJson(InferenceConfigLoader.fromText(json)));
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
        "{\"viability\": {\"thresholds\": {\"hihg\": 0.8}}}|viability.thresholds.hihg: unknown parameter",
        "{\"nope\": 1}|nope: unknown parameter",
        "{\"evidence\": {\"weights\": {\"table\": \"high\"}}}|evidence.weights.table: must be a number",
        "{\"evidence\": {\"evidenceThreshold\": 1.5}}|evidence.evidenceThreshold: must be between 0 and 1",
        "{\"viability\": {\"thresholds\": {\"high\": 0.4, \"medium\": 0.6}}}"
                + "|viability.thresholds.medium: must be <= viability.thresholds.high",
        "{\"recommendation\": {\"dataJaccardMode\": \"exact\"}}"
                + "|recommendation.dataJaccardMode: must be one of legacy, data_cohesion",
        "{\"detection\": {\"maxDepth\": 9}}|detection.maxDepth: must be between 0 and 5",
        "{\"naming\": {\"minTokenLength\": 2.5}}|naming.minTokenLength: must be an integer",
        "{\"viability\": 3}|viability: must be an object",
        "{\"naming\": {\"roleKeywords\": [\"Service\"]}}|naming.roleKeywords[0]: must be lower case",
        "{\"naming\": {\"roleKeywords\": [1]}}|naming.roleKeywords: must be an array of strings",
        "{\"evidence\": {\"callDensitySaturation\": 0}}|evidence.callDensitySaturation: must be > 0 and <= 1",
        "{\"evidence\": {\"minStrongSignals\": 5}}|evidence.minStrongSignals: must be between 0 and 4",
        "{\"viability\": {\"rationale\": {\"cboGood\": 12}}}"
                + "|viability.rationale.cboGood: must be <= viability.rationale.cboFair",
        "{\"consolidation\": {\"domainMergeMaxSize\": -1}}|consolidation.domainMergeMaxSize: must be >= 0",
        "[1]|(root): must be an object"
    })
    void invalidConfigurationsNameTheParameter(String json, String reason) {
        InvalidConfigException e = assertThrows(InvalidConfigException.class,
                () -> InferenceConfigLoader.fromText(json));
        assertEquals("Invalid inference configuration: " + reason, e.getMessage());
    }

    @Test
    void unusableFilesNameTheFile(@TempDir Path tmp) throws Exception {
        Path missing = tmp.resolve("missing.json");
        assertEquals("Inference configuration file '" + missing + "' does not exist",
                assertThrows(InvalidConfigException.class, () -> InferenceConfigLoader.fromFile(missing))
                        .getMessage());
        Path broken = Files.writeString(tmp.resolve("broken.json"), "{ nope");
        String message = assertThrows(InvalidConfigException.class,
                () -> InferenceConfigLoader.fromFile(broken)).getMessage();
        assertTrue(message.startsWith("Inference configuration file '" + broken + "' is not valid JSON"), message);
        Path ok = Files.writeString(tmp.resolve("ok.json"), "{\"viability\":{\"thresholds\":{\"high\":0.9}}}");
        assertEquals(0.9, InferenceConfigLoader.fromFile(ok).viability().thresholds().high());
    }
}
