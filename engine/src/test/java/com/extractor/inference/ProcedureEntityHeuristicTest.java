package com.extractor.inference;

import com.extractor.model.Component;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/** 020 T018: entity deduced from stored procedure names (opt-in naming aid). */
class ProcedureEntityHeuristicTest {

    @ParameterizedTest
    @CsvSource({
        "AMPsp_Policy_Read, Policy",
        "usp_GetPolicy, Policy",
        "usp_Policy_Holder_Update, PolicyHolder",
        "sp:usp_Policy_Read, Policy",
        "Totals, Totals",
        "usp_policy_read, Policy"
    })
    void entityOf(String procedure, String entity) {
        assertEquals(entity, ProcedureEntityHeuristic.entityOf(procedure));
    }

    @Test
    void verbsOnlyAndBlankYieldNothing() {
        assertNull(ProcedureEntityHeuristic.entityOf("sp_Save"));
        assertNull(ProcedureEntityHeuristic.entityOf("usp_Get"));
        assertNull(ProcedureEntityHeuristic.entityOf(""));
        assertNull(ProcedureEntityHeuristic.entityOf(null));
    }

    @Test
    void dominantEntityIsTheMostFrequentWithOrdinalTies() {
        Component a = new Component("A");
        a.setTablesUsed(List.of("sp:usp_Policy_Read", "sp:usp_GetPolicy", "sp:usp_Claim_Read", "Orders"));
        Component b = new Component("B");
        b.setTablesUsed(List.of("sp:usp_Claim_Save"));
        assertEquals("Claim", ProcedureEntityHeuristic.dominantEntity(List.of(a, b)));
        assertNull(ProcedureEntityHeuristic.dominantEntity(List.of(new Component("C"))));
    }
}
