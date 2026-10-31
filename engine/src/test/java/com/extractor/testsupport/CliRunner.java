package com.extractor.testsupport;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Runs the CLI ({@code MicroserviceInferenceMain}) in a child JVM with the test classpath: the CLI calls
 * {@code System.exit}, and the child resolves the .NET analyzer next to {@code target/classes} like the jar does.
 */
public final class CliRunner {

    /** Exit code, standard output and error output of a CLI run. */
    public record Result(int exitCode, String stdout, String stderr) {
    }

    private CliRunner() {
    }

    public static Result run(Path workDir, List<String> args) {
        return run(workDir, args, Map.of());
    }

    /**
     * Runs the CLI with extra environment variables (020: {@code DOTNET_ANALYZER_PATH} of a recording wrapper).
     *
     * @param workDir working directory
     * @param args    program arguments
     * @param env     extra environment variables
     * @return exit code and outputs
     */
    public static Result run(Path workDir, List<String> args, Map<String, String> env) {
        return run(workDir, args, env, System.getProperty("java.class.path"));
    }

    /**
     * Runs the CLI with an explicit class path (020: the engine classes reached through a directory whose
     * sibling {@code dotnet-analyzer} is a recording wrapper).
     *
     * @param workDir   working directory
     * @param args      program arguments
     * @param env       extra environment variables
     * @param classPath class path of the child JVM
     * @return exit code and outputs
     */
    public static Result run(Path workDir, List<String> args, Map<String, String> env, String classPath) {
        try {
            Files.createDirectories(workDir);
            Path out = Files.createTempFile(workDir, "cli-out", ".txt");
            Path err = Files.createTempFile(workDir, "cli-err", ".txt");
            List<String> cmd = new ArrayList<>();
            cmd.add(Path.of(System.getProperty("java.home"), "bin", "java").toString());
            cmd.add("-cp");
            cmd.add(classPath);
            cmd.add("com.extractor.MicroserviceInferenceMain");
            cmd.addAll(args);
            ProcessBuilder pb = new ProcessBuilder(cmd).directory(workDir.toFile())
                    .redirectOutput(out.toFile()).redirectError(err.toFile());
            pb.environment().putAll(env);
            Process p = pb.start();
            if (!p.waitFor(10, TimeUnit.MINUTES)) {
                p.destroyForcibly();
                throw new IllegalStateException("CLI did not finish in 10 minutes: " + args);
            }
            Result r = new Result(p.exitValue(), Files.readString(out, StandardCharsets.UTF_8),
                    Files.readString(err, StandardCharsets.UTF_8));
            Files.deleteIfExists(out);
            Files.deleteIfExists(err);
            return r;
        } catch (IOException e) {
            throw new IllegalStateException(e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }
}
