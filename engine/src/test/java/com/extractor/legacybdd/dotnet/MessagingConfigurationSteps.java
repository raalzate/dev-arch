package com.extractor.legacybdd.dotnet;

import com.fasterxml.jackson.databind.JsonNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Steps of {@code messaging-configuration-detection.feature} (US-006). */
public class MessagingConfigurationSteps {

    /**
     * Messaging fixtures: framework → fixture and the expected role of each messaging class (producers publish or
     * send, consumers receive). Every other class of the fixture uses no messaging API.
     */
    private static final Map<String, String> FIXTURES = Map.of(
            "MassTransit", "messaging-masstransit",
            "Azure Service Bus", "messaging-azure");
    private static final Map<String, Map<String, String>> ROLES = Map.of(
            "messaging-masstransit", Map.of(
                    "Shipping.Consumers.ShipmentRequestedConsumer", "consumer",
                    "Shipping.Publishers.ShipmentPublisher", "publisher"),
            "messaging-azure", Map.of(
                    "Billing.Messaging.PaymentReceivedListener", "consumer",
                    "Billing.Messaging.InvoiceSender", "publisher"));
    /** Roles that denote a producer of messages. */
    private static final Set<String> PRODUCER_ROLES = Set.of("publisher", "producer");

    private static final Pattern CLASS_DECLARATION = Pattern.compile("\\bclass\\s+(\\w+)");
    private static final Pattern NAMESPACE = Pattern.compile("\\bnamespace\\s+([\\w.]+)");
    private static final Pattern CONFIG_KEY = Pattern.compile("\\w*[cC]onfiguration\\s*\\[\\s*\"([^\"]+)\"\\s*]");
    private static final Pattern APPSETTINGS = Pattern.compile("\"(appsettings[^\"]*\\.json)\"");
    private static final Pattern CONFIG_INJECTION = Pattern.compile("\\(\\s*[^)]*\\bIConfiguration\\s+\\w+");

    @Given("a .NET project with messaging or configuration patterns")
    public void aDotNetProjectWithMessagingOrConfigurationPatterns() {
        LegacyDotnet.requireAnalyzer();
    }

    // ---------------------------------------------------------------- TS-051

    @Given("a .NET project that uses {string}")
    public void aDotNetProjectThatUses(String framework) {
        String fixture = FIXTURES.get(framework);
        assertTrue(fixture != null, "no fixture for " + framework);
        LegacyWorld.project = LegacyDotnet.fixture(fixture);
        LegacyWorld.data.put("expectedRoles", ROLES.get(fixture));
    }

    @Then("the components with messaging patterns are marked with {string} set to {string}")
    public void theMessagingComponentsAreMarked(String field, String expectedType) {
        Map<String, String> expectedRoles = LegacyWorld.get("expectedRoles");
        Map<String, String> actual = new TreeMap<>();
        for (JsonNode component : LegacyWorld.run.graph().path("components")) {
            JsonNode type = component.path(field);
            if (!type.isMissingNode() && !type.isNull()) {
                actual.put(component.path("id").asText(), type.asText());
            }
        }
        Map<String, String> expected = new TreeMap<>();
        expectedRoles.keySet().forEach(id -> expected.put(id, expectedType));
        assertEquals(expected, actual, field + " of the components (only the messaging classes are marked)");
    }

    @Then("the {string} field indicates whether the component is a producer or consumer")
    public void theRoleFieldIndicatesProducerOrConsumer(String field) {
        Map<String, String> expectedRoles = LegacyWorld.get("expectedRoles");
        for (Map.Entry<String, String> entry : expectedRoles.entrySet()) {
            String role = LegacyWorld.run.component(entry.getKey()).path(field).asText();
            if ("consumer".equals(entry.getValue())) {
                assertEquals("consumer", role, field + " of " + entry.getKey());
            } else {
                assertTrue(PRODUCER_ROLES.contains(role), field + " of " + entry.getKey() + " must denote a "
                        + "producer: " + role);
            }
        }
    }

    // ---------------------------------------------------------------- TS-052

    @Given("a .NET project that uses {string} or references {string}")
    public void aDotNetProjectThatUsesConfiguration(String configurationType, String appsettings) {
        Path project = LegacyDotnet.fixture("configuration");
        assertTrue(Files.isRegularFile(project.resolve(appsettings)), "fixture must ship " + appsettings);
        Map<String, Set<String>> expected = new TreeMap<>();
        for (Path source : LegacyDotnet.sources(project, ".cs")) {
            String text = LegacyDotnet.read(source);
            Matcher ns = NAMESPACE.matcher(text);
            Matcher cls = CLASS_DECLARATION.matcher(text);
            assertTrue(ns.find() && cls.find(), "namespace and class of " + source);
            Set<String> references = new TreeSet<>();
            if (CONFIG_INJECTION.matcher(text).find()) {
                references.add(configurationType);
            }
            Matcher key = CONFIG_KEY.matcher(text);
            while (key.find()) {
                references.add("config:" + key.group(1));
            }
            Matcher json = APPSETTINGS.matcher(text);
            while (json.find()) {
                references.add(json.group(1));
            }
            expected.put(ns.group(1) + "." + cls.group(1), references);
        }
        assertTrue(expected.values().stream().anyMatch(r -> r.contains(configurationType)),
                "fixture must inject " + configurationType);
        assertTrue(expected.values().stream().anyMatch(r -> r.contains(appsettings)),
                "fixture must reference " + appsettings);
        assertTrue(expected.values().stream().anyMatch(Set::isEmpty), "fixture must have a class without config");
        LegacyWorld.project = project;
        LegacyWorld.data.put("expectedReferences", expected);
    }

    @Then("the components that access configuration or secrets are identified")
    public void theConfigurationComponentsAreIdentified() {
        Map<String, Set<String>> expected = LegacyWorld.get("expectedReferences");
        Set<String> expectedIds = new TreeSet<>();
        expected.forEach((id, references) -> {
            if (!references.isEmpty()) {
                expectedIds.add(id);
            }
        });
        Set<String> actualIds = new TreeSet<>();
        for (JsonNode component : LegacyWorld.run.graph().path("components")) {
            if (!component.path("secrets_references").isEmpty()) {
                actualIds.add(component.path("id").asText());
            }
        }
        assertFalse(expectedIds.isEmpty(), "no configuration access in the fixture");
        assertEquals(expectedIds, actualIds, "components with configuration or secrets references");
    }

    @Then("their {string} field contains the detected configuration keys")
    public void theirFieldContainsTheConfigurationKeys(String field) {
        Map<String, Set<String>> expected = LegacyWorld.get("expectedReferences");
        for (Map.Entry<String, Set<String>> entry : expected.entrySet()) {
            Set<String> actual = DotnetAnalysisSteps.texts(LegacyWorld.run.component(entry.getKey()).path(field));
            assertEquals(entry.getValue(), actual, field + " of " + entry.getKey());
        }
    }
}
