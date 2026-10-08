# Configuración de Variables de Entorno

Esta guía explica cómo configurar las variables de entorno necesarias para ejecutar el Analizador de Arquitectura de Software.

## Variables Requeridas

### GOOGLE_GENAI_API_KEY

**Descripción**: API Key para acceder a Google Gemini AI (usado para generar documentación).

**Requerido**: ✅ Sí (para generación de documentación IA)

**Cómo obtenerla**:
1. Visita [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en "Create API Key"
4. Copia la API key generada

**Ejemplo**:
```bash
GOOGLE_GENAI_API_KEY=AIzaSyB...tu_api_key_completa
```

## Variables Opcionales

### LLM_MODEL

**Descripción**: Especifica qué modelo de Gemini usar para generación de documentación.

**Requerido**: ❌ No (default: `gemini-2.5-flash`)

**Opciones Disponibles**:
- `gemini-2.5-flash` - Más rápido, menor costo (recomendado)
- `gemini-2.0-flash-exp` - Experimental
- `gemini-1.5-pro` - Más preciso, mayor costo
- `gemini-1.5-flash` - Balance entre velocidad y precisión

**Ejemplo**:
```bash
LLM_MODEL=gemini-2.5-flash
```

## Configuración Paso a Paso

### 1. Crear archivo .env

En la raíz del proyecto, crea un archivo llamado `.env`:

```bash
# En la terminal, desde la raíz del proyecto
touch .env
```

### 2. Editar .env

Abre el archivo `.env` con tu editor favorito y añade las variables:

```bash
# .env

# API Key de Google Gemini (REQUERIDO)
GOOGLE_GENAI_API_KEY=tu_api_key_aqui

# Modelo de IA (OPCIONAL)
LLM_MODEL=gemini-2.5-flash
```

### 3. Verificar Configuración

Para verificar que las variables están configuradas correctamente:

```bash
# Reinicia el servidor de desarrollo
npm run dev
```

Si hay problemas con la API key, verás un error en la consola cuando intentes generar documentación.

## Variables por Entorno

### Desarrollo Local

Para desarrollo local, usa una API key de desarrollo o personal:

```bash
GOOGLE_GENAI_API_KEY=AIza...
LLM_MODEL=gemini-2.5-flash  # Modelo más económico para desarrollo
```

### Staging/Production

Para producción, configura las variables en tu plataforma de deployment:

**Vercel**:
1. Ve a Project Settings → Environment Variables
2. Añade `GOOGLE_GENAI_API_KEY` con el valor de producción
3. Opcional: Añade `LLM_MODEL` si quieres usar un modelo diferente

**Firebase/Google Cloud**:
```bash
firebase functions:config:set google.api_key="tu_api_key"
```

## Seguridad

⚠️ **NUNCA** commits el archivo `.env` al repositorio:

- El archivo `.env` está incluido en `.gitignore` por defecto
- No compartas tu API key públicamente
- Rota tus API keys regularmente
- Usa API keys diferentes para desarrollo y producción

## Troubleshooting

### Error: "API key not valid"

- Verifica que copiaste la API key completa (incluyendo `AIza...`)
- Asegúrate de que la API key tenga permisos para Gemini AI
- Revisa que no haya espacios antes o después de la key

### Error: "GOOGLE_GENAI_API_KEY is not defined"

- Verifica que el archivo `.env` esté en la raíz del proyecto (no en `/src` o `/docs`)
- Reinicia el servidor de desarrollo después de crear/modificar `.env`
- Asegúrate de que el archivo se llame exactamente `.env` (con el punto al inicio)

### Documentación no se genera

- Verifica que `GOOGLE_GENAI_API_KEY` esté configurada correctamente
- Revisa la consola del navegador y del servidor para errores
- Comprueba tu cuota de uso de la API en Google Cloud Console

## Límites y Cuotas

Google Gemini tiene límites de uso gratuito:

- **Gemini Flash**: 15 requests por minuto, 1500 por día (free tier)
- **Gemini Pro**: 2 requests por minuto, 50 por día (free tier)

Para conocer límites actualizados: [Google AI Pricing](https://ai.google.dev/pricing)

## Recursos Adicionales

- [Google AI Studio](https://makersuite.google.com/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Firebase Genkit Docs](https://firebase.google.com/docs/genkit)

## Análisis asíncronos y servicio del motor (feature 007)

La web mantiene un único proceso del motor en modo MCP (`java -jar engine.jar --mcp`) y guarda cada análisis en disco
(`<ARCHVIEW_DATA_DIR>/jobs/<id>/`: `job.json`, `source/`, `out/`, `engine.log`). Valores inválidos detienen el arranque
con un error que nombra la variable.

| Variable | Defecto | Uso |
|----------|---------|-----|
| `ENGINE_JAR_PATH`, `JAVA_HOME` | `engine-dist/engine.jar`, `java` del PATH | motor (reglas de 006) |
| `ENGINE_JAVA_OPTS` | vacío | opciones de la JVM del motor (ej. `-Xmx2g`) |
| `DOTNET_ANALYZER_PATH` | sin definir | analizador .NET si no está junto al jar |
| `ARCHVIEW_DATA_DIR` | `<cwd>/.archview` | área de los análisis (sin base de datos) |
| `MAX_UPLOAD_BYTES` | 209715200 (200 MiB) | tamaño máximo del ZIP o de una importación |
| `MAX_UNCOMPRESSED_BYTES` | 1073741824 (1 GiB) | tamaño descomprimido máximo |
| `MAX_ZIP_ENTRIES` | 100000 | número máximo de entradas del ZIP |
| `MAX_CONCURRENT_ANALYSES` | 2 | análisis simultáneos (1 sería el valor seguro si el motor no fuera reentrante; TS-064 verde) |
| `MAX_QUEUED_ANALYSES` | 10 | análisis en cola; por encima → 429 `TOO_MANY_ANALYSES` + `Retry-After` |
| `ARCHVIEW_JOB_TTL_HOURS` | 24 | retención de análisis terminados |
| `ARCHVIEW_CLEANUP_INTERVAL_MS` | 600000 | periodo de la limpieza |
| `ANALYSIS_TIMEOUT_MS` | 1800000 (30 min) | tiempo máximo por análisis (`TIMEOUT`) |
| `MAX_SOURCE_VIEW_BYTES` | 2097152 (2 MiB) | tamaño máximo en el visor de código |
| `DEVARCH_ALLOW_LOCAL_PATH` | `true` solo con `NODE_ENV=development` | análisis de una carpeta local del servidor |
| `DEVARCH_API_TOKEN` | sin definir (vacío = sin token) | token compartido: si existe, toda la API exige `Authorization: Bearer <token>` (401 `UNAUTHORIZED`) |
| `HOSTNAME` / `next start -H` | todas las interfaces | dirección de escucha; solo se usa para la advertencia de exposición |
| `STATIC_INFERENCE_CACHE_SIZE` (motor) | 8 | proyectos reutilizados en memoria por el modo MCP (`0` desactiva) |

### Exposición de la API

- Las respuestas de estado, documentos, visor, advertencias y motivos de fallo **no contienen rutas absolutas del servidor**:
  `projectRoot` es relativo y las rutas de `components[*].files` se relativizan a la raíz del proyecto. Excepciones:
  el mensaje `ENGINE_NOT_BUILT`, la ruta obsoleta `POST /api/analyze` y los documentos importados.
- Al arrancar, si la web escucha fuera de `localhost`/`127.0.0.0/8`/`::1` y no hay `DEVARCH_API_TOKEN`, el registro muestra un
  bloque enmarcado con `!!!` que empieza por `dev-arch API is NOT protected`. Para silenciarlo: definir el token o escuchar en
  `127.0.0.1` (`HOSTNAME=127.0.0.1` o `-H 127.0.0.1`). `make dev` escucha en todas las interfaces, por lo que muestra el aviso.
- La interfaz pide el token cuando la API responde 401 y lo guarda solo durante la sesión del navegador
  (`sessionStorage['devarch.apiToken']`).
