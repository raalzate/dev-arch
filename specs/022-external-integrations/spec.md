# Feature Specification: Integraciones externas, proyectos ausentes y dependencias EOL del perfil desktop .NET legacy

**Feature Branch**: `022-external-integrations`
**Created**: 2026-10-30
**Status**: Draft
**Input**: User description: "Integraciones externas, referencias de proyecto ausentes y dependencias EOL del perfil desktop .NET legacy (feature 017 del PLAN-VB-PLATAFORMA-LEGACY.md): clientes salientes SOAP/WCF/REST (Service/Web References, ClientBase(Of T), SoapHttpClientProtocol, RestSharp/HttpClient/HttpWebRequest) como contratos consumidos; system.serviceModel/client/endpoint de app.config; ProjectReference a proyectos ausentes como advertencia; packages.config y Reference Include como dependencias externas; lista EOL versionada con issue EOL_DEPENDENCY. Sin bump de contrato: anotaciones y cadenas en campos abiertos."

> Numeración: feature 017 del plan; en el repositorio recibe el número 022.

## Contexto

La referencia consume 14 servicios externos (5 Service References WCF, 9 Web References ASMX, RestSharp en 25 archivos, 9 endpoints `system.serviceModel`) y referencia 11 proyectos que no están en la entrega; el análisis no muestra nada de eso y `external_dependencies` está vacío en VB. Sin esa información un corpus parcial se interpreta como sistema completo y las integraciones (contexto de modernización) se pierden.

El contrato 1.0.0 es cerrado en `api_contracts` (no admite `direction`) y `external_dependencies` es una lista de cadenas; por coherencia con 021 (anotaciones) y para no tocar los escenarios bloqueados de 005/008, esta feature expresa las integraciones como **anotaciones** `Integration:<tipo>:<destino>` y como entradas de `external_dependencies`, las dependencias de fin de vida como issue `EOL_DEPENDENCY`, y los proyectos ausentes como advertencia de usuario más `project:<Nombre>` en `external_dependencies`. La forma rica (`api_contracts[].direction`, `external_dependencies[].kind`) queda para la versión 1.1.0 del contrato (decisión del usuario).

## User Stories *(mandatory)*

### User Story 1 — Ver qué servicios externos consume cada componente (Priority: P1)

Como arquitecto, quiero que cada componente que invoca un servicio externo (SOAP, WCF o REST) lo declare, de modo que la propuesta de modernización conozca las integraciones salientes.

**Why this priority**: Es el contexto de integración que la propuesta necesita; hoy 0 detectadas.

**Independent Test**: Analizar un proyecto sintético con una Service Reference, una Web Reference, un cliente WCF manual, un cliente SOAP y llamadas REST, y comprobar anotaciones y dependencias por componente.

**Acceptance Scenarios**:

1. **Given** un proyecto con la carpeta `Service References/Ofac` (con `.svcmap` y `.wsdl`) y una clase que usa `Ofac.OfacClient`, **When** se analiza, **Then** el componente lleva la anotación `Integration:wcf:Ofac` y `external_dependencies` contiene `service:Ofac`
2. **Given** un proyecto con la carpeta `Web References/Holiday` (con `Reference.map` y `.wsdl`) y una clase que usa `Holiday.HolidayService`, **When** se analiza, **Then** el componente lleva `Integration:soap:Holiday` y `external_dependencies` contiene `service:Holiday`
3. **Given** una clase que hereda de `ClientBase(Of IPricing)`, **When** se analiza, **Then** lleva `Integration:wcf:IPricing`; **Given** una clase que hereda de `SoapHttpClientProtocol`, **Then** lleva `Integration:soap:<NombreDeLaClase>`
4. **Given** una clase que crea `New RestClient("https://api.example.invalid/v1")`, otra que llama `WebRequest.Create("http://rates.example.invalid/today")` y otra que crea `New RestClient(ConfigurationManager.AppSettings("BisiBaseURL"))`, **When** se analiza, **Then** llevan respectivamente `Integration:rest:api.example.invalid`, `Integration:rest:rates.example.invalid` e `Integration:rest:BisiBaseURL` (solo el host o la clave; nunca ruta, consulta ni credenciales)
5. **Given** una URL no literal ni clave de configuración (variable), **When** se analiza, **Then** el componente lleva `Integration:rest:dynamic` y una advertencia de usuario con componente y línea
6. **Given** el archivo `Reference.vb`/`Reference.cs` generado de una referencia de servicio, **When** se analiza, **Then** sigue excluido como autogenerado y no produce componente
7. **Given** los proyectos C# y Java de demostración, **When** se analizan sin configuración, **Then** sus salidas no cambian

---

### User Story 2 — Endpoints de cliente de la configuración (Priority: P2)

Como arquitecto, quiero que los endpoints `system.serviceModel/client` del `app.config` enriquezcan las integraciones WCF detectadas, sin exponer direcciones completas ni credenciales.

**Independent Test**: Analizar el proyecto sintético con un `app.config` que declara dos endpoints de cliente y comprobar anotaciones de contrato y host.

**Acceptance Scenarios**:

1. **Given** `app.config` con `<client><endpoint address="net.tcp://ofac.example.invalid:8012/Ofac" contract="Ofac.IOfacService" binding="netTcpBinding"/>` y un componente con `Integration:wcf:Ofac`, **When** se analiza, **Then** el componente lleva además `Integration:wcf:Ofac.IOfacService@ofac.example.invalid`
2. **Given** una dirección con usuario, contraseña o cadena de consulta, **When** se analiza, **Then** la anotación contiene solo el host (sin puerto, credenciales ni consulta) y la salida serializada no contiene la dirección completa
3. **Given** un `app.config` sin sección `system.serviceModel`, **When** se analiza, **Then** no hay anotaciones de endpoint y la salida no cambia respecto a 021

---

### User Story 3 — Saber qué proyectos faltan en la entrega (Priority: P1)

Como arquitecto, quiero que el análisis avise de los proyectos referenciados que no están en la carpeta analizada, de modo que no interprete un corpus parcial como sistema completo.

**Independent Test**: Analizar una carpeta con dos proyectos donde uno referencia a un tercero ausente y comprobar advertencia y dependencias.

**Acceptance Scenarios**:

1. **Given** un proyecto cuyo `.vbproj` referencia `..\Acme.Billing\Acme.Billing.vbproj` que no existe en la carpeta, **When** se analiza, **Then** se emite una única advertencia de usuario `Referenced projects not included in the analyzed sources: Acme.Billing` (nombres ordenados, sin rutas) y cada componente del proyecto tiene `project:Acme.Billing` en `external_dependencies`
2. **Given** todas las referencias presentes, **When** se analiza, **Then** no hay advertencia ni entradas `project:`
3. **Given** la misma carpeta analizada dos veces, **When** se comparan, **Then** las salidas son byte a byte idénticas

---

### User Story 4 — Dependencias externas y fin de vida (Priority: P2)

Como arquitecto, quiero ver las bibliotecas externas de cada proyecto y cuáles han llegado al fin de su vida, de modo que la deuda de dependencias cuente en la viabilidad (018).

**Independent Test**: Analizar el proyecto sintético con `packages.config` y `<Reference Include>` de terceros y comprobar `external_dependencies` y los issues `EOL_DEPENDENCY`.

**Acceptance Scenarios**:

1. **Given** `packages.config` con `Newtonsoft.Json` y `RestSharp`, y `<Reference Include="DevExpress.Data.v21.2, Version=…">` y `<Reference Include="Microsoft.Practices.EnterpriseLibrary.Data, Version=3.1.0.0, …">`, **When** se analiza, **Then** cada componente del proyecto tiene en `external_dependencies` `DevExpress.Data.v21.2`, `Microsoft.Practices.EnterpriseLibrary.Data`, `Newtonsoft.Json` y `RestSharp` (nombres simples, sin versión), y no las referencias del framework (`System`, `System.Data`, `mscorlib`, `Microsoft.VisualBasic`)
2. **Given** la dependencia `Microsoft.Practices.EnterpriseLibrary.Data` versión 3.1 (lista EOL: Enterprise Library ≤ 5, ActiveReports 3, ReportViewer, `System.Web.Services`), **When** se analiza, **Then** cada componente del proyecto reporta `EOL_DEPENDENCY` (`WARNING`) con el nombre y la razón, ubicado en el archivo de proyecto, y lleva la anotación `Dependency:eol:Microsoft.Practices.EnterpriseLibrary.Data`
3. **Given** la configuración `dependencies.eol = ["Legacy.Crypto"]` y una referencia `Legacy.Crypto`, **When** se analiza, **Then** también se reporta `EOL_DEPENDENCY` para ella
4. **Given** un archivo `.vdproj` en la carpeta analizada, **When** se analiza, **Then** se emite una advertencia de usuario que nombra el instalador Setup/vdproj como sin soporte desde Visual Studio 2010
5. **Given** `integrations.outbound = "off"` o `dependencies.enabled = "off"`, **When** se analiza, **Then** no se emiten anotaciones, dependencias ni issues de esta feature, y por defecto (`auto`) solo se emiten en fuentes VB

---

### Edge Cases

- Carpeta `Service References` sin `.svcmap` (solo `.wsdl`): se usa el nombre de la carpeta igualmente.
- Uso del cliente generado desde otro proyecto (tipo calificado `Ofac.OfacClient` sin carpeta local): se anota igualmente por el nombre calificado si coincide con una referencia de cualquier proyecto analizado.
- URL con puerto y ruta: solo el host; URL relativa o vacía: `dynamic`.
- `ProjectReference` con ruta fuera de la carpeta analizada pero existente en disco: cuenta como ausente de la entrega (no está en lo analizado) y se advierte.
- Mismo paquete en `packages.config` y `<Reference Include>`: una sola entrada.
- Lista EOL: comparación por prefijo de nombre sin distinguir mayúsculas (`Microsoft.Practices.EnterpriseLibrary.*`, `ActiveReports*3`, `Microsoft.ReportViewer.*`, `System.Web.Services`); EnterpriseLibrary 6 no es EOL (versión en la referencia).
- Proyectos mixtos C#/VB: las pasadas aplican por compilación según la fuente.

## Requirements *(mandatory)*

### Functional Requirements

**Integraciones salientes (US1, US2)**

- **FR-001**: El sistema MUST reconocer las referencias de servicio de un proyecto por sus carpetas `Service References/<Nombre>` (WCF) y `Web References/<Nombre>` (ASMX) y anotar `Integration:wcf:<Nombre>` o `Integration:soap:<Nombre>` en los componentes cuyo código nombra tipos del espacio `<Nombre>.`.
- **FR-002**: El sistema MUST reconocer clientes manuales: herencia de `ClientBase(Of T)` → `Integration:wcf:<T>`; herencia de `SoapHttpClientProtocol` → `Integration:soap:<Clase>`.
- **FR-003**: El sistema MUST reconocer clientes REST: creación de `RestClient`/`HttpClient`, `WebRequest.Create`/`HttpWebRequest.Create` y `HttpClient.BaseAddress` con URL literal (plegable) → `Integration:rest:<host>`; con clave de configuración (`ConfigurationManager.AppSettings("K")`, `My.Settings.K`) → `Integration:rest:<K>`; en otro caso → `Integration:rest:dynamic` más advertencia de usuario con componente y línea.
- **FR-004**: Cada integración MUST añadir a `external_dependencies` del componente `service:<Nombre|Contrato>` (SOAP/WCF) o `http:<host|clave>` (REST), deduplicado y ordinal.
- **FR-005**: Las direcciones MUST reducirse al host (sin esquema, puerto, ruta, consulta ni credenciales) en toda salida.
- **FR-010**: El lector de configuración MUST leer `system.serviceModel/client/endpoint` (`address`, `binding`, `contract`, `name`) y añadir `Integration:wcf:<contract>@<host>` a los componentes anotados con la referencia cuyo nombre precede al contrato (`Ofac.IOfacService` → `Ofac`).

**Proyectos ausentes (US3)**

- **FR-020**: Para cada `.vbproj` analizado, los `ProjectReference` cuyo archivo no está bajo la carpeta analizada MUST producir una única advertencia de usuario con los nombres ordenados y `project:<Nombre>` en `external_dependencies` de cada componente del proyecto.

**Dependencias y EOL (US4)**

- **FR-030**: El sistema MUST leer `packages.config` (`package/@id`) y `<Reference Include>` del proyecto (nombre simple antes de la primera coma), excluyendo los ensamblados del framework (`System`, `System.*`, `mscorlib`, `Microsoft.VisualBasic`, `Microsoft.CSharp`, `WindowsBase`, `PresentationCore`, `PresentationFramework`, `Accessibility`, `netstandard`), y añadirlos a `external_dependencies` de cada componente del proyecto.
- **FR-031**: Una lista EOL versionada en el repositorio (nombre o prefijo, versión máxima opcional, razón) MUST aplicarse a las dependencias; cada coincidencia MUST producir `EOL_DEPENDENCY` (`DEPENDENCY`, `WARNING`, ubicación = archivo de proyecto) por componente y la anotación `Dependency:eol:<nombre>`.
- **FR-032**: La configuración `dependencies.eol` (lista de nombres o prefijos) MUST ampliar la lista versionada; nunca se consulta la red.
- **FR-033**: Un archivo `.vdproj` bajo la carpeta analizada MUST producir una advertencia de usuario (instalador Setup sin soporte desde Visual Studio 2010).

**Activación y transversales**

- **FR-040**: `integrations.outbound` y `dependencies.enabled` (`auto` por defecto = solo VB, `on`, `off`) MUST gobernar las pasadas, transportadas al analizador como las secciones de 020/021.
- **FR-041**: Sin configuración, las salidas C#/Java de demostración MUST ser byte a byte idénticas; las salidas VB de 021 con `off` MUST ser idénticas a las anteriores.
- **FR-042**: Dos corridas consecutivas MUST ser byte a byte idénticas; anotaciones, dependencias y advertencias ordenadas.
- **FR-043**: El corpus sintético MUST ampliarse con un proyecto que tenga Service Reference, Web Reference, cliente WCF manual, cliente SOAP, REST literal/clave/dinámico, `app.config` con endpoints, `packages.config`, referencias de terceros (una EOL), un `ProjectReference` ausente y un `.vdproj`; golden versionado.
- **FR-044**: Documentación: `docs/VB-LEGACY.md`, `engine/CONFIGURATION.md`, `docs/SCHEMA.md`, `CHANGELOG.md`.

### Key Entities

- **Integración saliente**: tipo (`wcf`, `soap`, `rest`), destino (nombre de referencia, contrato, host o clave), componente consumidor; anotación + `external_dependencies`.
- **Referencia de servicio**: carpeta `Service References`/`Web References` de un proyecto con su nombre.
- **Endpoint de cliente**: `contract`, `address` (host), `binding`, `name` del `app.config`.
- **Dependencia externa**: nombre simple de paquete o ensamblado de terceros; origen (`packages.config`, `Reference`); EOL con razón.
- **Proyecto ausente**: nombre de un `ProjectReference` cuyo archivo no está en lo analizado.

## Success Criteria *(mandatory)*

- **SC-001**: Referencia (opt-in): ≥ 12 integraciones salientes distintas anotadas con su componente consumidor (medido 19); ≥ 11 proyectos ausentes advertidos (medido 36: el subconjunto Policy referencia más proyectos que los 11 estimados en el plan); ≥ 3 dependencias EOL distintas (medido 13); ningún valor de configuración ni dirección completa en la salida.
- **SC-002**: Corpus sintético: cada forma reconocida tiene un caso positivo y uno negativo que producen exactamente las anotaciones, dependencias e issues esperados.
- **SC-003**: `test-for-demo/*` y líneas base byte a byte idénticas; `meta.schema_version` sigue en `1.0.0`.
- **SC-004**: Doble corrida byte a byte idéntica en el corpus sintético (CI) y en la referencia (opt-in).
- **SC-005**: Tiempo del análisis .NET de la referencia ≤ +10 %.

## Clarifications

### Session 2026-10-30

- Forma de salida: anotaciones y cadenas en campos abiertos (`annotations`, `external_dependencies`, `code_issues`) en lugar de `api_contracts[].direction` y `external_dependencies[].kind` del plan: el contrato 1.0.0 es cerrado y los escenarios bloqueados de 005/008 exigen `schema_version = 1.0.0`. El bump a 1.1.0 es decisión del usuario (plan §4.0/§7).
- Lista EOL (decisión §7.5): archivo versionado en el repositorio (`schema/eol-dependencies.json`, embebido en el analizador) ampliable por `dependencies.eol`; sin red.
- Activación: `auto` = solo VB (regla 4.0 del plan).

## Assumptions

- Las referencias de servicio se identifican por carpeta y por el uso sintáctico de su espacio de nombres; los tipos generados siguen excluidos de los componentes.
- Las direcciones se reducen al host: suficiente para el contexto de modernización y evita exponer secretos.
- `packages/` y `bin/` no se cargan (siguen fuera de alcance: fidelidad).
