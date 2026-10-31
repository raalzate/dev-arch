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

    /**
     * Camel-case tokens of an entity name without verbs ({@code PolicyGetPremiumDetail} → Policy, Premium, Detail).
     *
     * @param entity entity name
     * @return its tokens (empty for null)
     */
    public static List<String> tokens(final String entity) {
        List<String> tokens = new ArrayList<>();
        if (entity == null) {
            return tokens;
        }
        for (String token : CAMEL.split(entity)) {
            if (!token.isBlank() && !VERBS.contains(token.toLowerCase(Locale.ROOT))) {
                tokens.add(token);
            }
        }
        return tokens;
    }

    /**
     * Entity stem of every procedure-bearing component (023): the dominant entity of the
     * component is tokenized without verbs; when one first token leads at least half of the
     * entities of the corpus ({@code Policy}) it is the corpus prefix and the stem is the next
     * token ({@code Premium}); otherwise the stem is the first token. Deterministic.
     *
     * @param components the components of the graph
     * @return component id → stem, only for components with an entity
     */
    /**
     * Corpus prefix of the procedure entities (023): the first token leading at least half of the
     * entities of the components, or null.
     *
     * @param components the components of the graph
     * @return the prefix token or null
     */
    public static String corpusPrefix(final Collection<Component> components) {
        Map<String, Integer> firstCounts = new TreeMap<>();
        int total = 0;
        for (Component c : components) {
            List<String> tokens = tokens(dominantEntity(List.of(c)));
            if (tokens.isEmpty()) {
                continue;
            }
            total++;
            firstCounts.merge(tokens.get(0), 1, Integer::sum);
        }
        String prefix = null;
        int prefixCount = 0;
        for (Map.Entry<String, Integer> e : firstCounts.entrySet()) {
            if (e.getValue() > prefixCount) {
                prefix = e.getKey();
                prefixCount = e.getValue();
            }
        }
        return prefixCount * 2 >= total && total > 0 ? prefix : null;
    }

    /**
     * Stem of an entity-like name ({@code PolicyPremiumDetail} with prefix {@code Policy} → {@code Premium}).
     *
     * @param name   entity or simple class name
     * @param prefix corpus prefix or null
     * @return the stem, or null when the name has no tokens
     */
    public static String stemOf(final String name, final String prefix) {
        List<String> tokens = tokens(name);
        if (tokens.isEmpty()) {
            return null;
        }
        if (prefix != null && prefix.equals(tokens.get(0)) && tokens.size() > 1) {
            return tokens.get(1);
        }
        return tokens.get(0);
    }

    public static Map<String, String> stems(final Collection<Component> components) {
        Map<String, List<String>> tokensById = new java.util.LinkedHashMap<>();
        Map<String, Integer> firstCounts = new TreeMap<>();
        for (Component c : components) {
            List<String> tokens = tokens(dominantEntity(List.of(c)));
            if (tokens.isEmpty()) {
                continue;
            }
            tokensById.put(c.getId(), tokens);
            firstCounts.merge(tokens.get(0), 1, Integer::sum);
        }
        String prefix = null;
        int prefixCount = 0;
        for (Map.Entry<String, Integer> e : firstCounts.entrySet()) {
            if (e.getValue() > prefixCount) {
                prefix = e.getKey();
                prefixCount = e.getValue();
            }
        }
        if (prefixCount * 2 < tokensById.size()) {
            prefix = null;
        }
        Map<String, String> stems = new java.util.LinkedHashMap<>();
        for (Map.Entry<String, List<String>> e : tokensById.entrySet()) {
            List<String> tokens = e.getValue();
            String stem = tokens.get(0);
            if (prefix != null && prefix.equals(tokens.get(0)) && tokens.size() > 1) {
                stem = tokens.get(1);
            }
            stems.put(e.getKey(), stem);
        }
        return stems;
    }
}
