# Research: 024
- D1 NetAnalyzers 8.0.0 trae `analyzers/dotnet/vb/Microsoft.CodeAnalysis.VisualBasic.NetAnalyzers.dll` (+ `Microsoft.CodeAnalysis.NetAnalyzers.dll`); se cargan con `AnalyzerFileReference` desde el directorio del analizador publicado (DLL copiados por el csproj). Roslynator 4.12.4 solo tiene `cs` → descartado.
- D2 Reglas activas por `SpecificDiagnosticOptions` (habilita reglas desactivadas por defecto) y filtro final a la lista versionada: la salida no depende del nivel de análisis por defecto del paquete.
- D3 Contrato 1.0.0: `CodeIssue` cerrado (`type` enum de 4, `pattern` abierto, `additionalProperties:false`) → prefijos en `message`, MI como anotación. 022 emitía `type: DEPENDENCY` (inválido) → `SECURITY`.
- D4 Código muerto por nombre (sin `SymbolFinder`, que requiere `Solution`): conservador y determinista; falsos negativos cuando otro miembro comparte nombre.
- D5 SARIF: lectura mínima 2.1.0 con `System.Text.Json`; sin dependencia nueva.
- D6 SecurityCodeScan (LGPL) excluido hasta decisión §7.6; CWE en reglas propias y de NetAnalyzers desde la lista versionada.
