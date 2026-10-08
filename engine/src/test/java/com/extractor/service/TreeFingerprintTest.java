package com.extractor.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

/** 007-native-engine-runtime FR-025, research D6: fingerprint of a project tree. */
class TreeFingerprintTest {

    @TempDir
    Path root;

    private void tree() throws Exception {
        Files.createDirectories(root.resolve("src/a"));
        Files.writeString(root.resolve("pom.xml"), "<project/>");
        Files.writeString(root.resolve("src/a/A.java"), "class A {}");
        Files.setLastModifiedTime(root.resolve("src/a/A.java"), FileTime.fromMillis(1_000_000L));
    }

    @Test
    void isStableAndIgnoresRootLevelOutputs() throws Exception {
        tree();
        String first = TreeFingerprint.of(root);
        assertEquals(first, TreeFingerprint.of(root));
        Files.writeString(root.resolve("output.json"), "{}");
        Files.writeString(root.resolve("output_architecture.json"), "{}");
        Files.writeString(root.resolve("output_entrypoints.json"), "{}");
        assertEquals(first, TreeFingerprint.of(root));
        Files.writeString(root.resolve("src/output.json"), "{}");
        assertNotEquals(first, TreeFingerprint.of(root), "only root-level outputs are ignored");
    }

    @Test
    void changesWithModificationTimeSizeAdditionAndDeletion() throws Exception {
        tree();
        String base = TreeFingerprint.of(root);
        Path a = root.resolve("src/a/A.java");
        Files.setLastModifiedTime(a, FileTime.fromMillis(2_000_000L));
        String touched = TreeFingerprint.of(root);
        assertNotEquals(base, touched);
        Files.writeString(a, "class A { int x; }");
        Files.setLastModifiedTime(a, FileTime.fromMillis(2_000_000L));
        String resized = TreeFingerprint.of(root);
        assertNotEquals(touched, resized);
        Files.writeString(root.resolve("src/a/B.java"), "class B {}");
        String added = TreeFingerprint.of(root);
        assertNotEquals(resized, added);
        Files.delete(root.resolve("src/a/B.java"));
        assertEquals(resized, TreeFingerprint.of(root));
    }
}
