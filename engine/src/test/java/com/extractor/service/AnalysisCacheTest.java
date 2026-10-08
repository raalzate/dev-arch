package com.extractor.service;

import com.extractor.testsupport.DemoProjects;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** 007-native-engine-runtime FR-025, research D6: in-memory reuse of unchanged projects. */
class AnalysisCacheTest {

    @TempDir
    Path tmp;

    private static String json(Object value) throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        mapper.enable(SerializationFeature.INDENT_OUTPUT);
        mapper.enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);
        return mapper.writeValueAsString(value);
    }

    private Path project(String name) throws Exception {
        Path p = tmp.resolve(name).resolve("src");
        Files.createDirectories(p);
        Files.writeString(p.resolve("A.java"), "class A {}");
        return p.getParent();
    }

    @Test
    void capacityPrecedenceIsSystemPropertyThenEnvironmentThenEight() {
        assertEquals(3, AnalysisCache.capacityFrom("3", "5"));
        assertEquals(5, AnalysisCache.capacityFrom(null, "5"));
        assertEquals(8, AnalysisCache.capacityFrom(null, null));
        assertEquals(8, AnalysisCache.capacityFrom(" ", ""));
        assertEquals(0, AnalysisCache.capacityFrom("0", null));
        assertThrows(IllegalArgumentException.class, () -> AnalysisCache.capacityFrom("-1", null));
        assertThrows(IllegalArgumentException.class, () -> AnalysisCache.capacityFrom(null, "abc"));
    }

    @Test
    void reusesUnchangedProjectsKeyedByLanguageWithLruEviction() throws Exception {
        AnalysisCache cache = new AnalysisCache(2);
        AtomicInteger computations = new AtomicInteger();
        AnalysisCache.Computation compute = () -> {
            computations.incrementAndGet();
            return null;
        };
        Path a = project("a");
        Path b = project("b");
        Path c = project("c");
        assertTrue(cache.lookup(a, AnalysisLanguage.AUTO, compute).computed());
        assertTrue(!cache.lookup(a, AnalysisLanguage.AUTO, compute).computed());
        assertTrue(cache.lookup(a, AnalysisLanguage.JAVA, compute).computed(), "language is part of the key");
        assertTrue(cache.lookup(b, AnalysisLanguage.AUTO, compute).computed());
        assertTrue(cache.lookup(c, AnalysisLanguage.AUTO, compute).computed());
        assertTrue(cache.lookup(a, AnalysisLanguage.AUTO, compute).computed(), "evicted by capacity 2");
        assertEquals(5, computations.get());
        assertEquals(1, cache.hits());
        assertEquals(5, cache.misses());
    }

    @Test
    void capacityZeroDisablesReuse() throws Exception {
        AnalysisCache cache = new AnalysisCache(0);
        Path a = project("a");
        assertTrue(cache.lookup(a, AnalysisLanguage.AUTO, () -> null).computed());
        assertTrue(cache.lookup(a, AnalysisLanguage.AUTO, () -> null).computed());
        assertEquals(0, cache.hits());
    }

    @Test
    void failedComputationsAreNotKept() throws Exception {
        AnalysisCache cache = new AnalysisCache(2);
        Path a = project("a");
        assertThrows(IllegalStateException.class, () -> cache.lookup(a, AnalysisLanguage.AUTO, () -> {
            throw new IllegalStateException("boom");
        }));
        assertTrue(cache.lookup(a, AnalysisLanguage.AUTO, () -> null).computed());
    }

    @Test
    void concurrentLookupsOfTheSameKeyComputeOnce() throws Exception {
        AnalysisCache cache = new AnalysisCache(4);
        Path a = project("a");
        AtomicInteger computations = new AtomicInteger();
        CountDownLatch inside = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        Future<AnalysisCache.Lookup> first = pool.submit(() -> cache.lookup(a, AnalysisLanguage.AUTO, () -> {
            computations.incrementAndGet();
            inside.countDown();
            release.await();
            return null;
        }));
        inside.await();
        Future<AnalysisCache.Lookup> second = pool.submit(() -> cache.lookup(a, AnalysisLanguage.AUTO, () -> {
            computations.incrementAndGet();
            return null;
        }));
        Thread.sleep(200);
        release.countDown();
        assertTrue(first.get().computed());
        assertTrue(!second.get().computed());
        assertEquals(1, computations.get());
        pool.shutdown();
    }

    @Test
    void cachedServiceViewsEqualFreshViewsAndAreNotMutatedByFiltering() throws Exception {
        Path project = DemoProjects.copy("java-standar", tmp);
        AnalysisService fresh = new AnalysisService();
        AnalysisService cached = new AnalysisService(new AnalysisCache(4));
        AnalysisResult first = cached.analyzeProject(project);
        String graphBefore = json(first.getDependencyGraph());
        String archBefore = json(first.getArchitecture());

        assertEquals(json(fresh.getArchitectureProposal(project, "Alta")),
                json(cached.getArchitectureProposal(project, "Alta")));
        assertEquals(json(fresh.getDependencyGraph(project)), json(cached.getDependencyGraph(project)));
        assertEquals(json(fresh.getApiContracts(project)), json(cached.getApiContracts(project)));
        String someId = first.getDependencyGraph().getComponents().get(0).getId();
        assertEquals(json(fresh.getComponentMetrics(project, someId)),
                json(cached.getComponentMetrics(project, someId)));
        assertEquals(fresh.getComponentIds(project), cached.getComponentIds(project));

        AnalysisResult again = cached.analyzeProject(project);
        assertSame(first, again);
        assertEquals(graphBefore, json(again.getDependencyGraph()));
        assertEquals(archBefore, json(again.getArchitecture()));
        assertEquals(List.of(), again.getWarnings());
    }
}
