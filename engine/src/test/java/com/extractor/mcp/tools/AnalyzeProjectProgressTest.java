package com.extractor.mcp.tools;

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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 007-native-engine-runtime FR-023, contracts/engine-mcp.md: progress notifications [TS-048, TS-049]. */
class AnalyzeProjectProgressTest {

    @TempDir
    Path tmp;

    private static McpSchema.CallToolRequest request(Path project, Path out, Object token) {
        Map<String, Object> args = Map.of("projectPath", project.toString(), "outputDir", out.toString());
        return token == null ? new McpSchema.CallToolRequest("analyze_project", args)
                : new McpSchema.CallToolRequest("analyze_project", args, Map.of("progressToken", token));
    }

    private static List<String> documents(Path out) throws Exception {
        return List.of(Files.readString(out.resolve("output.json")),
                Files.readString(out.resolve("output_architecture.json")),
                Files.readString(out.resolve("output_entrypoints.json")));
    }

    @Test
    void withAProgressTokenTheFourPhasesArriveInOrderBeforeWriting() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        Path out = tmp.resolve("out");
        List<McpSchema.ProgressNotification> seen = new ArrayList<>();
        List<Boolean> writtenAtNotification = new ArrayList<>();
        McpSchema.CallToolResult result = AnalyzeProjectTool.handle(new AnalysisService(),
                request(project, out, "tok-1"), n -> {
                    seen.add(n);
                    writtenAtNotification.add(Files.exists(out.resolve("output.json")));
                });
        assertFalse(result.isError());
        assertEquals(List.of("detection", "extraction", "inference", "writing"),
                seen.stream().map(McpSchema.ProgressNotification::message).toList());
        assertEquals(List.of(1.0, 2.0, 3.0, 4.0), seen.stream().map(McpSchema.ProgressNotification::progress).toList());
        assertTrue(seen.stream().allMatch(n -> n.total() == 4.0 && "tok-1".equals(n.progressToken())));
        assertEquals(List.of(false, false, false, false), writtenAtNotification);
    }

    @Test
    void withoutATokenNothingIsSentAndTheResultIsByteIdentical() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        Path out = tmp.resolve("out");
        AnalysisService service = new AnalysisService();
        McpSchema.CallToolResult withToken = AnalyzeProjectTool.handle(service, request(project, out, 7), n -> { });
        List<String> docsWithToken = documents(out);
        List<McpSchema.ProgressNotification> seen = new ArrayList<>();
        McpSchema.CallToolResult without = AnalyzeProjectTool.handle(service, request(project, out, null), seen::add);
        assertTrue(seen.isEmpty());
        assertEquals(withToken.content(), without.content());
        assertEquals(withToken.meta(), without.meta());
        assertEquals(docsWithToken, documents(out));
    }

    @Test
    void aFailingProgressChannelNeverFailsTheAnalysis() throws Exception {
        // Real stdio transport: concurrent notifications can be rejected ("Failed to enqueue message").
        Path project = DemoProjects.copy("java-standar", tmp);
        Path out = tmp.resolve("out");
        AnalysisService service = new AnalysisService();
        McpSchema.CallToolResult failing = AnalyzeProjectTool.handle(service, request(project, out, "tok"), n -> {
            throw new IllegalStateException("Failed to enqueue message");
        });
        assertFalse(failing.isError(), String.valueOf(failing.content()));
        List<String> docs = documents(out);
        McpSchema.CallToolResult quiet = AnalyzeProjectTool.handle(service, request(project, out, null), n -> { });
        assertEquals(quiet.content(), failing.content());
        assertEquals(docs, documents(out));
    }

    @Test
    void notificationsOfConcurrentAnalysesAreNeverSentAtTheSameTime() throws Exception {
        Path a = DemoProjects.copy("java-standar", tmp.resolve("a"));
        Path b = DemoProjects.copy("java-standar", tmp.resolve("b"));
        AnalysisService service = new AnalysisService();
        java.util.concurrent.atomic.AtomicInteger inside = new java.util.concurrent.atomic.AtomicInteger();
        java.util.concurrent.atomic.AtomicInteger overlaps = new java.util.concurrent.atomic.AtomicInteger();
        ProgressSink slow = n -> {
            if (inside.incrementAndGet() > 1) {
                overlaps.incrementAndGet();
            }
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            inside.decrementAndGet();
        };
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        try {
            var fa = pool.submit(() -> AnalyzeProjectTool.handle(service, request(a, tmp.resolve("oa"), "a"), slow));
            var fb = pool.submit(() -> AnalyzeProjectTool.handle(service, request(b, tmp.resolve("ob"), "b"), slow));
            assertFalse(fa.get().isError());
            assertFalse(fb.get().isError());
        } finally {
            pool.shutdownNow();
        }
        assertEquals(0, overlaps.get());
    }
}
