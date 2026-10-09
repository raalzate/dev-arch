# Research: Cierre de VB.NET legacy

## D1 — Despacho por lenguaje sin tocar las pasadas C#

- **Decision**: pasadas VB nuevas (`Analysis/Vb/Vb*.cs`) invocadas desde `ProjectAnalyzer` solo cuando `compilation.Language == LanguageNames.VisualBasic`, después de la pasada existente equivalente.
- **Rationale**: las pasadas C# existentes recorren `Microsoft.CodeAnalysis.CSharp.Syntax` y ya son no-op sobre árboles VB (verificado: `tables_used`, `code_issues` vacíos y métricas nulas en el fixture VB de 004). No modificarlas hace verificable el principio I por diff. `InvocationAnalyzer` y `DependencyInjectionAnalyzer` ya usan este patrón (004).
- **Alternatives**: (a) ramificar dentro de cada clase existente por lenguaje — mezcla código C# y VB en archivos con aserciones C# y aumenta el riesgo de regresión; (b) abstraer un "walker" común sobre `IOperation` — más elegante pero cambia el comportamiento C# (los conteos C# están basados en sintaxis).

## D2 — Atribución de nodos a componentes VB

- **Decision**: `VbTypeIndex` construye `id → TypeBlockSyntax[]` con `SemanticModel.GetDeclaredSymbol(typeBlock)` y el mismo cálculo de nombre totalmente calificado que `TypeAnalyzer` (namespaces + nombre simple); cada nodo pertenece al `TypeBlockSyntax` ancestro más interno.
- **Rationale**: los ids deben coincidir exactamente con los de `TypeAnalyzer`; la atribución al bloque más interno evita contar dos veces en tipos anidados.
- **Alternatives**: recorrido completo del bloque como en C# (cuenta los nodos de tipos anidados también en el contenedor) — descartado para VB por claridad; C# no cambia.

## D3 — Directorio del proyecto VB

- **Decision**: ancestro común de las rutas de los árboles; si no contiene `*.vbproj`, se sube hasta 3 niveles buscando uno; si no aparece, se usa el ancestro común.
- **Rationale**: la compilación no conserva la ruta del `.vbproj` (MSBuild y Adhoc); los archivos de configuración y `.xsd` viven en el directorio del proyecto. El límite de 3 niveles evita tomar un `.vbproj` ajeno de un ancestro lejano.
- **Alternatives**: transportar la ruta del proyecto junto a cada compilación — exige cambiar la firma interna de carga que también usa C#.

## D4 — Reconocimiento de SQL literal

- **Decision**: plegar concatenaciones de literales (`&`, `+`, cadenas interpoladas) a un texto con marcador `\u0001` para partes no literales; aplicar una gramática estricta por sentencia (data-model §SQL) que exige la estructura completa (`SELECT <lista> FROM`, `INSERT INTO t (`/`VALUES`/`SELECT`, `UPDATE t SET`, `DELETE FROM t` seguido de fin/`WHERE`/`;`, `MERGE [INTO] t … USING`) y rechaza listas de selección con aspecto de frase (dos palabras sueltas sin coma, punto, paréntesis, `*`, `AS`, `TOP`, `DISTINCT`).
- **Rationale**: el perfil legacy concentra el SQL en literales (`New SqlCommand("…")`, `.CommandText = "…"`, `Dim sql As String = "…"`); sin flujo de datos, seguir la variable hasta el comando no es viable. La gramática estricta evita falsos positivos en mensajes de usuario (`"Select a customer from the list"`).
- **Alternatives**: (a) solo literales en sumideros ADO.NET (argumentos de `*Command`/`*DataAdapter`, `CommandText`) — pierde el patrón `Dim sql = "…"` muy común; (b) un parser SQL completo (dependencia nueva, principio VI) — desproporcionado.
- **Limitaciones**: SQL incremental (`sql = sql & …`), `StringBuilder`, CTE (`WITH`), joins con coma (`FROM a, b` → solo `a`), SQL dinámico de procedimientos almacenados.

## D5 — DataSets tipados

- **Decision**: leer cada `*.xsd` del proyecto con `System.Xml` (sin resolver DTD ni entidades externas): elementos `TableAdapter` (atributos `Name`, `DataAccessorName`/`GeneratorDataComponentClassName`) y su `DbSource` (`DbObjectName`, `CommandText`); tablas tipadas por `msprop:Generator_TableClassName` del `xs:element`. Un componente que referencia un identificador igual (sin distinguir mayúsculas) a la clase del adaptador o de la tabla tipada recibe la tabla asociada: `DbObjectName` normalizado → tablas del `CommandText` → `Name`.
- **Rationale**: el código generado (`*.Designer.vb`) está excluido por FR-010 de 004, así que la única fuente fiable es el `.xsd`; el uso desde código se hace por esos nombres de clase.
- **Alternatives**: incluir los `Designer.vb` del DataSet — contradice FR-010/FR-012 de 004.

## D6 — Enlace tardío

- **Decision**: `SemanticModel.GetOperation(node)` sobre `MemberAccessExpressionSyntax`, `InvocationExpressionSyntax` y `ObjectCreationExpressionSyntax`; los tipos `OperationKind.DynamicMemberReference`, `DynamicInvocation`, `DynamicIndexerAccess`, `DynamicObjectCreation` indican enlace tardío; además `CreateObject(...)`/`GetObject(...)` por nombre. Un issue por línea.
- **Rationale**: verificado en prototipo (Roslyn 4.9.2, compilación Adhoc con `OptionStrict` por defecto `Off`): `o.Visible`, `o.Workbooks.Add()` y `o.Name` sobre `Dim o As Object` producen operaciones dinámicas; accesos sobre tipos no resueltos producen `Invalid` (sin falsos positivos).
- **Alternatives**: heurística sintáctica sobre variables `As Object` — muchos falsos negativos/positivos.

## D7 — Capas de escritorio sin cambiar el catálogo

- **Decision**: formularios y reportes → `Web` (capa de presentación del catálogo cerrado); servicios web → `Controlador`; acceso a datos → `Datos`; módulos sin otra evidencia → `Compartida`; orden FR-040; solo componentes VB; interfaces intactas.
- **Rationale**: el contrato 1.0.0 cierra la enumeración `layer` (`Controlador`, `Negocio`, `Datos`, `Persistencia`, `Dominio`, `Transferencia`, `Web`, `Compartida`); añadir "Presentación"/"Reportes" sería un cambio de contrato (prohibido sin versionado). El motor Java no usa `layer` en la inferencia (verificado: sin consumidores de `getLayer()` fuera del modelo).
- **Alternatives**: `Controlador` para formularios (contradice FR-020 de 004: solo con evidencia HTTP); nuevo valor de enumeración (cambio de contrato).
- **Estado**: default elegido por agente — confirmado por usuario 2026-10-09.

## D8 — Endpoints ASMX/WCF

- **Decision**: detección sintáctica (atributos `WebService`/`WebMethod`/`ServiceContract`/`OperationContract`/`WebGet`/`WebInvoke` por nombre simple con o sin sufijo `Attribute` y calificación; `Inherits WebService` por nombre simple) + símbolos de la compilación para enlazar implementaciones (`AllInterfaces`), con respaldo por nombre en `Implements`. Rutas `/<Clase>.asmx/<Método>` y `/<Clase>.svc/<Operación|plantilla>`.
- **Rationale**: fuera de Windows `System.Web.Services` y `System.ServiceModel` no se resuelven; los atributos siguen siendo sintaxis. La ruta pública de ASMX/WCF depende del archivo `.asmx`/`.svc`, que por convención se llama como la clase.
- **Alternatives**: leer `.asmx`/`.svc` para el nombre exacto — mejora marginal; queda como mejora futura.
- **Estado**: tipos soportados (ASMX + WCF; no páginas WebForms) — default elegido por agente — confirmado por usuario 2026-10-09.

## D9 — Runner BDD .NET

- **Decision**: `Reqnroll.xUnit` 2.0.3 en `DotNetAnalyzer.Tests`. Los `.feature` se enlazan desde `specs/009-vb-legacy-completion/tests/features/` con `ReqnrollFeatureFiles` y metadato `CodeBehindFile` en `obj/ReqnrollFeatures/`; un target `AfterTargets="UpdateFeatureFilesInProject"` mueve el code-behind generado junto al `.feature` a `obj/` (prototipo verificado: 1/1 escenario en verde, sin archivos residuales en `specs/`). El `.feature` `@engine` del canal de advertencias se excluye de Reqnroll y corre en Cucumber-JVM.
- **Rationale**: la regla *phase-discipline* exige definiciones de pasos y runner BDD cuando existen `.feature`; Reqnroll es el sucesor de SpecFlow que reconoce `verify-steps.sh`. 2.0.3 evita subir xUnit (2.4.1+ exige xunit.core ≥ 2.8.1).
- **Alternatives**: (a) pruebas xUnit con `DisplayName TS-XXX` sin runner (precedente 002/003) — no cumple la regla; (b) proyecto de pruebas separado — exige tocar `scripts/test.sh` y CI.

## D10 — Canal de advertencias .NET → motor

- **Decision**: el analizador .NET imprime en `stderr`, después del JSON, una línea `[warning] <texto>` por advertencia de usuario; `DotNetBridgeAnalyzer` añade a `getWarnings()` (en orden, sin duplicados) el texto de cada línea de `stderr` que empieza exactamente por `[warning] `. Las líneas de diagnóstico existentes (`[WARN] …`) no cambian ni se exponen.
- **Rationale**: 007 fijó el canal (`_meta` MCP + `[warning]` en el CLI) y que `meta` del grafo no cambia (contrato 1.0.0 cerrado, sin `meta.warnings`). `meta.source` no basta para decidir: el demo C# `dotnet-unstructured` ya emite `roslyn-fallback` (verificado), así que derivar la advertencia de `meta.source` añadiría advertencias a análisis C# (FR-063).
- **Alternatives**: campo `meta.warnings` en el grafo — cambio de contrato; derivar de `meta.source` — afecta a C#.
- **Texto** (determinista, sin rutas absolutas): `VB project '<archivo>.vbproj' analyzed with reduced fidelity (Adhoc fallback: MSBuild with Visual Studio Build Tools and the VB workload is unavailable). .NET Framework types are unresolved; coupling to framework types and detections that need them may be incomplete. See docs/VB-LEGACY.md.`

## D11 — Corpus

- **Decision** (usuario, 2026-10-08): fixtures sintéticos `SyntheticDesktop` (WinForms + módulo + acceso a datos con SQL literal y DataSet tipado + reporte + fachada + `app.config`) y `SyntheticWebServices` (ASMX + WCF + `web.config`), con nombres y datos ficticios, bajo `Fixtures/VbLegacy/` (ya copiados a la salida de pruebas por el `.csproj`). `VbCorpusSmokeTests` conserva la categoría `Corpus` y corrige su documentación.

## D12 — Prueba de compatibilidad C#

- **Decision**: capturar **antes** de cualquier cambio la salida serializada del analizador (mismas opciones que `Program.cs`) para las fixtures C# `SampleProject` y `CodeIssuesSample`, con la raíz de la fixture sustituida por un marcador, como archivos de oro; una prueba xUnit las compara byte a byte. Se complementa con `BaselineParityTest` (dotnet-ecommerce, Java) y un diff manual antes/después de los demos `dotnet-ecommerce`, `dotnet-legacy-clinic`, `dotnet-unstructured`.

## D13 — `.vbproj` legacy abierto por MSBuild sin biblioteca base

- **Hallazgo** (prototipo 2026-10-08, macOS, SDK .NET 10 + MSBuildLocator): un `.vbproj` legacy que importa `Microsoft.VisualBasic.targets` (caso real, y el del corpus sintético) se abre con `MSBuildWorkspace` con 13 árboles pero solo 2 referencias y `System.Object` como tipo de error (faltan los ensamblados de referencia de .NET Framework 4.8). La rama de 004 solo cae a Adhoc si la compilación está vacía (el fixture mínimo de 004 no importa los targets y por eso sí cae). Además, la evaluación de diseño escribe `obj/Debug/.NETFramework,Version=v4.8.AssemblyAttributes.vb` dentro del proyecto.
- **Decision**: en la rama `.vbproj`, si la compilación MSBuild no resuelve `System.Object`, usar `VbProjectLoader.LoadAdhoc` (que referencia la BCL del runtime del analizador) y registrar fidelidad reducida; `LoadAdhoc` ignora `bin/` y `obj/`. En Windows con Build Tools la biblioteca base se resuelve y la ruta MSBuild no cambia.
- **Rationale**: sin biblioteca base no hay `Object`, `String` ni `Exception` resueltos: el enlace tardío (D6) no se puede detectar y el acoplamiento pierde precisión; la carga Adhoc es estrictamente mejor. Solo afecta a VB (la rama `.csproj` no cambia).
- **Alternatives**: añadir referencias de .NET Framework desde paquetes de referencia (`Microsoft.NETFramework.ReferenceAssemblies`) — dependencia nueva y descarga en tiempo de análisis (principio VI); mantener la compilación MSBuild — degrada D6.
- **Estado**: default elegido por agente — confirmado por usuario 2026-10-09.
