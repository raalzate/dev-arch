package com.extractor.inference;

import com.extractor.model.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;

/**
 * Business entity deduced from a stored procedure name (020-stored-procedures, research D8). Opt-in
 * ({@code dataAccess.entityHeuristic}); used only to name proposals, never to emit tables.
 */
public final class ProcedureEntityHeuristic {

    /** Verbs removed from the start or the end of the name (spec FR-040, fixed list). */
    static final Set<String> VERBS = Set.of("get", "read", "select", "list", "insert", "add", "create",
            "update", "save", "delete", "remove", "search", "find", "exists", "count");

    private static final Pattern PREFIX = Pattern.compile("^(?:[A-Za-z]{1,8}sp_|usp_|sp_)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern CAMEL = Pattern.compile("(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])");

    private ProcedureEntityHeuristic() {
    }

    /**
     * Entity of a procedure name, or null when the name has no recognizable structure.
     *
     * @param procedureName canonical procedure name (with or without the {@code sp:} prefix)
     * @return the entity in PascalCase, or null
     */
    public static String entityOf(final String procedureName) {
        if (procedureName == null || procedureName.isBlank()) {
            return null;
        }
        String name = procedureName.startsWith(DataResources.PROCEDURE_PREFIX)
                ? procedureName.substring(DataResources.PROCEDURE_PREFIX.length()) : procedureName;
        name = PREFIX.matcher(name).replaceFirst("");
        List<String> tokens = new ArrayList<>();
        for (String part : name.split("[_\\s]+")) {
            for (String token : CAMEL.split(part)) {
                if (!token.isBlank()) {
                    tokens.add(token);
                }
            }
        }
        if (!tokens.isEmpty() && VERBS.contains(tokens.get(0).toLowerCase(Locale.ROOT))) {
            tokens.remove(0);
        }
        if (!tokens.isEmpty() && VERBS.contains(tokens.get(tokens.size() - 1).toLowerCase(Locale.ROOT))) {
            tokens.remove(tokens.size() - 1);
        }
        if (tokens.isEmpty()) {
            return null;
        }
        StringBuilder entity = new StringBuilder();
        for (String token : tokens) {
            entity.append(Character.toUpperCase(token.charAt(0))).append(token.substring(1));
        }
        return entity.toString();
    }

    /**
     * Most frequent entity of the procedures used by the components (ties: ordinal order), or null.
     *
     * @param components components of a proposal
     * @return the dominant entity, or null when no procedure yields one
     */
    public static String dominantEntity(final Collection<Component> components) {
        Map<String, Integer> counts = new TreeMap<>();
        for (Component component : components) {
            if (component == null || component.getTablesUsed() == null) {
                continue;
            }
            for (String resource : component.getTablesUsed()) {
                if (DataResources.isProcedure(resource)) {
                    String entity = entityOf(resource);
                    if (entity != null) {
                        counts.merge(entity, 1, Integer::sum);
                    }
                }
            }
        }
        String best = null;
        int bestCount = 0;
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            if (entry.getValue() > bestCount) {
                best = entry.getKey();
                bestCount = entry.getValue();
            }
        }
        return best;
    }
}
