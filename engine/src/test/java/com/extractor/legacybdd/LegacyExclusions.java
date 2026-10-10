package com.extractor.legacybdd;

import io.cucumber.java.Scenario;
import org.junit.jupiter.api.Assumptions;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Documented exclusions of locked legacy scenarios (011-quality-delivery FR-033, user decision 2026-10-09).
 * <p>
 * The single source is the table of {@code specs/011-quality-delivery/legacy-exclusions.md}; the legacy runners carry
 * no tag filter. Each legacy glue package calls {@link #abortIfExcluded(Scenario)} from a first-order {@code @Before}
 * hook, so a listed scenario is reported as skipped with the reason {@code excluded-by-decision: …}.
 */
public final class LegacyExclusions {

    /** Path of the list relative to the product root. */
    public static final String LIST = "specs/011-quality-delivery/legacy-exclusions.md";
    /** Prefix of the skip reason of an excluded scenario. */
    public static final String REASON_PREFIX = "excluded-by-decision";

    private static final Pattern ROW = Pattern.compile(
            "^\\|\\s*(\\d{3}-[a-z0-9-]+)\\s*\\|\\s*(TS-\\d{3})\\s*\\|([^|]*)\\|([^|]+)\\|\\s*(\\d{4}-\\d{2}-\\d{2})\\s*\\|\\s*$");

    /** One documented exclusion. */
    public record Entry(String feature, String scenario, String decision, String date) {
        String reason() {
            return REASON_PREFIX + ": " + feature + " " + scenario + " — superseded by " + decision + " (" + date + ")";
        }
    }

    private LegacyExclusions() {
    }

    /** Parses the list of the product root that contains {@code specs/}. */
    public static List<Entry> read(Path productRoot) {
        Path file = productRoot.resolve(LIST);
        List<String> lines;
        try {
            lines = Files.readAllLines(file, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("cannot read the legacy exclusions list " + file, e);
        }
        List<Entry> out = new ArrayList<>();
        for (String line : lines) {
            Matcher m = ROW.matcher(line.trim());
            if (m.matches()) {
                out.add(new Entry(m.group(1), m.group(2), m.group(4).trim(), m.group(5)));
            }
        }
        if (out.isEmpty()) {
            throw new IllegalStateException("the legacy exclusions list " + file + " has no entries");
        }
        return List.copyOf(out);
    }

    /** Skips the scenario (reported as skipped) when its feature folder and {@code @TS-XXX} tag are listed. */
    public static void abortIfExcluded(Scenario scenario) {
        String uri = scenario.getUri().getPath();
        int specs = uri == null ? -1 : uri.lastIndexOf("/specs/");
        if (specs < 0) {
            return;
        }
        Path root = Paths.get(uri.substring(0, specs));
        String feature = uri.substring(specs + "/specs/".length()).split("/", 2)[0];
        Optional<Entry> hit = read(root).stream()
                .filter(e -> e.feature().equals(feature) && scenario.getSourceTagNames().contains("@" + e.scenario()))
                .findFirst();
        hit.ifPresent(e -> Assumptions.abort(e.reason()));
    }
}
