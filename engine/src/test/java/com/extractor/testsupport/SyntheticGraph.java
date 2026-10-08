package com.extractor.testsupport;

import com.extractor.model.Component;
import com.extractor.model.DependencyGraph;
import com.extractor.model.Edge;
import com.extractor.schema.DemoOutputs;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Deterministic synthetic dependency graph (008 research D13): {@value #DOMAINS} business domains of
 * {@value #PER_DOMAIN} classes ({@code com.synth.<domain>.<layer>.<Class>}), intra-domain call chains, a few
 * cross-domain calls, two tables per domain and one table shared with the next domain. No domain holds more
 * than 75 % of the components, so {@code clustering.singleDomainRatio = 0} switches the clustering strategy.
 */
public final class SyntheticGraph {

    /** Number of business domains. */
    public static final int DOMAINS = 25;
    /** Classes per domain. */
    public static final int PER_DOMAIN = 20;

    private static final String[] WORDS = {"order", "billing", "customer", "catalog", "inventory", "shipping",
        "payment", "invoice", "account", "pricing", "promotion", "review", "supplier", "warehouse", "return",
        "loyalty", "notification", "report", "audit", "tax", "contract", "booking", "survey", "ticket", "media"};

    private static final String[] ROLES = {"Service", "Repository", "Controller", "Entity", "Mapper", "Validator",
        "Handler", "Factory", "Listener", "Publisher", "Dto", "Query", "Command", "Adapter", "Operations",
        "Helper", "Policy", "Scheduler", "Client", "Config"};

    private SyntheticGraph() {
    }

    /** Fully qualified id of class {@code index} of domain {@code domain}. */
    public static String id(int domain, int index) {
        String word = WORDS[domain];
        String cap = Character.toUpperCase(word.charAt(0)) + word.substring(1);
        String layer = index % 2 == 0 ? "core" : "infra";
        return "com.synth." + word + "." + layer + "." + cap + ROLES[index] + (index >= ROLES.length ? index : "");
    }

    /** Builds the graph (500 components). */
    public static DependencyGraph build() {
        List<Component> components = new ArrayList<>();
        List<Edge> edges = new ArrayList<>();
        for (int d = 0; d < DOMAINS; d++) {
            for (int i = 0; i < PER_DOMAIN; i++) {
                Component c = new Component(id(d, i));
                c.addFile("synthetic/" + id(d, i).replace('.', '/') + ".java");
                c.setLoc(20 + (d * 7 + i * 3) % 80);
                c.setLayer("Negocio");
                if (i % 4 == 1 || i % 4 == 3) {
                    c.addTableUsed("t_" + WORDS[d] + (i % 4 == 1 ? "_main" : "_line"));
                }
                if (i == 3) {
                    c.addTableUsed("t_shared_" + ((d + 1) % DOMAINS));
                }
                if (i == 1) {
                    c.addTableUsed("t_shared_" + d);
                }
                components.add(c);
            }
        }
        for (int d = 0; d < DOMAINS; d++) {
            for (int i = 0; i < PER_DOMAIN; i++) {
                call(components, edges, id(d, i), id(d, (i + 1) % PER_DOMAIN), 1 + i % 3);
                if (i % 3 == 0) {
                    call(components, edges, id(d, i), id(d, (i + 5) % PER_DOMAIN), 1);
                }
                if (i % 5 == 0) {
                    call(components, edges, id(d, i), id((d + 1) % DOMAINS, (i + 2) % PER_DOMAIN), 1);
                }
            }
        }
        return new DependencyGraph(components, edges);
    }

    private static void call(List<Component> components, List<Edge> edges, String from, String to, int weight) {
        Component source = components.stream().filter(c -> c.getId().equals(from)).findFirst().orElseThrow();
        Component target = components.stream().filter(c -> c.getId().equals(to)).findFirst().orElseThrow();
        source.addCallOut(to);
        target.addCallIn(from);
        edges.add(new Edge(from, to, weight, "call"));
    }

    /** Writes the graph as {@code <dir>/output.json} with the CLI serialization and returns the path. */
    public static Path write(Path dir) {
        try {
            Files.createDirectories(dir);
            Path file = dir.resolve("output.json");
            Files.writeString(file, DemoOutputs.cliMapper().writeValueAsString(build()), StandardCharsets.UTF_8);
            return file;
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
