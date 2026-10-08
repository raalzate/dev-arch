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
