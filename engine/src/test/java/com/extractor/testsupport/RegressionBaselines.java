package com.extractor.testsupport;

import com.extractor.schema.DemoOutputs;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Regression baseline {@code src/test/resources/baseline-v1.2.0/<project>/} of 008-configurable-inference
 * (research D1): the three documents of every demo project produced by the engine of product 1.2.0
 * (commit {@code 7bc8170}, end of 007) on the hermetic demo copies, with the demo root replaced by
 * {@value #REPO_PLACEHOLDER}.
 */
public final class RegressionBaselines {

    /** Placeholder of the hermetic demo root inside the stored documents. */
    public static final String REPO_PLACEHOLDER = "${REPO}";

    /** The six demo projects, in a stable order. */
    public static final List<String> PROJECTS = List.of("java-standar", "jee-architecture-master", "legacy-erp",
            "dotnet-ecommerce", "dotnet-legacy-clinic", "dotnet-unstructured");

    /** The three documents in CLI order. */
    public static final List<String> DOCUMENTS =
            List.of(DemoOutputs.GRAPH, DemoOutputs.ARCHITECTURE, DemoOutputs.ENTRYPOINTS);

    private RegressionBaselines() {
    }

    /** Directory of the stored baseline of a project. */
    public static Path dir(String project) {
        return DemoOutputs.repoRoot().resolve("src/test/resources/baseline-v1.2.0").resolve(project);
    }

    /** Loads the three documents with the placeholder replaced by the hermetic demo root. */
    public static Map<String, String> load(String project) {
        String repo = DemoOutputs.demoRoot().toString();
        Map<String, String> out = new LinkedHashMap<>();
        for (String document : DOCUMENTS) {
            try {
                out.put(document, Files.readString(dir(project).resolve(document), StandardCharsets.UTF_8)
                        .replace(REPO_PLACEHOLDER, repo));
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        }
        return out;
    }

    /** Stores the documents of a project replacing the hermetic demo root by the placeholder. */
    public static void store(String project, Map<String, String> documents) {
        String repo = DemoOutputs.demoRoot().toString();
        try {
            Files.createDirectories(dir(project));
            for (String document : DOCUMENTS) {
                Files.writeString(dir(project).resolve(document),
                        documents.get(document).replace(repo, REPO_PLACEHOLDER), StandardCharsets.UTF_8);
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
