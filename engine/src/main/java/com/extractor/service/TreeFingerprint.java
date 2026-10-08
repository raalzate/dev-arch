package com.extractor.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * SHA-256 over the sorted (relative path, size, modification time) of the
 * regular files of a project (007-native-engine-runtime, research D6).
 * The root-level documents written by analyze_project are ignored.
 */
public final class TreeFingerprint {

    /** Root-level files written by the engine itself. */
    private static final Set<String> OWN_OUTPUTS = Set.of("output.json",
            "output_architecture.json", "output_entrypoints.json");

    private TreeFingerprint() {
    }

    /**
     * Fingerprint of a project tree.
     *
     * @param root project directory
     * @return lower-case hexadecimal SHA-256
     * @throws IOException when the tree cannot be read
     */
    public static String of(final Path root) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        List<Path> files;
        try (Stream<Path> walk = Files.walk(root)) {
            files = walk.filter(Files::isRegularFile)
                    .filter(p -> !isOwnOutput(root, p))
                    .sorted()
                    .toList();
        }
        for (Path file : files) {
            BasicFileAttributes attrs =
                    Files.readAttributes(file, BasicFileAttributes.class);
            String line = root.relativize(file).toString().replace('\\', '/')
                    + "\t" + attrs.size()
                    + "\t" + attrs.lastModifiedTime().toMillis() + "\n";
            digest.update(line.getBytes(StandardCharsets.UTF_8));
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    private static boolean isOwnOutput(final Path root, final Path file) {
        Path name = file.getFileName();
        return name != null && root.equals(file.getParent())
                && OWN_OUTPUTS.contains(name.toString());
    }
}
