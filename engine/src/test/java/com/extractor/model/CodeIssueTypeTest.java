package com.extractor.model;

import com.extractor.testsupport.ProductLayout;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * BUG-010 (022): the issue types and severities the Java model accepts are exactly the closed enums of the
 * 1.0.0 contract, so every .NET-emitted value (and only those) round-trips.
 */
class CodeIssueTypeTest {

    @Test
    void javaEnumsMatchTheContract() throws Exception {
        Path schema = ProductLayout.get().productRoot().resolve("schema/1.0.0/common.schema.json");
        JsonNode issue = new ObjectMapper().readTree(schema.toFile()).get("$defs").get("CodeIssue").get("properties");
        assertEquals(names(issue.get("type").get("enum")), sorted(CodeIssue.Type.values()));
        assertEquals(names(issue.get("severity").get("enum")), sorted(CodeIssue.Severity.values()));
    }

    private static List<String> names(JsonNode array) {
        List<String> list = new ArrayList<>();
        array.forEach(n -> list.add(n.asText()));
        return list.stream().sorted().toList();
    }

    private static List<String> sorted(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).sorted().toList();
    }
}
