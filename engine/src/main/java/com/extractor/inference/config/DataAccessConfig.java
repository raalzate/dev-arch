package com.extractor.inference.config;

/**
 * Data access parameters (020-stored-procedures, contracts/inference-config-dataaccess.md).
 *
 * @param procedures       stored procedure detection in the .NET analyzer: {@code auto} (Visual Basic only),
 *                         {@code on} or {@code off}
 * @param procedureCatalog directory of SQL scripts or CSV file translating procedures to tables, or null
 * @param catalogMode      {@code complement} (tables plus {@code sp:}) or {@code replace} (tables only)
 * @param procedureWeight  weight of an {@code sp:} resource relative to a table ({@code 0} ignores procedures)
 * @param entityHeuristic  derive a business entity from procedure names for proposal naming
 */
public record DataAccessConfig(String procedures, String procedureCatalog,
        String catalogMode, double procedureWeight, boolean entityHeuristic) {

    public static final String AUTO = "auto";
    public static final String ON = "on";
    public static final String OFF = "off";
    public static final String COMPLEMENT = "complement";
    public static final String REPLACE = "replace";

    /**
     * Whether the .NET analyzer needs the section (anything other than the defaults understood by the analyzer).
     *
     * @return true when the analyzer must receive a configuration file
     */
    public boolean affectsAnalyzer() {
        DataAccessConfig defaults = InferenceConfig.defaults().dataAccess();
        return !AUTO.equals(procedures) && !defaults.procedures().equals(procedures)
                || procedureCatalog != null && !procedureCatalog.isBlank()
                || !defaults.catalogMode().equals(catalogMode);
    }
}
