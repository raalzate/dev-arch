package com.extractor.testsupport;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.stream.Stream;

/** Copies demo projects of {@code test-for-demo/} into scratch directories (007-native-engine-runtime). */
public final class DemoProjects {

    private DemoProjects() {
    }

    /** Directory of a demo project in the checkout (read-only use). */
    public static Path original(String name) {
        return ProductLayout.get().engineRoot().resolve("test-for-demo").resolve(name);
    }

    /**
     * Copies a demo project into {@code parent/name}, skipping the root-level outputs the engine may have written
     * there before.
     */
    public static Path copy(String name, Path parent) {
        Path source = original(name);
        Path target = parent.resolve(name);
        try (Stream<Path> files = Files.walk(source)) {
            for (Path p : (Iterable<Path>) files.sorted()::iterator) {
                Path rel = source.relativize(p);
                if (rel.getNameCount() == 1 && rel.toString().matches("output.*\\.json")) {
                    continue;
                }
                Path dest = target.resolve(rel.toString());
                if (Files.isDirectory(p)) {
                    Files.createDirectories(dest);
                } else {
                    Files.copy(p, dest, StandardCopyOption.REPLACE_EXISTING);
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return target;
    }
}
