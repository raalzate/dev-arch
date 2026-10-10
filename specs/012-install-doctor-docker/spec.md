# Feature Specification: Instalación guiada — scanner de dependencias (doctor) e imagen Docker / Compose

**Feature Branch**: `012-install-doctor-docker`
**Created**: 2026-10-10
**Status**: Draft
**Input**: User description: "Fase 6b — Instalación: scanner de dependencias (`doctor`) y Docker / Compose (PLAN-INTEGRACION-DEV-ARCH.md), con decisiones del usuario (2026-10-10): perfiles de Compose solo todo-en-uno (`default`) y `dev` (sin `split` ni transporte MCP HTTP en el motor); imagen genérica publicable en GHCR sin configuración de proveedor; Docker no está instalado en la máquina de desarrollo, así que el Dockerfile y el Compose se validan estáticamente en local y la construcción real y la prueba de humo corren en CI; puntos de entrada reales del doctor `npm run doctor`, `npx dev-arch doctor` y `make check-env`, manteniendo intacto el marcador de posición bloqueado de `make doctor` (006 TS-012); verificaciones del doctor según la tabla del plan (JDK 17, Maven, .NET SDK ≥ 8 y runtime 8 —la máquina tiene SDK 10 + runtime 8.0.27 y debe pasar—, Node 20+, engine.jar, dotnet-analyzer, VS Build Tools solo Windows, Docker/Compose como advertencia en modo local, variables de entorno, puerto 9002, RAM/disco) con OK/WARN/FAIL, versiones y sugerencias de instalación por sistema operativo, `--json`, `--fix` (solo mostrar), `--mode local|docker`; `GET /api/health` reutilizándolo; opción `--doctor` del motor (versión, versión del esquema, analizador .NET localizado) sin romper paridad CLI/MCP, determinismo ni puertas de calidad; `docs/INSTALL.md` con las dos rutas y la tabla de requisitos generada desde la misma definición que usa el doctor."

## Contexto

dev-arch (features 006–011) se instala hoy leyendo varios documentos y fallando en `make build` cuando falta algo: el comando de requisitos previos solo comprueba JDK, .NET y Node, no sugiere cómo instalarlos y no cubre Maven, binarios del motor, Docker, variables de entorno, puerto ni recursos. No existe imagen de contenedor: quien no quiera instalar JDK, .NET y Node no tiene alternativa. El plan (Fase 6b) pide un diagnóstico único del sistema y una ruta Docker / Compose.

La Constitución vigente (v1.0.0) obliga a: no romper salidas ni contratos (I), lógica de análisis única en el motor con puntos de entrada delgados (II), TDD con aserciones inmutables (III), determinismo (IV), errores claros (V) y huella mínima sin dependencias injustificadas (VI). La regla aditiva del usuario (2026-10-09) sigue vigente: no se modifica ningún `.feature`, `context.json`, especificación, definición de pasos ni prueba existente de las features 001–011, y no se relaja ninguna puerta de calidad (Checkstyle ≤ conteo actual 4589 con límite de CI 4763, SpotBugs 0, formato .NET, umbral de cobertura web).

## User Stories *(mandatory)*

### User Story 1 — Saber exactamente qué falta antes de instalar o arrancar (Priority: P1)

Como persona que instala dev-arch en su máquina, quiero un comando que revise todas las dependencias del sistema y me diga, para cada una, si está bien, si es una advertencia o si falta, con la versión detectada, la requerida y cómo instalarla en mi sistema operativo, para no descubrir los faltantes a mitad del build.

**Why this priority**: Es el objetivo central de la fase: sin diagnóstico la instalación local es prueba y error.

**Independent Test**: Ejecutar el diagnóstico en modo local en la máquina de desarrollo (JDK 17, Maven, .NET SDK 10 con runtime 8, Node, sin Docker): termina sin FAIL, reporta Docker como advertencia y lista cada verificación con su versión; con un sistema simulado sin JDK, el diagnóstico termina con FAIL y sugiere el comando de instalación del gestor del sistema.

**Acceptance Scenarios**:

1. **Given** una máquina con JDK 17, Maven, .NET SDK 10 con runtime 8.0, Node 20+ y sin Docker, **When** se ejecuta el diagnóstico en modo local, **Then** cada dependencia aparece con estado, versión detectada y versión requerida, Docker aparece como advertencia y el resultado global no es FAIL
2. **Given** un sistema sin JDK o con JDK menor que 17, **When** se ejecuta el diagnóstico en modo local, **Then** la verificación del JDK es FAIL, el resultado global es FAIL y el comando termina con código distinto de cero
3. **Given** un sistema con .NET SDK ≥ 8 pero sin ningún runtime 8, **When** se ejecuta el diagnóstico, **Then** la verificación del runtime .NET es FAIL indicando que se requiere el runtime 8
4. **Given** el diagnóstico con alguna verificación que no es OK, **When** se pide la opción de corrección, **Then** se muestran los comandos de instalación del sistema operativo (brew, apt, winget o choco) sin ejecutar ninguno
5. **Given** el producto, **When** se invoca el diagnóstico como script del paquete, como binario del paquete del producto y como objetivo de verificación del entorno de make, **Then** las tres formas producen el mismo diagnóstico
6. **Given** el objetivo reservado `make doctor`, **When** se ejecuta, **Then** sigue mostrando su marcador de posición bloqueado y termina con código 0

---

### User Story 2 — Diagnóstico legible por máquina y por modo de instalación (Priority: P1)

Como integrador de CI o de chequeos de salud, quiero el diagnóstico en un formato estructurado y limitado al modo de instalación elegido (local o contenedor), para usarlo como verificación automática.

**Why this priority**: El plan exige usar el diagnóstico como chequeo de salud en CI y en el contenedor.

**Independent Test**: Ejecutar el diagnóstico con salida estructurada en modo local y en modo contenedor: el documento es válido, contiene el modo, el estado global y una entrada por verificación del modo; el modo contenedor no incluye JDK, Maven ni .NET y trata la ausencia de Docker como FAIL.

**Acceptance Scenarios**:

1. **Given** el diagnóstico con salida estructurada, **When** termina, **Then** produce un documento con herramienta, versión del producto, modo, sistema, estado global y una lista de verificaciones con identificador, estado, versión detectada, versión requerida, uso, detalle y sugerencias
2. **Given** el modo contenedor, **When** se ejecuta el diagnóstico, **Then** solo se verifican Docker / Compose, variables de entorno, puerto y recursos, y la ausencia de Docker o de Compose v2 es FAIL
3. **Given** el modo local, **When** Docker no está instalado, **Then** su verificación es WARN y no cambia el código de salida
4. **Given** un modo o una opción desconocidos, **When** se invoca el diagnóstico, **Then** termina con un error de uso que lista las opciones válidas

---

### User Story 3 — Instalar y ejecutar dev-arch solo con Docker (Priority: P1)

Como persona que no quiere instalar JDK, .NET ni Node, quiero levantar dev-arch con Compose y analizar un proyecto desde la web, y como mantenedor quiero un perfil de desarrollo con recarga en caliente, para tener una ruta de instalación alternativa reproducible.

**Why this priority**: Es la segunda ruta de instalación exigida por la fase y el plan.

**Independent Test**: En CI: construir la imagen, levantar Compose en el perfil por defecto, esperar a que el contenedor esté sano, ejecutar el diagnóstico en modo contenedor y analizar el proyecto de demostración Java por la API: termina con componentes. En local (sin Docker): validar estáticamente la definición de la imagen y de Compose.

**Acceptance Scenarios**:

1. **Given** la definición de la imagen, **When** se inspecciona, **Then** construye el motor, el analizador .NET y la web en etapas separadas y la imagen final contiene solo entornos de ejecución (JRE 17, runtime .NET 8, Node 20), se ejecuta sin privilegios de administrador y declara un chequeo de salud sobre el endpoint de salud de la web
2. **Given** la definición de Compose, **When** se inspecciona, **Then** declara exactamente el perfil por defecto (servicio web todo-en-uno con datos persistentes, límite de memoria y variables de IA opcionales) y el perfil de desarrollo (fuentes montadas, recarga en caliente), sin perfil separado de motor ni configuración de un proveedor de nube
3. **Given** la integración continua del producto, **When** cambian los archivos del contenedor o del diagnóstico o se publica un tag de release, **Then** un trabajo construye la imagen, la levanta con Compose, espera a que esté sana, ejecuta el diagnóstico en modo contenedor y analiza el proyecto de demostración Java, y en los tags publica la imagen en el registro de contenedores del repositorio
4. **Given** una máquina sin Docker, **When** se ejecutan las pruebas del producto, **Then** la definición de la imagen y de Compose se validan estáticamente y ninguna prueba exige construir la imagen

---

### User Story 4 — Salud en caliente de la web y autodiagnóstico del motor (Priority: P2)

Como operador, quiero un endpoint de salud que reporte con el mismo diagnóstico si el motor y el analizador .NET están disponibles y si el proceso del motor está vivo, y que el motor pueda describirse a sí mismo, para detectar instalaciones rotas sin lanzar un análisis.

**Why this priority**: Habilita el chequeo de salud del contenedor y del modo local; depende de US1.

**Independent Test**: Con el producto construido, pedir el endpoint de salud: responde 200 con el estado del archivo del motor, del analizador .NET y del proceso del motor; con el diagnóstico simulado en FAIL responde 503. Ejecutar el motor con la opción de autodiagnóstico: imprime una línea estructurada con su versión, la versión del esquema y si localiza el analizador .NET.

**Acceptance Scenarios**:

1. **Given** la web en ejecución con el motor construido, **When** se pide el endpoint de salud, **Then** responde 200 con servicio, estado, versión, estado del archivo del motor, del analizador .NET, del proceso del motor y las verificaciones de ejecución del diagnóstico
2. **Given** el diagnóstico de ejecución con alguna verificación FAIL, **When** se pide el endpoint de salud, **Then** responde 503 con el mismo cuerpo
3. **Given** el endpoint de salud pedido varias veces seguidas, **When** se responde, **Then** el diagnóstico no se repite en cada petición dentro de una ventana de tiempo acotada, pero el estado del proceso del motor es siempre el actual
4. **Given** el motor construido, **When** se ejecuta con la opción de autodiagnóstico, **Then** imprime una sola línea estructurada con nombre, versión del producto, versión del esquema de salida y si localiza el analizador .NET (y su ruta), con el mismo método de localización que usa el análisis, y termina con código 0
5. **Given** el motor, **When** se comparan sus salidas de análisis por línea de comandos y por servidor MCP antes y después de la feature, **Then** son idénticas y el servidor MCP expone las mismas herramientas

---

### User Story 5 — Guía de instalación con requisitos que no divergen (Priority: P2)

Como persona que instala, quiero una guía con las dos rutas (local y Docker) cuya tabla de requisitos sea la misma definición que usa el diagnóstico, para que la documentación nunca contradiga al comando.

**Why this priority**: Cierra la experiencia de instalación; depende de US1 y US3.

**Independent Test**: Regenerar la tabla de requisitos desde la definición del diagnóstico y compararla con la de la guía: son idénticas; cambiar un mínimo en la definición sin actualizar la guía hace fallar la verificación.

**Acceptance Scenarios**:

1. **Given** la guía de instalación, **When** se lee, **Then** describe la ruta local (diagnóstico, build, arranque) y la ruta Docker (Compose por defecto y de desarrollo, variables, datos persistentes, chequeo de salud)
2. **Given** la tabla de requisitos de la guía, **When** se compara con la tabla generada desde la definición del diagnóstico, **Then** son idénticas
3. **Given** cada requisito de la definición, **When** se inspecciona, **Then** tiene uso, mínimo, forma de detección, modos y una sugerencia de instalación para cada gestor de paquetes aplicable

---

### Edge Cases

- `JAVA_HOME` definido pero sin `bin/java`: FAIL del JDK con el motivo (no se usa otro `java` del PATH en silencio).
- Solo existe el envoltorio de Maven del motor: Maven OK indicando el envoltorio.
- .NET SDK más nuevo que 8 sin runtime 8 (el analizador apunta a .NET 8): SDK OK, runtime FAIL.
- `ENGINE_JAR_PATH` apunta a un archivo inexistente: FAIL (configuración rota), a diferencia del motor aún no construido (WARN con la sugerencia de construir).
- Archivo del motor de una versión distinta de la del producto o que no responde al autodiagnóstico: WARN con la sugerencia de reconstruir.
- Puerto 9002 ocupado por la propia web de dev-arch (Compose levantado): OK; ocupado por otro proceso: WARN.
- Daemon de Docker detenido con el cliente instalado: FAIL en modo contenedor, WARN en modo local.
- Windows: los ejecutables se buscan con extensión `.exe`/`.cmd`; VS Build Tools solo se verifica en Windows y su ausencia es WARN (solo afecta al análisis VB legado completo).
- Diagnóstico ausente o roto dentro de la web: el endpoint de salud responde 503 con el motivo, nunca un error sin cuerpo.
- Imagen en arquitectura arm64: el analizador .NET se publica para la arquitectura de destino.
- Sin clave de IA: WARN; el análisis estático sigue funcionando.

## Requirements *(mandatory)*

### Functional Requirements

**Diagnóstico (US1, US2)**

- **FR-001**: El producto MUST ofrecer un diagnóstico del sistema invocable como script del paquete del producto (`npm run doctor`), como binario del paquete del producto (`npx dev-arch doctor`) y como objetivo de make de verificación del entorno (`make check-env`), con el mismo resultado en las tres formas.
- **FR-002**: Los requisitos verificados MUST definirse en una única definición (identificador, nombre, uso, mínimo, forma de detección, modos, plataformas y sugerencias por gestor brew/apt/winget/choco) de la que derivan las verificaciones, las sugerencias y la tabla de la guía.
- **FR-003**: El diagnóstico MUST verificar en modo local: JDK ≥ 17 (respetando `JAVA_HOME`), Maven ≥ 3.6 o el envoltorio del motor, .NET SDK ≥ 8, runtime .NET 8, Node ≥ 20 y npm ≥ 10, archivo del motor (versión igual a la del producto), analizador .NET (localizado como lo hace el motor; versión igual a la del producto), VS Build Tools ≥ 17 (solo Windows), Docker ≥ 24 y Compose v2, variables de entorno, puerto 9002 y recursos (RAM ≥ 4 GB, disco temporal ≥ 2 GB).
- **FR-004**: Cada verificación MUST reportar estado OK, WARN o FAIL, versión detectada, versión requerida, uso y detalle; el estado global MUST ser FAIL si alguna falla, WARN si alguna advierte y OK en otro caso; el código de salida MUST ser distinto de cero solo cuando el estado global es FAIL.
- **FR-005**: En modo local, Docker / Compose ausente o antiguo MUST ser WARN; en modo contenedor MUST ser FAIL, igual que un daemon no accesible.
- **FR-006**: El modo contenedor MUST limitar las verificaciones a Docker / Compose, variables de entorno (incluido el archivo de variables de Compose), puerto y recursos.
- **FR-007**: La opción `--json` MUST producir un documento estructurado (herramienta, versión del producto, modo, sistema, estado global, verificaciones y autodiagnóstico del motor cuando existe).
- **FR-008**: La opción `--fix` MUST mostrar los comandos de instalación del sistema operativo actual para cada verificación que no es OK y MUST NOT ejecutar ninguno.
- **FR-009**: La opción `--mode local|docker` MUST seleccionar las verificaciones del modo; un modo, una opción o una verificación desconocidos MUST terminar con error de uso.
- **FR-010**: El diagnóstico MUST ejecutarse con Node 20 sin dependencias de paquetes adicionales.
- **FR-011**: La salida humana MUST ser una tabla con una fila por verificación y un resumen; con terminal interactiva y sin `NO_COLOR`, el estado se colorea.
- **FR-012**: Con el runtime .NET 8 presente junto a un SDK más nuevo (SDK 10 + runtime 8.0.27), las verificaciones .NET MUST ser OK.
- **FR-013**: El objetivo reservado `make doctor` MUST seguir mostrando su marcador de posición bloqueado (006 TS-012) sin cambios.

**Autodiagnóstico del motor y salud de la web (US4)**

- **FR-014**: El motor MUST aceptar la opción `--doctor` y escribir una sola línea estructurada con nombre del motor, versión del producto, versión del esquema de salida, versión de Java y si localiza el analizador .NET (con su ruta), usando el mismo localizador que el análisis; MUST terminar con código 0 aunque no localice el analizador.
- **FR-015**: La opción `--doctor` MUST NOT cambiar las salidas de análisis de la línea de comandos ni del servidor MCP ni la lista de herramientas MCP (paridad, determinismo).
- **FR-016**: El diagnóstico local MUST invocar el autodiagnóstico del motor cuando el archivo del motor y un JDK válido existen, y usar su resultado para la versión del motor y la localización del analizador.
- **FR-017**: La web MUST exponer `GET /api/health` que reutiliza el diagnóstico (verificaciones de ejecución: JDK, runtime .NET, archivo del motor, analizador .NET, variables de entorno y recursos) y añade el estado del proceso del motor (en ejecución o inactivo); MUST responder 200 sin FAIL y 503 con FAIL, sin caché en el cliente.
- **FR-018**: El resultado del diagnóstico del endpoint de salud MUST reutilizarse durante una ventana acotada (30 s) y el estado del proceso del motor MUST ser el actual en cada petición.
- **FR-019**: Si el diagnóstico no puede ejecutarse o no produce un documento válido, el endpoint de salud MUST responder 503 con una verificación FAIL que explique el motivo.

**Contenedor (US3)**

- **FR-020**: La imagen MUST construirse en etapas (motor con Maven y JDK 17; analizador .NET con SDK 8 para la arquitectura de destino; web con Node 20 en modo autónomo) y la imagen final MUST contener solo JRE 17, runtime .NET 8 y Node 20, el diagnóstico y los artefactos construidos; MUST ejecutarse con un usuario sin privilegios y declarar un chequeo de salud sobre `GET /api/health`.
- **FR-021**: La imagen MUST ser genérica (sin configuración de proveedor de nube) y publicable en el registro de contenedores del repositorio.
- **FR-022**: Compose MUST declarar solo el perfil por defecto (servicio web todo-en-uno, datos de análisis persistentes, límite de memoria, opciones de JVM y variables de IA opcionales) y el perfil `dev` (fuentes montadas, recarga en caliente, motor construido en el anfitrión junto al analizador .NET de la imagen); MUST NOT declarar un perfil de motor separado ni transporte MCP por red.
- **FR-023**: La CI MUST tener un trabajo de contenedor que, al cambiar los archivos del contenedor o del diagnóstico, en los tags de release o en `main`, construya la imagen, la levante con Compose, espere a que esté sana, ejecute el diagnóstico en modo contenedor (anfitrión) y de ejecución (contenedor), analice el proyecto de demostración Java por la API comprobando que el grafo tiene componentes, y en los tags publique la imagen versionada en GHCR.
- **FR-024**: El trabajo de contenedor MUST NOT cambiar los trabajos de área existentes ni su disparo (006 TS-025/TS-030) ni la release (006 TS-029, 011).
- **FR-025**: Las pruebas del producto MUST validar estáticamente la definición de la imagen y de Compose (etapas, bases, usuario, chequeo de salud, perfiles, puertos, variables) sin requerir Docker.

**Guía (US5)**

- **FR-026**: `docs/INSTALL.md` MUST describir la ruta local y la ruta Docker, e incluir la tabla de requisitos generada desde la definición del diagnóstico entre marcadores; la verificación del producto MUST fallar si la tabla difiere de la generada.

**Guardas**

- **FR-027**: Ninguna puerta de calidad MUST relajarse (Checkstyle ≤ 4589 reales con límite de CI 4763, SpotBugs 0, formato .NET, comprobación de tipos, lint y umbral de cobertura web ≥ 85 %); ningún `.feature`, `context.json`, especificación, paso ni prueba de 001–011 MUST cambiar; las estructuras bloqueadas de 006 (entradas permitidas en la raíz del producto, espacios de trabajo `web` y `schema`) MUST respetarse.

### Key Entities

- **Requisito**: identificador, nombre, uso, mínimo, detección, modos, plataformas, sugerencias por gestor.
- **Verificación**: requisito, estado (OK/WARN/FAIL), versión detectada, versión requerida, detalle, sugerencias aplicables.
- **Informe del diagnóstico**: herramienta, versión del producto, modo, sistema, estado global, verificaciones, autodiagnóstico del motor.
- **Autodiagnóstico del motor**: nombre, versión, versión del esquema, versión de Java, analizador .NET (encontrado, ruta).
- **Estado de salud**: servicio, estado, versión, archivo del motor, analizador .NET, proceso del motor, verificaciones de ejecución.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En la máquina de desarrollo (JDK 17, Maven, .NET SDK 10 + runtime 8.0.27, Node, sin Docker) el diagnóstico local termina con 0 FAIL; Docker es la única dependencia del sistema en WARN (además de las de configuración opcional).
- **SC-002**: Para cada requisito ausente simulado, el diagnóstico reporta ese requisito como no OK con la sugerencia de instalación del sistema operativo (el 100 % de los requisitos de la definición está cubierto por pruebas).
- **SC-003**: Las tres formas de invocación producen el mismo documento estructurado.
- **SC-004**: En CI, `docker compose up` con solo Docker deja la web sana y analiza el proyecto de demostración Java con ≥ 1 componente.
- **SC-005**: La tabla de requisitos de la guía es idéntica a la generada (0 diferencias).
- **SC-006**: 0 cambios en salidas de análisis CLI/MCP y en la lista de herramientas MCP; 0 artefactos bloqueados modificados; Checkstyle ≤ 4589, SpotBugs 0.

## Clarifications

### Session 2026-10-10 (decisiones del usuario)

- Q: ¿Qué perfiles de Compose? -> A: Solo todo-en-uno (`default`) y `dev`; sin `split` y sin transporte MCP HTTP en el motor. [FR-022]
- Q: ¿Imagen y publicación? -> A: Imagen genérica publicable en GHCR, sin configuración de proveedor. [FR-021, FR-023]
- Q: Docker no está instalado localmente: ¿cómo se valida? -> A: Dockerfile y Compose se escriben y validan estáticamente en local; la construcción real y la prueba de humo (`docker compose up -d`, doctor `--mode docker`, análisis de `test-for-demo/java-standar`) corren en un trabajo de CI; se reporta que la imagen no pudo construirse localmente. [FR-023, FR-025]
- Q: ¿Puntos de entrada del doctor? -> A: `npm run doctor`, `npx dev-arch doctor` y `make check-env`; `make doctor` conserva su comportamiento bloqueado de 006 TS-012. [FR-001, FR-013]
- Q: ¿Verificaciones y opciones? -> A: Las de la tabla del plan, con OK/WARN/FAIL, versiones, sugerencias por SO, `--json`, `--fix` (solo mostrar), `--mode local|docker`; SDK 10 + runtime 8.0.27 debe pasar; Docker/Compose WARN en modo local. [FR-003..FR-012]
- Q: ¿Salud y motor? -> A: `GET /api/health` reutiliza el doctor; el motor añade `--doctor` (versión, `schema_version`, analizador .NET localizado) manteniendo paridad CLI/MCP, determinismo y puertas. [FR-014..FR-019]
- Q: ¿Guía? -> A: `docs/INSTALL.md` con ambas rutas y tabla de requisitos generada desde la misma definición del doctor. [FR-026]

### Defaults elegidos por el agente

- Ubicación del doctor: el usuario indicó `tools/doctor/`, pero el escenario bloqueado 006 TS-001 solo admite en la raíz del producto las áreas y entradas permitidas (`tools/` no lo es) y 006 TS-013 fija los espacios de trabajo en `web` y `schema`; el doctor vive en la carpeta de orquestación existente del producto y `npx dev-arch` se resuelve con el binario del paquete raíz. Por la misma razón la definición de Compose vive en el área de contenedores y no en la raíz. (default elegido por agente — pendiente confirmar) [FR-001, FR-022, FR-027]
- `make build` y `make dev` no ejecutan el doctor antes de compilar (el plan lo proponía): conservan el comando de requisitos previos existente y el doctor queda como `make check-env`, para no alterar escenarios bloqueados de 006 ni hacer fallar builds de CI por advertencias de entorno. (default elegido por agente — pendiente confirmar) [FR-001]
- Estados: recursos por debajo del mínimo, puerto ocupado por otro proceso, clave de IA ausente, VS Build Tools ausente en Windows, archivo del motor o analizador sin construir o de otra versión → WARN; dependencias de build/ejecución ausentes o antiguas y `ENGINE_JAR_PATH` roto → FAIL. (default elegido por agente — pendiente confirmar) [FR-003, FR-004]
- La imagen final no incluye el SDK de .NET (plan: "sin SDKs"): el analizador usa el espacio de trabajo de respaldo sin MSBuild, con menor precisión semántica para .NET que la instalación local; queda documentado. (default elegido por agente — pendiente confirmar) [FR-020]
- Datos persistentes en un volumen con nombre montado en el directorio de datos de la web (análisis y cargas), en lugar de dos carpetas del anfitrión, para evitar problemas de permisos con el usuario sin privilegios. (default elegido por agente — pendiente confirmar) [FR-022]
- El perfil `dev` publica el puerto 9003 del anfitrión para poder convivir con el perfil por defecto. (default elegido por agente — pendiente confirmar) [FR-022]
- El trabajo de contenedor de CI se dispara por cambios en los archivos del contenedor, del diagnóstico, del endpoint de salud o de la configuración de build de la web, en `main` y en tags; no en cada cambio de la web o del motor (los trabajos de área existentes siguen siendo los únicos disparados por esas rutas). Su límite de tiempo es 45 min (no es trabajo de área). (default elegido por agente — pendiente confirmar) [FR-023, FR-024]
- Las pruebas del doctor usan el ejecutor de pruebas integrado de Node (sin Vitest, que el plan mencionaba) con sistemas simulados por SO; la matriz ubuntu/macOS/windows del plan se cubre simulando cada plataforma, más una ejecución real del doctor en el trabajo de contenedor. (default elegido por agente — pendiente confirmar) [FR-010, SC-002]
- No se crea la imagen separada `dev-arch-engine` del plan (fuera de las decisiones del usuario). (default elegido por agente — pendiente confirmar)
- El endpoint de salud no exige el token de la API (los chequeos de salud del contenedor no lo envían) y no expone valores de variables secretas, solo si están definidas. (default elegido por agente — pendiente confirmar) [FR-017]

## Assumptions

- La máquina de desarrollo tiene JDK 17, Maven 3.9, .NET SDK 10 con runtime 8.0.27 y Node ≥ 20; no tiene Docker.
- Los runners de GitHub Actions `ubuntu-latest` tienen Docker con Compose v2 y Buildx.
- La línea base de artefactos bloqueados es `dev-arch-006-baseline` (001–006) y el historial de git de 007–011.
