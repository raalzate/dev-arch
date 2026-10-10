package com.extractor.legacybdd.dotnet;

import com.extractor.analyzer.DotNetToolLocator;
import com.extractor.inference.Cluster;
import com.extractor.inference.MicroserviceNameGenerator;

import java.lang.reflect.Constructor;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.function.UnaryOperator;

/**
 * Entry point run in child JVMs by the bugfix scenarios: behaviour that depends on the process (iteration order
 * salted per JVM, BUG-004) or on the process environment (BUG-006) must be observed in a fresh process.
 * <ul>
 *   <li>{@code name <fqcn>}: prints the proposal name of a cluster whose only member is {@code fqcn}.</li>
 *   <li>{@code locate-hermetic <baseDir>}: locates the analyzer with an empty injected environment (no
 *       {@code DOTNET_ANALYZER_PATH}, empty {@code PATH}) and, as a control, with the real process environment.</li>
 * </ul>
 */
public final class ProbeMain {

    private ProbeMain() {
    }

    public static void main(String[] args) throws Exception {
        switch (args[0]) {
            case "name" -> {
                Cluster cluster = new Cluster(1);
                cluster.setMembers(List.of(args[1]));
                System.out.println(MicroserviceNameGenerator.generateName(Set.of(1), List.of(cluster)));
            }
            case "locate-hermetic" -> {
                Path baseDir = Path.of(args[1]);
                Constructor<DotNetToolLocator> constructor = DotNetToolLocator.class
                        .getDeclaredConstructor(Path.class, boolean.class, UnaryOperator.class);
                constructor.setAccessible(true);
                UnaryOperator<String> emptyEnvironment = name -> null;
                System.out.println("HERMETIC " + locate(constructor.newInstance(baseDir, false, emptyEnvironment)));
                System.out.println("CONTROL " + locate(new DotNetToolLocator(baseDir, false)));
            }
            default -> throw new IllegalArgumentException("unknown probe " + args[0]);
        }
    }

    private static String locate(DotNetToolLocator locator) {
        try {
            return "FOUND " + locator.locate();
        } catch (IllegalStateException e) {
            return "NOTFOUND " + e.getMessage().replace('\n', '|');
        }
    }
}
