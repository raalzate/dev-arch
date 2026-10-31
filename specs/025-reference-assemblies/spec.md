# Feature Specification: Ensamblados de referencia de .NET Framework en el fallback Adhoc (fidelidad)

**Feature Branch**: `025-reference-assemblies`
**Created**: 2026-10-30
**Status**: Draft
**Input**: User description: "Cierre transversal del PLAN-VB-PLATAFORMA-LEGACY.md: ensamblados de referencia de .NET Framework 4.8 para el fallback Adhoc sin Windows (opt-in por ruta configurada) y runner Windows manual en CI."

## Contexto

En macOS/Linux el cargador VB de fidelidad reducida compila contra los ensamblados del runtime .NET 8 del propio analizador, así que `System.Windows.Forms`, `System.Data.SqlClient`, `System.ServiceModel`, `System.Web.Services` o `System.Configuration` quedan como tipos de error: el acoplamiento a tipos del framework y las reglas que los necesitan (`CA2100` sobre `SqlCommand`, 024) no se activan. El paquete NuGet `Microsoft.NETFramework.ReferenceAssemblies.net48` (MIT, solo metadatos) contiene exactamente esos ensamblados. Esta feature permite indicar su carpeta (`analysis.referenceAssemblies`), con la que las compilaciones Adhoc VB referencian esos ensamblados en lugar de los del runtime. Es **opt-in**: sin la ruta, la salida es byte a byte la actual (los guardas de 009-024 fijan la salida por defecto) y el motor no añade dependencias. Además se añade un runner Windows **manual** (`workflow_dispatch`) para medir la fidelidad completa sin coste recurrente (decisión §7.3 sigue abierta para hacerlo automático).

## User Stories *(mandatory)*

### User Story 1 — Compilar contra los ensamblados de referencia (Priority: P1)

1. **Given** `analysis.referenceAssemblies` apuntando a la carpeta `build/.NETFramework/v4.8` del paquete y el proyecto sintético `SyntheticExtended` con una consulta `SqlCommand` concatenada, **When** se analiza con `analysis.extended = on`, **Then** el componente recibe `CA2100` con prefijo `[security][CWE-89]`
2. **Given** la misma configuración sin `referenceAssemblies`, **Then** no hay `CA2100` y el componente existe igualmente
3. **Given** una carpeta inexistente, **Then** advertencia de usuario `Reference assemblies directory not found: <ruta>; host runtime assemblies used.` y el análisis completa
4. **Given** la carpeta configurada, **Then** el log informa `[info] VbProjectLoader: N reference assemblies from '<carpeta>'` y la doble corrida es byte a byte idéntica

### User Story 2 — Runner Windows manual (Priority: P3)

1. **Given** el repositorio, **Then** existe un workflow `windows-fidelity.yml` disparado solo manualmente que ejecuta las pruebas .NET en `windows-latest` y publica el resultado como artefacto; `docs/VB-LEGACY.md` lo documenta

## Requirements *(mandatory)*

- **FR-001**: `analysis.referenceAssemblies` (string o null, default null) en la configuración de inferencia; reenviado al analizador como ruta absoluta.
- **FR-010**: Con la ruta, cada compilación Adhoc VB MUST referenciar los `*.dll` de la carpeta y de su subcarpeta `Facades` (orden ordinal) en lugar de los ensamblados del runtime; las referencias de proyecto declaradas se conservan.
- **FR-011**: Carpeta inexistente o sin `*.dll` → advertencia de usuario y compilación con los ensamblados del runtime (nunca fallo).
- **FR-020**: Sin la ruta, salidas byte a byte idénticas a las actuales.
- **FR-030**: Workflow manual `.github/workflows/windows-fidelity.yml` (`workflow_dispatch`), no bloqueante.
- **FR-040**: Documentación: `engine/CONFIGURATION.md`, `docs/VB-LEGACY.md`, `docs/SCHEMA.md`, `CHANGELOG.md`.

## Success Criteria *(mandatory)*

- **SC-001**: Referencia (opt-in, con la carpeta): ≥ 1 issue con `[CWE-` y doble corrida idéntica; cifras en `docs/EVALUATIONS.md` §13. *Resultado 2026-10-30: 15 issues con CWE, 7 categorías, doble corrida idéntica — cumplido.*
- **SC-002**: `test-for-demo/*`, líneas base y goldens existentes sin cambios.

## Clarifications

### Session 2026-10-30

- El paquete no se añade al analizador (principio VI, inventario de 005): el usuario indica la carpeta; el proyecto de pruebas lo referencia solo para disponer de la ruta.
- El aviso de fidelidad reducida de 009 se mantiene aunque haya ensamblados de referencia: sigue sin usarse MSBuild (propiedades, generadores, recursos).

## Assumptions

- La carpeta del paquete (`~/.nuget/packages/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8`) está disponible en el host de pruebas tras `dotnet restore` del proyecto de pruebas.
