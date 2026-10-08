package com.extractor.integration;

import com.extractor.mcp.tools.AnalyzeProjectTool;
import com.extractor.service.AnalysisService;
import com.extractor.testsupport.DemoProjects;
import io.modelcontextprotocol.spec.McpSchema;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

/**
 * [TS-064] 007-native-engine-runtime decision A2: two analyze_project calls running at the same time in one
 * server process produce the same documents as sequential calls (reentrancy of the shared core). Gates the web
 * default concurrency (2 when green, 1 otherwise).
 */
class NativeRuntimeConcurrencyTest {

    private static final List<String> DOCS =
            List.of("output.json", "output_architecture.json", "output_entrypoints.json");

    @TempDir
    Path tmp;

    private static List<String> run(AnalysisService service, Path project, Path out) throws Exception {
        McpSchema.CallToolResult r = AnalyzeProjectTool.handle(service, new McpSchema.CallToolRequest(
                "analyze_project", Map.of("projectPath", project.toString(), "outputDir", out.toString())));
        assertFalse(r.isError(), String.valueOf(r.content()));
        List<String> docs = new ArrayList<>();
        for (String d : DOCS) {
            docs.add(Files.readString(out.resolve(d)));
        }
        return docs;
    }

    @Test
    void concurrentAnalysesOfJavaAndDotNetEqualSequentialOnes() throws Exception {
        Path java = DemoProjects.copy("java-standar", tmp.resolve("a"));
        Path dotnet = DemoProjects.copy("dotnet-ecommerce", tmp.resolve("b"));
        AnalysisService shared = new AnalysisService();

        for (int round = 0; round < 2; round++) {
            CountDownLatch start = new CountDownLatch(1);
            ExecutorService pool = Executors.newFixedThreadPool(2);
            int r = round;
            Future<List<String>> fj = pool.submit(() -> {
                start.await();
                return run(shared, java, tmp.resolve("cj" + r));
            });
            Future<List<String>> fd = pool.submit(() -> {
                start.await();
                return run(shared, dotnet, tmp.resolve("cd" + r));
            });
            start.countDown();
            List<String> concurrentJava = fj.get();
            List<String> concurrentDotnet = fd.get();
            pool.shutdown();

            List<String> seqJava = run(new AnalysisService(), java, tmp.resolve("sj" + r));
            List<String> seqDotnet = run(new AnalysisService(), dotnet, tmp.resolve("sd" + r));
            assertEquals(seqJava, concurrentJava, "java-standar concurrent vs sequential, round " + r);
            assertEquals(seqDotnet, concurrentDotnet, "dotnet-ecommerce concurrent vs sequential, round " + r);
            assertEquals(seqJava, run(new AnalysisService(), java, tmp.resolve("sj2" + r)));
            assertEquals(seqDotnet, run(new AnalysisService(), dotnet, tmp.resolve("sd2" + r)));
        }
    }

    @Test
    void twoConcurrentAnalysesOfTheSameLanguageAreIndependent() throws Exception {
        Path a = DemoProjects.copy("java-standar", tmp.resolve("x"));
        Path b = DemoProjects.copy("java-standar", tmp.resolve("y"));
        AnalysisService shared = new AnalysisService();
        ExecutorService pool = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        Future<List<String>> fa = pool.submit(() -> {
            start.await();
            return run(shared, a, tmp.resolve("ca"));
        });
        Future<List<String>> fb = pool.submit(() -> {
            start.await();
            return run(shared, b, tmp.resolve("cb"));
        });
        start.countDown();
        assertEquals(run(new AnalysisService(), a, tmp.resolve("sa")), fa.get());
        assertEquals(run(new AnalysisService(), b, tmp.resolve("sb")), fb.get());
        pool.shutdown();
    }
}
