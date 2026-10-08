package com.extractor.mcp;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * [006 TS-034] The MCP server reports the product version: serverInfo.version comes from the Maven-filtered
 * resource {@code static-inference-version.properties} (version=${project.version}), never from a literal, and
 * {@code project.version} is written by {@code scripts/version.sh sync} from the product VERSION file.
 */
class McpServerVersionTest {

    private static String projectVersion() {
        String version = System.getProperty("project.version");
        assertNotNull(version, "surefire must pass project.version");
        assertFalse(version.isBlank());
        return version;
    }

    @Test
    void versionResourceIsFilteredWithTheProjectVersion() throws IOException {
        Properties props = new Properties();
        try (InputStream in = McpServerMain.class.getResourceAsStream("/static-inference-version.properties")) {
            assertNotNull(in, "static-inference-version.properties is missing from the classpath");
            props.load(in);
        }
        assertEquals(projectVersion(), props.getProperty("version"));
    }

    @Test
    void serverInfoVersionEqualsTheProjectVersion() {
        assertEquals(projectVersion(), McpServerMain.serverVersion());
    }
}
