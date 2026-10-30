# Research: 021-desktop-identity-layers

## D1 — Leer el `.vbproj` con XML de la BCL
**Decisión**: `VbProjectFile.Load` con `XDocument` (DTD prohibida), namespace MSBuild ignorado por `LocalName`. Campos: `RootNamespace`, `Import/@Include`, `OptionStrict`, `OutputType`, `StartupObject`, `*.rdlc` de cualquier item. **Alternativa**: MSBuild API (requiere Build Tools, no disponible en fidelidad reducida).

## D2 — Raíz e imports en la compilación Adhoc
**Decisión**: `VisualBasicCompilationOptions.WithRootNamespace` y `WithGlobalImports(GlobalImport.Parse(...))`; es exactamente lo que hace el compilador con el proyecto. Los símbolos quedan calificados ⇒ `TypeAnalyzer` y `VbTypeIndex` producen ids con raíz sin tocar su lógica; solo el nombre de respaldo (tipo sin símbolo) recibe la raíz. Imports inválidos se ignoran con `[WARN]`. Cierra el disparador real de 009 BUG-001 en la referencia (`Int64` sin `Imports System`). **Alternativa**: reescribir namespaces en el árbol (frágil).

## D2b — Un proyecto por `.vbproj` anidado en el fallback Adhoc
**Decisión**: cuando la carpeta analizada no tiene `.sln` ni proyecto en la raíz pero sí `.vbproj` anidados, se compila cada proyecto por separado (archivos `.vb` bajo su carpeta, sin `bin/`/`obj/`), en orden topológico de `ProjectReference` (ciclos y empates por orden ordinal), con `ToMetadataReference()` de las compilaciones previas como referencias; es lo que haría MSBuild. Sin `.vbproj` anidados, compilación única como hoy. **Alternativas**: envolver cada árbol en un `Namespace` sintético (desplaza líneas); exigir un `.sln` (la referencia no lo trae).

## D3 — Capas finas por evidencia, sin marcas
**Decisión**: sufijos/contenidos de nombres de **tipos base** (`Form`, `UserControl`, `XtraForm`, `XtraUserControl`, `WaitForm`; `Report`), archivos asociados (`.Designer.vb`, `.rdlc`), `Sub Main`, `Validator`/`.Validators`. Cadena de herencia por símbolo y por sintaxis (`VbLayerClassifier.BaseNames`, 009). Capa fina en `annotations` (`Layer:<fina>`) porque `layer` es un catálogo cerrado y 005/008 bloquean `schema_version = 1.0.0`; proyección: Presentación/Reportes → `Web` (ya usado para formularios en 009), Batch/Validator → `Negocio`. **Alternativa (a) del plan**: contrato 1.1.0 con tres capas: requiere bump de versión en toda salida y re-testify de 005/008; documentada para una futura versión.

## D4 — Punto de entrada por lotes
**Decisión**: anotación `EntryPoint:Main` en el componente; `legacy_entrypoint` de tipo `internal` (catálogo cerrado) con `primary_entry_class`, `exposed_operations = [Main]` y descripción de proceso por lotes, decidido en `buildEntrypointFromComponents` antes de mensajería/EJB. **Alternativa**: nuevo valor `batch` (rompe el contrato).

## D5 — Sección `debt`
**Decisión**: `debt.enabled` (`auto|on|off`, auto = VB), `debt.godClass.minLoc` (1000), `debt.godClass.minComplexity` (15); mismo transporte que `dataAccess` (020, `--config`). Filas en `engine/CONFIGURATION.md` (008 TS-013 compara la tabla con los defaults).

## D6 — Reglas sintácticas
**Decisión**: todas sobre `VbTypeIndex.OwnNodes`; `SQL_CONCAT_INJECTION` reutiliza `VbStringFolder` (hueco + palabra clave SQL); `STATIC_FACADE` por modificadores; `MIXED_TRANSACTION_MODELS` por identificadores; `GOD_CLASS` por `Loc`/`ComplexityMax` ya calculados (pasada 7b, por eso 11c va después); `UI_CALL_IN_BUSINESS_LAYER` depende de la capa fina (pasada 8b). Perfil por capa (tolerancias) queda para 019.

## D7 — Fixture 009
**Decisión**: `SyntheticDesktop.vbproj` pasa a `<OptionStrict>On</OptionStrict>` (test data no afirmada; el escenario 009 de issues fija el conjunto exacto y la declaración por archivo se conserva). Ningún otro disparador de reglas de deuda existe en los fixtures 009/020 (verificado por grep: sin `MsgBox`, `TransactionScope`, `GetSqlStringCommand`, ni concatenaciones de comando con variables).
