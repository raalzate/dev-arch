package com.extractor.inference;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Namespace domains of components (023, FR-020/FR-030).
 *
 * <p>The domain of a component is its namespace (id without the simple name)
 * minus the prefix common to the whole graph. The domain of a group is the
 * longest segment prefix shared by more than half of its members, up to two
 * segments; ties are broken by ordinal order.</p>
 */
public final class DomainNames {

    /** Domain of components without namespace. */
    public static final String GLOBAL = "(global)";

    /** Maximum segments of a group domain. */
    private static final int MAX_SEGMENTS = 2;

    private DomainNames() {
    }

    /**
     * Namespace segments common to every id of the graph (never the whole id).
     *
     * @param allIds every component id
     * @return the common prefix segments (possibly empty)
     */
    public static List<String> commonPrefix(final Collection<String> allIds) {
        List<String> prefix = null;
        for (String id : allIds) {
            List<String> ns = namespace(id);
            if (ns.isEmpty()) {
                continue; // components without namespace do not shorten the prefix
            }
            if (prefix == null) {
                prefix = new ArrayList<>(ns);
                continue;
            }
            int n = 0;
            while (n < prefix.size() && n < ns.size() && prefix.get(n).equals(ns.get(n))) {
                n++;
            }
            prefix = new ArrayList<>(prefix.subList(0, n));
            if (prefix.isEmpty()) {
                break;
            }
        }
        if (prefix == null) {
            return List.of();
        }
        // A single-component graph keeps its last segment as the domain.
        long qualified = allIds.stream().filter(id -> !namespace(id).isEmpty()).count();
        if (qualified == 1 && !prefix.isEmpty()) {
            prefix = prefix.subList(0, prefix.size() - 1);
        }
        return List.copyOf(prefix);
    }

    /**
     * First domain segment of a component after the common prefix.
     *
     * @param id     component id
     * @param prefix common prefix of the graph
     * @return the domain segment, or {@value #GLOBAL}
     */
    public static String domainOf(final String id, final List<String> prefix) {
        List<String> rest = rest(namespace(id), prefix);
        return rest.isEmpty() ? GLOBAL : rest.get(0);
    }

    /**
     * Domain of a group of members.
     *
     * @param members member ids
     * @param prefix  common prefix of the graph
     * @return up to two segments joined by '.', {@value #GLOBAL} when every
     *         member lacks a namespace, or null when no segment reaches half
     *         of the members
     */
    public static String domain(final Collection<String> members, final List<String> prefix) {
        List<List<String>> rests = new ArrayList<>();
        for (String m : members) {
            rests.add(rest(namespace(m), prefix));
        }
        if (rests.stream().allMatch(List::isEmpty)) {
            return members.isEmpty() ? null : GLOBAL;
        }
        List<List<String>> candidates = rests.stream().filter(r -> !r.isEmpty()).toList();
        List<String> chosen = new ArrayList<>();
        for (int depth = 0; depth < MAX_SEGMENTS; depth++) {
            Map<String, Integer> counts = new LinkedHashMap<>();
            for (List<String> r : candidates) {
                if (r.size() > depth && r.subList(0, depth).equals(chosen)) {
                    counts.merge(r.get(depth), 1, Integer::sum);
                }
            }
            String best = null;
            int bestCount = 0;
            for (Map.Entry<String, Integer> e : counts.entrySet()) {
                if (e.getValue() > bestCount
                        || (e.getValue() == bestCount && best != null && e.getKey().compareTo(best) < 0)) {
                    best = e.getKey();
                    bestCount = e.getValue();
                }
            }
            if (best == null || bestCount * 2 <= candidates.size()) {
                break;
            }
            chosen.add(best);
        }
        return chosen.isEmpty() ? null : String.join(".", chosen);
    }

    private static List<String> namespace(final String id) {
        int dot = id.lastIndexOf('.');
        return dot < 0 ? List.of() : Arrays.asList(id.substring(0, dot).split("\\."));
    }

    private static List<String> rest(final List<String> ns, final List<String> prefix) {
        int n = 0;
        while (n < prefix.size() && n < ns.size() && prefix.get(n).equals(ns.get(n))) {
            n++;
        }
        return ns.subList(n, ns.size());
    }
}
