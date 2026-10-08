package com.extractor.configbdd;

import io.cucumber.java.After;
import io.cucumber.java.Before;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.stream.Stream;

/** Creates and removes the scratch directory of each 008 scenario. */
public class Hooks {

    @Before
    public void reset() throws IOException {
        World.reset(Files.createTempDirectory("devarch-008-").toRealPath());
    }

    @After
    public void cleanup() throws IOException {
        if (World.tmp != null) {
            try (Stream<Path> walk = Files.walk(World.tmp)) {
                walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
            }
        }
    }
}
