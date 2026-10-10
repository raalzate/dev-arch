package com.extractor.legacybdd.dotnet;

import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Steps of {@code dependency-injection-analysis.feature} (US-003). Expected relationships are read from the C#
 * sources of the analyzed project (constructors, base lists, service registrations), never from the analyzer.
 */
public class DependencyInjectionSteps {

    private static final Pattern REGISTRATION =
            Pattern.compile("Add(?:Scoped|Transient|Singleton)<\\s*(\\w+)\\s*,\\s*(\\w+)\\s*>\\s*\\(");
    private static final Pattern IMPLEMENTATION = Pattern.compile("\\bclass\\s+(\\w+)\\s*:\\s*([\\w\\s,<>]+?)\\s*\\{");
    private static final Pattern INTERFACE = Pattern.compile("\\binterface\\s+(\\w+)");

    @Given("a .NET project with dependency injection patterns")
    public void aDotNetProjectWithDependencyInjectionPatterns() {
        LegacyDotnet.requireAnalyzer();
        LegacyWorld.project = LegacyDotnet.demo(DotnetAnalysisSteps.DOTNET_DEMO);
    }

    // ---------------------------------------------------------------- TS-021

    @Given("a .NET class that receives dependencies via constructor injection")
    public void aDotNetClassWithConstructorInjection() {
        Set<String> projectTypes = declaredTypes();
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            String text = LegacyDotnet.read(source);
            Matcher cls = Pattern.compile("\\bclass\\s+(\\w+)").matcher(text);
            if (!cls.find()) {
                continue;
            }
            String name = cls.group(1);
            Matcher ctor = Pattern.compile("public\\s+" + name + "\\s*\\(([^)]*)\\)").matcher(text);
            if (!ctor.find()) {
                continue;
            }
            List<String> injected = new ArrayList<>();
            for (String parameter : ctor.group(1).split(",")) {
                String[] parts = parameter.trim().split("\\s+");
                if (parts.length == 2 && projectTypes.contains(parts[0])) {
                    injected.add(parts[0]);
                }
            }
            if (injected.size() >= 2) {
                LegacyWorld.data.put("injectingClass", name);
                LegacyWorld.data.put("injectedTypes", injected);
                return;
            }
        }
        throw new AssertionError("no class injecting two project types through its constructor");
    }

    @Then("the dependency graph contains edges from that class to each injected dependency")
    public void theGraphContainsEdgesToEachInjectedDependency() {
        String from = DotnetAnalysisSteps.componentBySimpleName(LegacyWorld.get("injectingClass"))
                .path("id").asText();
        List<String> injected = LegacyWorld.get("injectedTypes");
        for (String type : injected) {
            String to = DotnetAnalysisSteps.componentBySimpleName(type).path("id").asText();
            assertTrue(hasEdge(from, to, "injection"), "injection edge " + from + " -> " + to + " missing");
        }
    }

    // ---------------------------------------------------------------- TS-022

    @Given("a class that implements an interface and another class that depends on that interface")
    public void aClassImplementingAnInterfaceAndADependent() {
        Set<String> interfaces = new TreeSet<>();
        Map<String, String> sources = new TreeMap<>();
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            String text = LegacyDotnet.read(source);
            sources.put(source.getFileName().toString(), text);
            Matcher m = INTERFACE.matcher(text);
            while (m.find()) {
                interfaces.add(m.group(1));
            }
        }
        for (String text : sources.values()) {
            Matcher m = IMPLEMENTATION.matcher(text);
            while (m.find()) {
                for (String base : m.group(2).split(",")) {
                    String iface = base.trim();
                    if (!interfaces.contains(iface)) {
                        continue;
                    }
                    String implementation = m.group(1);
                    for (Map.Entry<String, String> other : sources.entrySet()) {
                        String name = other.getKey().replace(".cs", "");
                        if (name.equals(implementation) || name.equals(iface)) {
                            continue;
                        }
                        if (Pattern.compile("\\(\\s*[^)]*\\b" + iface + "\\s+\\w+").matcher(other.getValue()).find()) {
                            LegacyWorld.data.put("implementation", implementation);
                            LegacyWorld.data.put("interface", iface);
                            LegacyWorld.data.put("dependent", name);
                            return;
                        }
                    }
                }
            }
        }
        throw new AssertionError("no implementation/interface/dependent triple in " + LegacyWorld.project);
    }

    @Then("the graph contains an edge representing the implementation relationship")
    public void theGraphContainsAnImplementationEdge() {
        String implementation = id(LegacyWorld.get("implementation"));
        String iface = id(LegacyWorld.get("interface"));
        assertTrue(hasEdge(implementation, iface, "implements"),
                "implements edge " + implementation + " -> " + iface + " missing");
    }

    @Then("the graph contains an edge representing the dependency through the interface")
    public void theGraphContainsAnEdgeThroughTheInterface() {
        String dependent = id(LegacyWorld.get("dependent"));
        String iface = id(LegacyWorld.get("interface"));
        assertTrue(hasEdge(dependent, iface, "injection") || hasEdge(dependent, iface, "call"),
                "dependency edge " + dependent + " -> " + iface + " missing");
    }

    // ---------------------------------------------------------------- TS-023

    @Given("a .NET project with service registrations such as {string} in {string} or {string}")
    public void aDotNetProjectWithServiceRegistrations(String example, String startup, String program) {
        assertTrue(REGISTRATION.matcher(example).find(), "example registration must match: " + example);
        Set<List<String>> registrations = new TreeSet<>((a, b) -> String.join(",", a).compareTo(String.join(",", b)));
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            String file = source.getFileName().toString();
            if (!file.equals(startup) && !file.equals(program)) {
                continue;
            }
            Matcher m = REGISTRATION.matcher(LegacyDotnet.read(source));
            while (m.find()) {
                registrations.add(List.of(m.group(1), m.group(2)));
            }
        }
        assertFalse(registrations.isEmpty(), "no service registration in " + startup + " or " + program);
        LegacyWorld.data.put("registrations", registrations);
    }

    @Then("the interface-implementation relationships are detected correctly")
    public void theInterfaceImplementationRelationshipsAreDetected() {
        Set<List<String>> registrations = LegacyWorld.get("registrations");
        for (List<String> registration : registrations) {
            JsonNode implementation = DotnetAnalysisSteps.componentBySimpleName(registration.get(1));
            String iface = id(registration.get(0));
            assertTrue(DotnetAnalysisSteps.texts(implementation.path("implements")).contains(iface),
                    implementation.path("id").asText() + " must implement " + iface + ": "
                            + implementation.path("implements"));
            assertTrue(hasEdge(implementation.path("id").asText(), iface, "implements"),
                    "implements edge for " + registration);
        }
    }

    @Then("the corresponding edges appear in the dependency graph")
    public void theCorrespondingEdgesAppear() {
        Set<List<String>> registrations = LegacyWorld.get("registrations");
        Set<String> expected = new TreeSet<>();
        for (List<String> registration : registrations) {
            expected.add(id(registration.get(1)) + " -> " + id(registration.get(0)));
        }
        Set<String> actual = new TreeSet<>();
        for (JsonNode edge : LegacyWorld.run.graph().path("edges")) {
            if ("registration".equals(edge.path("type").asText())) {
                actual.add(edge.path("from").asText() + " -> " + edge.path("to").asText());
            }
        }
        assertEquals(expected, actual, "registration edges (sources vs graph)");
    }

    // ---------------------------------------------------------------- helpers

    private static Set<String> declaredTypes() {
        Set<String> types = new TreeSet<>();
        Pattern declaration = Pattern.compile("\\b(?:class|interface|record)\\s+(\\w+)");
        for (Path source : LegacyDotnet.sources(LegacyWorld.project, ".cs")) {
            Matcher m = declaration.matcher(LegacyDotnet.read(source));
            while (m.find()) {
                types.add(m.group(1));
            }
        }
        return types;
    }

    private static String id(String simpleName) {
        return DotnetAnalysisSteps.componentBySimpleName(simpleName).path("id").asText();
    }

    static boolean hasEdge(String from, String to, String type) {
        for (JsonNode edge : LegacyWorld.run.graph().path("edges")) {
            if (from.equals(edge.path("from").asText()) && to.equals(edge.path("to").asText())
                    && type.equals(edge.path("type").asText())) {
                return true;
            }
        }
        return false;
    }
}
