# Guía para Desarrolladores

## 🏗️ Arquitectura de la Aplicación

### Frontend (Next.js 15 + React)

La aplicación está construida usando el Next.js App Router con componentes Server y Client.

#### Componentes Principales

**`software-architecture-analyzer.tsx`** (Client Component)
- Componente principal que maneja todo el estado de la aplicación
- Gestiona carga de archivos, análisis y visualización
- Usa LocalStorage para cachear resultados de análisis
- Coordina 3 vistas principales: Análisis, Grafo y Documentación IA

**`component-graph.tsx`** (Client Component)
- Visualización D3.js del grafo de dependencias
- Renderiza nodos como componentes Java
- Colorea nodos según cluster/propuesta
- Implementa zoom, drag e interacciones

**`proposal-card.tsx`** (Client Component)  
- Muestra propuestas de microservicios
- Permite editar nombre, viabilidad y justificación
- Calcula y muestra métricas del cluster

### Backend (Next.js API Routes)

**`/api/analyze/route.ts`** (Server Route)
- Recibe archivo ZIP del proyecto Java
- Extrae y ejecuta `java-dependency-extractor.jar`
- Procesa `output.json` y `output_architecture.json`
- Retorna datos estructurados al frontend

### IA (Google Genkit + Gemini)

**`src/ai/genkit.ts`**
- Configura la instancia de Genkit
- Conecta con Google Gemini AI
- Define modelo por defecto (`gemini-2.5-flash`)

**`src/ai/flows/generate-architecture-documentation.ts`**
- Define el flujo de generación de documentación
- Pre-stringify JSON data para templates Handlebars
- Usa prompt especializado en análisis de arquitectura Java
- Retorna documentación en Markdown

## 🔌 API Reference

### Server Actions

#### `getArchitectureDocumentation(input)`

Genera documentación técnica de arquitectura usando IA.

**Parámetros:**
```typescript
interface ArchitectureDocumentationInput {
  archData: any;      // Datos de output_architecture.json
  componentsData: any; // Datos de output.json
}
```

**Retorna:**
```typescript
{
  documentation: string | null;  // Markdown document
  error: string | null;           // Error message if failed
}
```

**Uso:**
```typescript
import { getArchitectureDocumentation } from '@/app/actions';

const result = await getArchitectureDocumentation({ 
  archData, 
  componentsData 
});
```

### API Routes

#### `POST /api/analyze`

Analiza un proyecto Java desde un archivo ZIP.

**Request:**
- Content-Type: `multipart/form-data`
- Body: FormData con campo `file` (archivo .zip)

**Response:**
```json
{
  "componentsData": {
    "components": [...]
  },
  "archData": {
    "project_metadata": {...},
    "proposals": [...],
    "support_libraries": [...],
    "summary": "..."
  }
}
```

**Códigos de Estado:**
- `200`: Análisis exitoso
- `400`: Archivo no proporcionado o formato inválido
- `500`: Error en el análisis

## 🗂️ Estructura de Datos

### ComponentsData

```typescript
interface ComponentsData {
  components: Component[];
}

interface Component {
  id: string;                    // Nombre completo de la clase
  layer?: string;                 // Capa arquitectónica
  loc?: number;                   // Líneas de código
  cbo?: number;                   // Coupling Between Objects
  lcom?: number;                  // Lack of Cohesion
  interface?: boolean;            // ¿Es interfaz?
  ejb_type?: string;             // Tipo EJB si aplica
  annotations?: string[];         // Anotaciones Java
  extends?: string;              // Clase padre
  implements?: string[];         // Interfaces implementadas
  tables_used?: string[];        // Tablas de BD accedidas
  external_dependencies?: string[]; // Dependencias externas
  secrets_references?: string[]; // Referencias a secretos
  sensitive_data?: boolean;      // ¿Maneja datos sensibles?
  messaging_type?: string;       // Tipo de mensajería
  messaging_role?: string;       // Rol en mensajería
  web_type?: string;             // Tipo web (REST, SOAP)
  web_role?: string;             // Rol web (Controller, etc)
  calls_out?: string[];          // Componentes que llama
}
```

### ArchitectureData

```typescript
interface ArchitectureData {
  project_metadata: ProjectMetadata;
  proposals: Proposal[];
  support_libraries?: SupportLibrary[];
  summary: string;
}

interface ProjectMetadata {
  shared_domain: string;
  total_components: number;
  total_loc: number;
  components_with_secrets: number;
  external_dependencies: Record<string, string>;
  package_dependencies: Record<string, string[]>;
}

interface Proposal {
  id: number;
  name: string;
  viability: 'Alta' | 'Media' | 'Baja';
  components: string[];           // IDs de componentes
  metrics: {
    size: number;
    cohesion_avg: number;
    external_coupling: number;
    tables?: string[];
    sensitive: boolean;
  };
  rationale: string[];
}
```

## 🎨 Personalización de Estilos

### Theme Configuration

Los colores se definen en `tailwind.config.ts`:

```typescript
colors: {
  primary: { /* Deep Indigo */ },
  secondary: { /* Soft Lavender */ },
  // ...
}
```

### Componentes UI

Todos los componentes UI base están en `src/components/ui/` y siguen el sistema [shadcn/ui](https://ui.shadcn.com/).

Para agregar un nuevo componente:
```bash
npx shadcn@latest add [component-name]
```

## 🔧 Desarrollo de Nuevas Funcionalidades

### Agregar un Nuevo Flujo de IA

1. Crea un nuevo archivo en `src/ai/flows/`:

```typescript
// src/ai/flows/my-new-flow.ts
import { ai } from '@/ai/genkit';
import { z } from 'zod';

const InputSchema = z.object({
  // Define tu schema
});

const OutputSchema = z.object({
  // Define tu schema
});

const myPrompt = ai.definePrompt({
  name: 'myNewPrompt',
  input: { schema: InputSchema },
  output: { schema: OutputSchema },
  prompt: `Tu prompt aquí...`
});

export const myNewFlow = ai.defineFlow(
  {
    name: 'myNewFlow',
    inputSchema: InputSchema,
    outputSchema: OutputSchema,
  },
  async (input) => {
    const { output } = await myPrompt(input);
    return output!;
  }
);
```

2. Crea una Server Action en `src/app/actions.ts`:

```typescript
export async function callMyNewFlow(input: MyInput) {
  try {
    const result = await myNewFlow(input);
    return { result, error: null };
  } catch (error) {
    return { result: null, error: error.message };
  }
}
```

3. Usa en tu componente:

```typescript
import { callMyNewFlow } from '@/app/actions';

const handleAction = async () => {
  const { result, error } = await callMyNewFlow(myData);
  // ...
};
```

### Agregar una Nueva Métrica

Para agregar una nueva métrica en el análisis de componentes:

1. Actualiza el tipo `Component` en `src/lib/types.ts`
2. Modifica `java-dependency-extractor.jar` para extraer la nueva métrica
3. Actualiza los componentes de visualización para mostrar la métrica

## 🧪 Testing

### Unit Tests

```bash
# TODO: Agregar framework de testing (Jest/Vitest)
npm run test
```

### E2E Tests

```bash
# TODO: Agregar Playwright o Cypress
npm run test:e2e
```

## 📦 Deployment

### Build de Producción

```bash
npm run build
```

Esto genera una build optimizada en `.next/`.

### Variables de Entorno (Producción)

Asegúrate de configurar:
- `GOOGLE_GENAI_API_KEY` - API key de Google Gemini
- `LLM_MODEL` - Modelo a usar (opcional, default: `gemini-2.5-flash`)

### Despliegue en Vercel

La aplicación está lista para desplegarse en Vercel:

1. Conecta tu repositorio en [vercel.com](https://vercel.com)
2. Configura las variables de entorno
3. Deploy automático en cada push

### Despliegue en Firebase Hosting

Ver `apphosting.yaml` para configuración.

## 🐛 Debugging

### Activar Logs de Genkit

```bash
export GENKIT_ENV=dev
npm run dev
```

### Genkit Dev UI

Para depurar flujos de IA:

```bash
npm run genkit:dev
```

Esto abre una UI en `http://localhost:4000` donde puedes:
- Probar flujos manualmente
- Ver traces de ejecución
- Depurar prompts
- Ver uso de tokens

### React DevTools

Instala la extensión de React DevTools para inspeccionar componentes y estado.

## 💡 Tips & Best Practices

1. **LocalStorage**: Los datos se cachean automáticamente. Usa "Limpiar Datos" si necesitas refrescar.

2. **Performance**: El grafo puede ser pesado con +100 nodos. Considera paginación o filtrado.

3. **AI Costs**: Cada generación de documentación consume tokens de Gemini. Usa con moderación.

4. **Type Safety**: Mantén los tipos en `src/lib/types.ts` sincronizados con el output del JAR.

5. **Error Handling**: Usa `try/catch` y muestra errores claros al usuario mediante toasts.

## 📚 Recursos Adicionales

- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Genkit Docs](https://firebase.google.com/docs/genkit)
- [D3.js Gallery](https://observablehq.com/@d3/gallery)
- [shadcn/ui Components](https://ui.shadcn.com/docs/components)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
