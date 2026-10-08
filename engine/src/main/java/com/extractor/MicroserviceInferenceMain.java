package com.extractor;

import com.extractor.mcp.McpServerMain;
import com.extractor.service.AnalysisLanguage;
import com.extractor.service.AnalysisOptions;
import com.extractor.service.AnalysisProgressListener;
import com.extractor.service.AnalysisResult;
import com.extractor.service.AnalysisService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;

import java.io.FileWriter;
import java.nio.charset.StandardCharsets;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * CLI adapter — delegates all analysis to AnalysisService (Constitution II).
 * Detects --mcp flag to start MCP server mode (FR-001).
 * Produces identical output to the pre-refactor version (Constitution I).
 */
public class MicroserviceInferenceMain {

    public static void main(String[] args) {
        // MCP mode: java -jar tool.jar --mcp
        if (args.length >= 1 && "--mcp".equals(args[0])) {
            McpServerMain.start();
            return;
        }

        if (args.length < 2) {
            System.err.println("Uso: java MicroserviceInferenceMain <ruta-proyecto> <archivo-salida>");
            System.err.println("     java MicroserviceInferenceMain --mcp");
            System.err.println("Ejemplo: java MicroserviceInferenceMain /path/to/project output.json");
            System.err.println("         java MicroserviceInferenceMain --mcp  (inicia servidor MCP via stdio)");
            System.err.println();
            System.err.println("Supported project types:");
            System.err.println("  - Java (Maven/Gradle) — analyzed via Spoon");
            System.err.println("  - .NET (C#/.sln/.csproj) — analyzed via Roslyn bridge");
            System.err.println("  Project type is auto-detected from directory marker files.");
            System.exit(1);
        }

        String projectPath = args[0];
        String outputFile = args[1];
        AnalysisOptions options;
        try {
            options = parseOptions(args);
        } catch (IllegalArgumentException e) {
            System.err.println(e.getMessage());
            System.exit(1);
            return;
        }

        try {
            System.out.println("🔍 Iniciando análisis del proyecto: " + projectPath);

            Path projectPathObj = Paths.get(projectPath);
            AnalysisService service = new AnalysisService();
            AnalysisResult result = service.analyzeProject(projectPathObj,
                    options, AnalysisProgressListener.NOOP);

            System.out.println("📊 Componentes encontrados: " + result.getComponentCount());
            System.out.println("🔗 Relaciones encontradas: " + result.getEdgeCount());

            ObjectMapper mapper = new ObjectMapper();
            mapper.enable(SerializationFeature.INDENT_OUTPUT);
            mapper.enable(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS);

            // Save dependency graph
            String graphJson = mapper.writeValueAsString(result.getDependencyGraph());
            saveToFile(graphJson, outputFile);
            System.out.println("✅ Grafo de dependencias guardado en: " + outputFile);

            // Save architecture proposal
            System.out.println("\n🧠 Ejecutando motor de inferencias...");
            System.out.println("🎯 Clusters generados: " + result.getArchitecture().getProposals().size());

            System.out.println("\n🏗️ Generando propuesta de arquitectura consolidada...");
            String architectureFile = outputFile.replace(".json", "_architecture.json");
            String architectureJson = mapper.writeValueAsString(result.getArchitecture());
            saveToFile(architectureJson, architectureFile);
            System.out.println("✅ Propuesta de arquitectura guardada en: " + architectureFile);

            // Save API contracts
            System.out.println("\n🌐 Exportando entrypoints (API Contracts)...");
            String entrypointsFile = outputFile.replace(".json", "_entrypoints.json");
            String entrypointsJson = mapper.writeValueAsString(result.getApiContracts());
            saveToFile(entrypointsJson, entrypointsFile);
            System.out.println("✅ Entrypoints guardados en: " + entrypointsFile);

            // Print summary
            System.out.println("\n" + result.getArchitecture().getSummary());

            // 007 FR-026: warnings on the error output, outputs unchanged
            for (String warning : result.getWarnings()) {
                System.err.println("[warning] " + warning);
            }

        } catch (Exception e) {
            System.err.println("❌ Error durante el análisis: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }

    /**
     * Optional third argument {@code --language=java|dotnet|auto}
     * (007-native-engine-runtime, FR-024).
     *
     * @param args command-line arguments
     * @return the analysis options
     */
    static AnalysisOptions parseOptions(final String[] args) {
        String prefix = "--language=";
        if (args.length > 2 && args[2].startsWith(prefix)) {
            return AnalysisOptions.of(AnalysisLanguage.parse(
                    args[2].substring(prefix.length())));
        }
        return AnalysisOptions.DEFAULT;
    }

    private static void saveToFile(String content, String filePath) throws IOException {
        try (FileWriter writer = new FileWriter(filePath, StandardCharsets.UTF_8)) {
            writer.write(content);
        }
    }
}
