package com.extractor.cli;

import com.extractor.inference.config.InferenceConfig;
import com.extractor.inference.config.InvalidConfigException;
import com.extractor.service.AnalysisLanguage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.lang.reflect.Method;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 008 FR-006: --config=<file> in any order with --language=. */
class ConfigOptionTest {

    private static Object invoke(String method, String... args) throws Exception {
        Method m = Class.forName("com.extractor.MicroserviceInferenceMain").getDeclaredMethod(method, String[].class);
        m.setAccessible(true);
        try {
            return m.invoke(null, (Object) args);
        } catch (java.lang.reflect.InvocationTargetException e) {
            throw (Exception) e.getCause();
        }
    }

    @Test
    void optionsInAnyOrder(@TempDir Path tmp) throws Exception {
        Path config = Files.writeString(tmp.resolve("c.json"), "{\"viability\":{\"thresholds\":{\"high\":0.9}}}");
        String[] args = {"p", "o.json", "--config=" + config, "--language=java"};
        assertEquals(0.9, ((InferenceConfig) invoke("parseConfig", args)).viability().thresholds().high());
        assertEquals(AnalysisLanguage.JAVA,
                ((com.extractor.service.AnalysisOptions) invoke("parseOptions", args)).language());
        assertSame(InferenceConfig.defaults(), invoke("parseConfig", "p", "o.json"));
        assertThrows(InvalidConfigException.class, () -> invoke("parseConfig", "p", "o.json",
                "--config=" + tmp.resolve("missing.json")));
    }
}
