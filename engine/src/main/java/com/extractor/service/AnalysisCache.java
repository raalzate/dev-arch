package com.extractor.service;

import java.io.IOException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory reuse of full analyses of unchanged projects in the server mode
 * (007-native-engine-runtime, FR-025, research D6). Key: real path,
 * language and {@link TreeFingerprint}; least recently used entries are
 * evicted beyond the capacity; capacity 0 disables reuse.
 */
public final class AnalysisCache {

    /** System property with the capacity. */
    public static final String CAPACITY_PROPERTY =
            "static-inference.cache.size";

    /** Environment variable with the capacity. */
    public static final String CAPACITY_ENV = "STATIC_INFERENCE_CACHE_SIZE";

    /** Capacity when nothing is configured. */
    public static final int DEFAULT_CAPACITY = 8;

    /** Load factor of the access-ordered map. */
    private static final float LOAD_FACTOR = 0.75f;

    /** Computes an analysis on a miss. */
    @FunctionalInterface
    public interface Computation {

        /**
         * Computes the analysis.
         *
         * @return the result
         * @throws Exception when the analysis fails
         */
        AnalysisResult compute() throws Exception;
    }

    /**
     * Outcome of a lookup.
     *
     * @param result   the analysis result
     * @param computed true when this caller computed it (miss)
     */
    public record Lookup(AnalysisResult result, boolean computed) {
    }

    /** Maximum number of projects kept. */
    private final int capacity;

    /** Entries in access order. */
    private final Map<String, CompletableFuture<AnalysisResult>> entries;

    /** Lookups served from memory. */
    private final AtomicLong hitCount = new AtomicLong();

    /** Lookups that computed the analysis. */
    private final AtomicLong missCount = new AtomicLong();

    /**
     * Creates a cache.
     *
     * @param maxProjects capacity, 0 disables reuse
     */
    public AnalysisCache(final int maxProjects) {
        if (maxProjects < 0) {
            throw new IllegalArgumentException("capacity must be >= 0");
        }
        this.capacity = maxProjects;
        this.entries = new LinkedHashMap<>(DEFAULT_CAPACITY, LOAD_FACTOR, true) {
            private static final long serialVersionUID = 1L;

            @Override
            protected boolean removeEldestEntry(final Map.Entry<String,
                    CompletableFuture<AnalysisResult>> eldest) {
                return size() > capacity;
            }
        };
    }

    /**
     * Cache sized from the system property, then the environment, then 8.
     *
     * @return the cache
     */
    public static AnalysisCache fromEnvironment() {
        return new AnalysisCache(capacityFrom(
                System.getProperty(CAPACITY_PROPERTY),
                System.getenv(CAPACITY_ENV)));
    }

    /**
     * Resolves the configured capacity.
     *
     * @param property value of the system property (may be null)
     * @param env      value of the environment variable (may be null)
     * @return the capacity
     */
    public static int capacityFrom(final String property, final String env) {
        String raw = property != null && !property.isBlank() ? property
                : env != null && !env.isBlank() ? env : null;
        if (raw == null) {
            return DEFAULT_CAPACITY;
        }
        try {
            int value = Integer.parseInt(raw.trim());
            if (value >= 0) {
                return value;
            }
        } catch (NumberFormatException e) {
            // reported below
        }
        throw new IllegalArgumentException("Invalid " + CAPACITY_PROPERTY
                + " / " + CAPACITY_ENV + ": '" + raw + "'");
    }

    /**
     * Returns the reused analysis of an unchanged project or computes it.
     * Concurrent lookups of the same key compute it once.
     *
     * @param project  project directory
     * @param language analyzer choice
     * @param compute  computation used on a miss
     * @return the result and whether this caller computed it
     * @throws Exception when the computation fails
     */
    public Lookup lookup(final Path project, final AnalysisLanguage language,
            final Computation compute) throws Exception {
        if (capacity == 0) {
            missCount.incrementAndGet();
            return new Lookup(compute.compute(), true);
        }
        String key = key(project, language);
        CompletableFuture<AnalysisResult> mine = new CompletableFuture<>();
        CompletableFuture<AnalysisResult> existing;
        synchronized (entries) {
            existing = entries.get(key);
            if (existing == null) {
                entries.put(key, mine);
            }
        }
        if (existing != null) {
            try {
                AnalysisResult result = existing.get();
                hitCount.incrementAndGet();
                return new Lookup(result, false);
            } catch (ExecutionException e) {
                return lookup(project, language, compute);
            }
        }
        missCount.incrementAndGet();
        try {
            AnalysisResult result = compute.compute();
            mine.complete(result);
            return new Lookup(result, true);
        } catch (Exception | Error e) {
            synchronized (entries) {
                entries.remove(key, mine);
            }
            mine.completeExceptionally(e);
            throw e;
        }
    }

    private static String key(final Path project,
            final AnalysisLanguage language) throws IOException {
        Path real = project.toRealPath();
        return real + "\n" + language.wireName() + "\n"
                + TreeFingerprint.of(real);
    }

    /**
     * Lookups served from memory.
     *
     * @return the count
     */
    public long hits() {
        return hitCount.get();
    }

    /**
     * Lookups that computed the analysis.
     *
     * @return the count
     */
    public long misses() {
        return missCount.get();
    }

    /**
     * Maximum number of projects kept.
     *
     * @return the capacity
     */
    public int capacity() {
        return capacity;
    }
}
