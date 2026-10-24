package com.extractor.determinism;

import com.extractor.service.AnalysisResult;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.ProductLayout;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * BUG-008 (014-standalone-repo): the architecture output must not depend on the default locale of the JVM
 * (principle IV). The quality-metric rationale is Spanish text with Spanish decimal separators on every machine.
 */
class LocaleIndependenceTest {

    private static String architecture(Locale locale) throws Exception {
        Locale saved = Locale.getDefault();
        Locale.setDefault(locale);
        try {
            Path demo = ProductLayout.get().engineRoot().resolve("test-for-demo/java-standar");
            AnalysisResult result = new AnalysisService().analyzeProject(demo);
            return new ObjectMapper().writeValueAsString(result.getArchitecture());
        } finally {
            Locale.setDefault(saved);
        }
    }

    @Test
    void architectureIsIdenticalUnderEnglishAndSpanishDefaultLocales() throws Exception {
        String english = architecture(Locale.US);
        String spanish = architecture(Locale.forLanguageTag("es-CO"));
        assertEquals(spanish, english);
        assertTrue(english.matches("(?s).*CBO promedio \\d+,\\d.*"), "decimal comma in the Spanish rationale");
    }
}
