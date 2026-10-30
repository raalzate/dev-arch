package com.extractor.inference;

import com.extractor.inference.config.DataAccessConfig;
import com.extractor.model.Component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

/**
 * Data resources of a component for the inference (020-stored-procedures, research D7): tables weigh 1.0,
 * {@code sp:} procedures weigh {@code dataAccess.procedureWeight} and are omitted when that weight is 0. Shared
 * resource lists are ordered tables first, then procedures, each group in ordinal order.
 */
public final class DataResources {

    /** Prefix of a stored procedure entry in {@code tables_used}. */
    public static final String PROCEDURE_PREFIX = "sp:";

    private DataResources() {
    }

    /**
     * Whether an entry of {@code tables_used} is a stored procedure.
     *
     * @param resource the entry
     * @return true for {@code sp:} entries
     */
    public static boolean isProcedure(final String resource) {
        return resource != null && resource.startsWith(PROCEDURE_PREFIX);
    }

    /**
     * Weight of a resource relative to a table.
     *
     * @param resource   the entry
     * @param dataAccess data access parameters
     * @return 1.0 for tables, the procedure weight for procedures
     */
    public static double weight(final String resource, final DataAccessConfig dataAccess) {
        return isProcedure(resource) ? dataAccess.procedureWeight() : 1.0;
    }

    /**
     * Resources of a component that take part in the inference, in the order of {@code tables_used}.
     *
     * @param component  the component
     * @param dataAccess data access parameters
     * @return tables and, when their weight is positive, procedures
     */
    public static List<String> of(final Component component, final DataAccessConfig dataAccess) {
        List<String> resources = new ArrayList<>();
        if (component.getTablesUsed() == null) {
            return resources;
        }
        for (String resource : component.getTablesUsed()) {
            if (resource == null || resource.isBlank()) {
                continue;
            }
            if (isProcedure(resource) && !(dataAccess.procedureWeight() > 0)) {
                continue;
            }
            resources.add(resource);
        }
        return resources;
    }

    /**
     * Orders shared resources for the output: the tables keep the given order (as before 020, so existing outputs
     * do not change), the procedures follow in ordinal order.
     *
     * @param resources shared resources
     * @return the ordered list
     */
    public static List<String> ordered(final Collection<String> resources) {
        List<String> tables = new ArrayList<>();
        List<String> procedures = new ArrayList<>();
        for (String resource : resources) {
            if (isProcedure(resource)) {
                procedures.add(resource);
            } else {
                tables.add(resource);
            }
        }
        procedures.sort(String::compareTo);
        tables.addAll(procedures);
        return tables;
    }
}
