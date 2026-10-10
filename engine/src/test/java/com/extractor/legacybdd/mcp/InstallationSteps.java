package com.extractor.legacybdd.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.jar.JarFile;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** US-003 (TS-015..TS-019) and the shared "server is running" preconditions. */
public class InstallationSteps {

    private static final String SERVER_NAME = "static-inference";

    @Given("the MCP server is running locally")
    @Given("the MCP server is running")
    @Given("the server is started")
    public void serverRunning() {
        World.server = Support.sharedServer();
        JsonNode pong = World.server.request("ping", null, Duration.ofSeconds(30));
        assertTrue(pong.has("result"), "server does not answer ping: " + pong);
    }

    // ---- TS-015 ----------------------------------------------------------------------------------------------

    @Given("the user has a compatible runtime environment installed")
    public void compatibleRuntime() {
        Support.Run version = Support.run(List.of(Support.java(), "-version"), Support.scratch(),
                Duration.ofSeconds(60));
        assertEquals(0, version.exitCode(), version.all());
        Matcher m = Pattern.compile("version \"(\\d+)").matcher(version.all());
        assertTrue(m.find(), "cannot read the Java version: " + version.all());
        int required = requiredJavaRelease();
        assertTrue(Integer.parseInt(m.group(1)) >= required,
                "Java " + m.group(1) + " installed, the engine requires " + required);
    }

    @When("the user executes the JAR with the MCP mode argument")
    public void executeJarMcp() {
        World.ownServer = StdioServer.launch(Support.serverCommand(), Support.newDir("ts015-"), Map.of());
    }

    @Then("the server starts and is available to receive invocations via stdio transport")
    public void serverAvailableViaStdio() {
        JsonNode init = World.ownServer.initialize();
        assertEquals(SERVER_NAME, init.path("serverInfo").path("name").asText(), init.toString());
        assertFalse(init.path("protocolVersion").asText().isBlank(), init.toString());
        assertTrue(init.path("capabilities").has("tools"), "tools capability not announced: " + init);
        JsonNode list = World.ownServer.request("tools/list", StdioServer.JSON.createObjectNode());
        assertTrue(list.path("result").path("tools").size() > 0, "tools/list over stdio: " + list);
        assertTrue(World.ownServer.isAlive(), "server must keep running waiting for invocations");
        assertStdoutIsProtocolOnly(World.ownServer);
    }

    // ---- TS-016 / TS-019 -------------------------------------------------------------------------------------

    @When("an LLM agent requests the list of available tools")
    @When("a tools\\/list request is received")
    public void listTools() {
        World.toolsList = World.server.request("tools/list", StdioServer.JSON.createObjectNode());
        assertTrue(World.toolsList.has("result"), World.toolsList.toString());
    }

    @Then("the server responds with {int} tools and their parameter schemas in standard MCP format")
    public void respondsWithTools(int count) {
        JsonNode tools = World.toolsList.path("result").path("tools");
        assertEquals(count, tools.size(), names(tools).toString());
        for (JsonNode tool : tools) {
            assertFalse(tool.path("name").asText().isBlank(), tool.toString());
            JsonNode schema = tool.path("inputSchema");
            assertEquals("object", schema.path("type").asText(), tool.toString());
            assertTrue(schema.path("properties").isObject() && schema.path("properties").size() > 0,
                    "parameters of " + tool.path("name").asText());
        }
    }

    @Then("the response includes all {int} tools")
    public void includesAllTools(int count) {
        JsonNode tools = World.toolsList.path("result").path("tools");
        assertEquals(count, tools.size(), names(tools).toString());
        assertEquals(Set.copyOf(Support.TOOLS), new HashSet<>(names(tools)));
    }

    @Then("each tool has a name, description, and complete input JSON schema")
    public void eachToolComplete() {
        for (JsonNode tool : World.toolsList.path("result").path("tools")) {
            String name = tool.path("name").asText();
            assertFalse(name.isBlank(), tool.toString());
            assertFalse(tool.path("description").asText().isBlank(), "description of " + name);
            JsonNode schema = tool.path("inputSchema");
            assertEquals("object", schema.path("type").asText(), name);
            JsonNode properties = schema.path("properties");
            assertTrue(properties.isObject() && properties.size() > 0, "properties of " + name);
            for (Iterator<Map.Entry<String, JsonNode>> it = properties.fields(); it.hasNext();) {
                Map.Entry<String, JsonNode> p = it.next();
                assertFalse(p.getValue().path("type").asText().isBlank(), name + "." + p.getKey() + " has no type");
                assertFalse(p.getValue().path("description").asText().isBlank(),
                        name + "." + p.getKey() + " has no description");
            }
            JsonNode required = schema.path("required");
            assertTrue(required.isArray() && required.size() > 0, "required of " + name);
            assertTrue(required.toString().contains("\"projectPath\""), name + " must require projectPath");
            for (JsonNode r : required) {
                assertTrue(properties.has(r.asText()), name + " requires undeclared " + r);
            }
        }
    }

    // ---- TS-017 ----------------------------------------------------------------------------------------------

    @Given("^the user configures the agent integration file \\(e\\.g\\., \"([^\"]+)\"\\)$")
    public void configureAgentFile(String fileName) throws IOException {
        // The documented integration file shipped with the engine, pointed at this artifact.
        JsonNode template = Support.readJson(Support.engineRoot().resolve("mcp-config.example.json"));
        JsonNode servers = template.path("mcpServers");
        assertTrue(servers.isObject() && servers.size() > 0, "mcp-config.example.json declares no server");
        ObjectNode config = template.deepCopy();
        for (JsonNode server : config.path("mcpServers")) {
            ArrayNode args = (ArrayNode) server.path("args");
            for (int i = 0; i < args.size(); i++) {
                if (args.get(i).asText().endsWith(".jar")) {
                    args.set(i, StdioServer.JSON.getNodeFactory().textNode(Support.jar().toString()));
                }
            }
        }
        World.agentConfig = Support.newDir("agent-").resolve(fileName);
        Files.writeString(World.agentConfig, StdioServer.JSON.writerWithDefaultPrettyPrinter()
                .writeValueAsString(config), StandardCharsets.UTF_8);
    }

    @When("the LLM agent starts")
    public void agentStarts() {
        // Minimal MCP host: reads the integration file and connects to every stdio server it declares.
        JsonNode config = Support.readJson(World.agentConfig);
        for (Iterator<Map.Entry<String, JsonNode>> it = config.path("mcpServers").fields(); it.hasNext();) {
            Map.Entry<String, JsonNode> entry = it.next();
            JsonNode declared = entry.getValue();
            assertEquals("stdio", declared.path("type").asText("stdio"), entry.getKey());
            List<String> command = new ArrayList<>();
            String executable = declared.path("command").asText();
            command.add("java".equals(executable) ? Support.java() : executable);
            declared.path("args").forEach(a -> command.add(a.asText()));
            StdioServer server = StdioServer.launch(command, World.agentConfig.getParent(), Map.of());
            World.ownServer = server;
            World.discovered.put(entry.getKey(), server.initialize());
            World.discoveredTools.put(entry.getKey(),
                    server.request("tools/list", StdioServer.JSON.createObjectNode()).path("result"));
        }
    }

    @Then("it automatically discovers the server and its capabilities without additional configuration")
    public void discoversServer() {
        assertEquals(1, World.discovered.size(), World.discovered.keySet().toString());
        JsonNode init = World.discovered.values().iterator().next();
        assertEquals(SERVER_NAME, init.path("serverInfo").path("name").asText(), init.toString());
        assertTrue(init.path("capabilities").has("tools"), init.toString());
        JsonNode tools = World.discoveredTools.values().iterator().next().path("tools");
        assertEquals(Set.copyOf(Support.TOOLS), new HashSet<>(names(tools)));
    }

    // ---- TS-018 ----------------------------------------------------------------------------------------------

    @Given("the updated JAR file")
    @Given("the updated JAR")
    public void updatedJar() throws IOException {
        Path jar = Support.jar();
        assertTrue(Files.isRegularFile(jar), jar.toString());
        try (JarFile file = new JarFile(jar.toFile())) {
            assertNotNull(file.getManifest(), "jar without manifest");
            assertEquals(Support.assemblyMainClass(), file.getManifest().getMainAttributes().getValue("Main-Class"));
        }
    }

    @When("executed with CLI arguments")
    public void executedWithCliArguments() {
        Path project = Support.demo("java-standar");
        World.cliOut = Support.newDir("ts018-cli-");
        World.run = Support.run(Support.jarCommand(List.of(project.toString(),
                World.cliOut.resolve("output.json").toString())), World.cliOut, Duration.ofMinutes(5));
    }

    @Then("it runs in CLI mode")
    public void runsInCliMode() {
        assertEquals(0, World.run.exitCode(), World.run.all());
        for (String document : Support.DOCUMENTS) {
            Path file = World.cliOut.resolve(document);
            assertTrue(Files.isRegularFile(file), document + " not written by the CLI");
            Support.readJson(file);
        }
        assertTrue(Support.readJson(World.cliOut.resolve("output.json")).path("components").size() > 0);
        assertFalse(World.run.stdout().contains("\"jsonrpc\""), "CLI mode must not speak JSON-RPC");
    }

    @When("executed with MCP mode argument")
    public void executedWithMcpArgument() {
        World.outputDir = Support.newDir("ts018-mcp-");
        World.ownServer = StdioServer.launch(Support.serverCommand(), World.outputDir, Map.of());
    }

    @Then("it runs in MCP server mode")
    public void runsInMcpMode() {
        JsonNode init = World.ownServer.initialize();
        assertEquals(SERVER_NAME, init.path("serverInfo").path("name").asText(), init.toString());
        JsonNode pong = World.ownServer.request("ping", null, Duration.ofSeconds(30));
        assertTrue(pong.has("result"), pong.toString());
        assertTrue(World.ownServer.isAlive(), "server mode keeps running until stdin closes");
        assertStdoutIsProtocolOnly(World.ownServer);
        try (var files = Files.list(World.outputDir)) {
            assertEquals(0, files.count(), "server mode must not write CLI outputs");
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // ---- helpers ---------------------------------------------------------------------------------------------

    static List<String> names(JsonNode tools) {
        List<String> names = new ArrayList<>();
        tools.forEach(t -> names.add(t.path("name").asText()));
        return names;
    }

    private static void assertStdoutIsProtocolOnly(StdioServer server) {
        List<String> lines = server.stdoutLines();
        assertFalse(lines.isEmpty());
        for (String line : lines) {
            if (line.isBlank()) {
                continue;
            }
            JsonNode message = Support.parse(line);
            assertEquals("2.0", message.path("jsonrpc").asText(), "non JSON-RPC output on stdout: " + line);
        }
    }

    private static int requiredJavaRelease() {
        Matcher m = Pattern.compile("<maven\\.compiler\\.source>(\\d+)</maven\\.compiler\\.source>")
                .matcher(Support.read(Support.engineRoot().resolve("pom.xml")));
        assertTrue(m.find(), "pom.xml declares no maven.compiler.source");
        return Integer.parseInt(m.group(1));
    }
}
