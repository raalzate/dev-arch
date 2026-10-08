package com.extractor.analyzer;

import com.extractor.testsupport.ProductLayout;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Release packaging of the .NET analyzer. [BUG-005]
 * A single-file bundle cannot load MSBuild, forcing roslyn-fallback.
 */
class ReleaseWorkflowTest {

    private static String releasePublishStep() throws IOException {
        String yaml = Files.readString(ProductLayout.get().ciWorkflow(), StandardCharsets.UTF_8);
        int release = yaml.indexOf("\n  release:");
        assertTrue(release >= 0, "release job not found");
        String job = yaml.substring(release);
        int publish = job.indexOf("dotnet publish");
        assertTrue(publish >= 0, "dotnet publish not found in release job");
        int end = job.indexOf("\n      - name:", publish);
        return job.substring(publish, end < 0 ? job.length() : end);
    }

    /** [BUG-005] Release publishes framework-dependent, never single-file. */
    @Test
    void releasePublish_isFrameworkDependentNotSingleFile() throws IOException {
        String step = releasePublishStep();

        assertFalse(step.contains("PublishSingleFile=true"), step);
        assertTrue(step.contains("--self-contained false"), step);
    }

    /** [BUG-005] Release notes state the .NET 8 runtime requirement. */
    @Test
    void releaseReadme_statesDotnetRuntimeRequirement() throws IOException {
        String yaml = Files.readString(ProductLayout.get().ciWorkflow(), StandardCharsets.UTF_8);

        assertFalse(yaml.contains("runtime is bundled inside the binary"));
        assertTrue(yaml.contains(".NET 8 runtime"));
    }
}
