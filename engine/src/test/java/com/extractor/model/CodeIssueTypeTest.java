package com.extractor.model;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** BUG-010 (022): the Java model must accept every issue type the .NET analyzer emits. */
class CodeIssueTypeTest {

    @Test
    void dependencyTypeDeserializes() throws Exception {
        CodeIssue issue = new ObjectMapper().readValue(
                "{\"type\":\"DEPENDENCY\",\"severity\":\"WARNING\",\"message\":\"EOL\",\"line\":0,\"pattern\":\"EOL_DEPENDENCY\"}",
                CodeIssue.class);
        assertEquals(CodeIssue.Type.DEPENDENCY, issue.getType());
    }
}
