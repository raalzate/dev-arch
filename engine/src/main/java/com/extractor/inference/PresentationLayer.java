package com.extractor.inference;

import com.extractor.model.Component;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Presentation members of the legacy desktop profile (023, FR-010): components
 * annotated {@code Layer:Presentación} or {@code Layer:Reportes} by the .NET
 * analyzer (021). When {@code inference.presentationInCohesion} is false they
 * stay members and consumers but do not count in cohesion or internal density,
 * unless every member is presentation.
 */
public final class PresentationLayer {

    /** Fine-layer annotations of presentation components (021). */
    public static final List<String> ANNOTATIONS =
            List.of("Layer:Presentación", "Layer:Reportes");

    private PresentationLayer() {
    }

    /**
     * Whether a component is a presentation component.
     *
     * @param c the component (null = false)
     * @return true for forms, controls and reports
     */
    public static boolean isPresentation(final Component c) {
        return c != null && c.getAnnotations() != null
                && c.getAnnotations().stream().anyMatch(ANNOTATIONS::contains);
    }

    /**
     * The members that count for cohesion.
     *
     * @param members      member ids
     * @param byId         components by id
     * @param includeAll   {@code inference.presentationInCohesion}
     * @return {@code members} when all count, otherwise the non-presentation ones
     *         (or all of them when none would remain)
     */
    public static Set<String> cohesionMembers(final Collection<String> members,
            final Map<String, Component> byId, final boolean includeAll) {
        Set<String> all = members instanceof Set<String> set ? set
                : members.stream().collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        if (includeAll) {
            return all;
        }
        Set<String> kept = all.stream().filter(m -> !isPresentation(byId.get(m)))
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        return kept.isEmpty() ? all : kept;
    }
}
