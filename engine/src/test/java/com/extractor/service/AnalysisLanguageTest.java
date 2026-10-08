package com.extractor.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/** 007-native-engine-runtime FR-024, research D5: language choice parsing. */
class AnalysisLanguageTest {

    @Test
    void parsesTheThreeValuesAndNull() {
        assertEquals(AnalysisLanguage.JAVA, AnalysisLanguage.parse("java"));
        assertEquals(AnalysisLanguage.DOTNET, AnalysisLanguage.parse("dotnet"));
        assertEquals(AnalysisLanguage.AUTO, AnalysisLanguage.parse("auto"));
        assertEquals(AnalysisLanguage.AUTO, AnalysisLanguage.parse(null));
        assertEquals("dotnet", AnalysisLanguage.DOTNET.wireName());
    }

    @Test
    void rejectsUnknownValuesNamingTheAllowedOnes() {
        for (String bad : new String[] {"cobol", "Java", " java", "", "DOTNET"}) {
            IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                    () -> AnalysisLanguage.parse(bad));
            assertEquals("Invalid language '" + bad + "'. Allowed: java, dotnet, auto", e.getMessage());
        }
    }

    @Test
    void defaultOptionsUseAutomaticDetection() {
        assertEquals(AnalysisLanguage.AUTO, AnalysisOptions.DEFAULT.language());
        assertEquals(AnalysisLanguage.JAVA, AnalysisOptions.of(AnalysisLanguage.JAVA).language());
    }
}
