# Data Model: 022-external-integrations

## Anotaciones y dependencias
| Evidencia | Anotación | `external_dependencies` |
|---|---|---|
| uso de `Service References/<N>` | `Integration:wcf:<N>` | `service:<N>` |
| uso de `Web References/<N>` | `Integration:soap:<N>` | `service:<N>` |
| `Inherits ClientBase(Of T)` | `Integration:wcf:<T>` | `service:<T>` |
| `Inherits SoapHttpClientProtocol` | `Integration:soap:<Clase>` | `service:<Clase>` |
| cliente REST con URL literal | `Integration:rest:<host>` | `http:<host>` |
| cliente REST con clave de configuración | `Integration:rest:<K>` | `http:<K>` |
| cliente REST dinámico | `Integration:rest:dynamic` (+ advertencia) | — |
| endpoint de cliente `contract=<N>.<I>` para una referencia `<N>` anotada | `Integration:wcf:<N>.<I>@<host>` | — |
| paquete / referencia de terceros | — | `<NombreSimple>` |
| dependencia EOL | `Dependency:eol:<Nombre>` + issue | — |
| `ProjectReference` ausente | — | `project:<Nombre>` |

## Issue
`EOL_DEPENDENCY`: `Type = DEPENDENCY`, `Severity = WARNING`, `Line = 0`, `Location = <proyecto>.vbproj`, `Message = "Dependency '<Nombre>' has reached end of life: <razón>. Plan its replacement."`

## Advertencias de usuario
- `Outbound URL is not a literal or a configuration key in <id> (<file>:<line>)`
- `Referenced projects not included in the analyzed sources: <A>, <B>` (una por análisis)
- `Setup project(s) without support since Visual Studio 2010: <X.vdproj>, <Y.vdproj>` (una por análisis)

## Configuración
| Campo | Tipo | Default |
|---|---|---|
| `integrations.outbound` | `auto\|on\|off` | `auto` |
| `dependencies.enabled` | `auto\|on\|off` | `auto` |
| `dependencies.eol` | string[] (prefijos) | `[]` |

## `schema/eol-dependencies.json`
`[{ "prefix": string, "maxVersion"?: string ("5" = cualquier 5.x o inferior), "reason": string }]`, orden ordinal por prefijo.
