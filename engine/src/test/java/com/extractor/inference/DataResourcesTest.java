package com.extractor.inference;

import com.extractor.inference.config.DataAccessConfig;
import com.extractor.inference.config.InferenceConfig;
import com.extractor.model.Component;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** 020 T015: weighted data resources. */
class DataResourcesTest {

    private static Component component(String... tables) {
        Component c = new Component("Sample.X");
        c.setTablesUsed(List.of(tables));
        return c;
    }

    private static DataAccessConfig weight(double w) {
        DataAccessConfig d = InferenceConfig.defaults().dataAccess();
        return new DataAccessConfig(d.procedures(), d.procedureCatalog(), d.catalogMode(), w, d.entityHeuristic());
    }

    @Test
    void tablesAlwaysCountAndProceduresOnlyWithPositiveWeight() {
        Component c = component("Orders", "sp:usp_A", "Customers");
        assertEquals(List.of("Orders", "sp:usp_A", "Customers"), DataResources.of(c, weight(1.0)));
        assertEquals(List.of("Orders", "Customers"), DataResources.of(c, weight(0)));
        assertEquals(1.0, DataResources.weight("Orders", weight(0.5)));
        assertEquals(0.5, DataResources.weight("sp:usp_A", weight(0.5)));
    }

    @Test
    void orderedKeepsTablesFirstAndSortsProcedures() {
        assertEquals(List.of("zebra", "Alpha", "sp:usp_A", "sp:usp_Z"),
                DataResources.ordered(List.of("sp:usp_Z", "zebra", "Alpha", "sp:usp_A")));
    }
}
