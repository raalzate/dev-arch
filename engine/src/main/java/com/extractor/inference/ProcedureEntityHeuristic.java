package com.extractor.inference;

/**
 * Business entity deduced from a stored procedure name (020-stored-procedures, research D8). Opt-in
 * ({@code dataAccess.entityHeuristic}); used only to name proposals, never to emit tables.
 */
public final class ProcedureEntityHeuristic {

    private ProcedureEntityHeuristic() {
    }

    /**
     * Entity of a procedure name, or null when the name has no recognizable structure.
     *
     * @param procedureName canonical procedure name (without the {@code sp:} prefix)
     * @return the entity in PascalCase, or null
     */
    public static String entityOf(final String procedureName) {
        return null; // T018 implements the rule; stub keeps the 020 engine scenarios compilable and red.
    }
}
