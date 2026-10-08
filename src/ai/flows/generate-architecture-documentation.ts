'use server';

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ArchitectureDocumentationInputSchema = z.object({
  archData: z.any().describe('Datos de análisis de arquitectura (output_architecture.json).'),
  componentsData: z.any().describe('Datos de componentes detallados (output.json).')
});

export type ArchitectureDocumentationInput = z.infer<typeof ArchitectureDocumentationInputSchema>;

const PromptInputSchema = z.object({
  archData: z.string(),
  componentsData: z.string()
});

const ArchitectureDocumentationOutputSchema = z.object({
  documentation: z.string().describe('Documentación técnica generada en Markdown.'),
});

export type ArchitectureDocumentationOutput = z.infer<typeof ArchitectureDocumentationOutputSchema>;

export async function generateArchitectureDocumentation(input: ArchitectureDocumentationInput): Promise<ArchitectureDocumentationOutput> {
  return generateArchitectureDocumentationFlow(input);
}

const docPrompt = ai.definePrompt({
  name: 'generateJavaArchitectureDoc',
  input: { schema: PromptInputSchema },
  output: { schema: ArchitectureDocumentationOutputSchema },
  prompt: `**Rol:** Actúa como un Arquitecto de Software Senior especializado en Ecosistemas Java y Modernización de Aplicaciones.

**Contexto:** Estás analizando un proyecto Java existente. No conoces a priori si es un proyecto moderno (Spring Boot 3, Quarkus), legado (Java EE, EJB), o qué patrón arquitectónico sigue (MVC, Hexagonal, N-Capas, Espagueti).

**Objetivo:** Generar una Documentación Técnica ("Technical Design Document") en Markdown que diagnostique la naturaleza del proyecto, explique su estructura y evalúe las propuestas de refactorización.

**Insumos:**
1.  **Metadatos y Análisis (archData):** {{{archData}}}
2.  **Inventario de Componentes (componentsData):** {{{componentsData}}}

**Instrucciones de Análisis Forense (Java):**

1.  **Identificación del "Sabor" de Java:**
    * Analiza \`external_dependencies\` y las anotaciones en \`componentsData\`.
    * **Framework:** ¿Es Spring Boot? (busca \`org.springframework\`), ¿Jakarta EE/Java EE? (busca \`javax.*\`, \`jakarta.*\`, EJBs), ¿Quarkus/Micronaut?
    * **Persistencia:** ¿JPA/Hibernate? ¿MyBatis? ¿JDBC puro?
    * **Utilidades:** ¿Usa Lombok, MapStruct, Jackson?

2.  **Deducción del Patrón Arquitectónico:**
    * Analiza la estructura de paquetes y sufijos de clases.
    * **Hexagonal/Clean:** Busca términos como \`port\`, \`adapter\`, \`usecase\`, \`domain\`.
    * **Layered (Capas):** Busca \`controller\`, \`service\`, \`repository/dao\`, \`model/entity\`.
    * **Legacy/Monolito:** Busca paquetes gigantes, clases \`Manager\`, o mezcla de lógica de UI y BD.
    * *Declara explícitamente qué patrón detectas.*

3.  **Análisis de Calidad (Métricas Java):**
    * Interpreta CBO (Coupling) y LCOM (Cohesion) en el contexto de clases Java.
    * Identifica "Clases Dios" (God Classes) si ves métricas desproporcionadas.

**Estructura del Documento a Generar (Markdown en Español):**

### 1. Ficha Técnica del Proyecto
* **Nombre del Módulo/Sistema:** (Basado en \`shared_domain\`).
* **Arquetipo Java Detectado:** (Ej. "Aplicación Spring Boot Web" o "Monolito Java EE Legacy").
* **Dependencias Clave:** Tabla con versiones detectadas de librerías principales.

### 2. Diagrama y Estructura
* **Arquitectura Lógica:** Describe las capas identificadas y su responsabilidad.
* **Diagrama de Componentes (Mermaid):**
    Genera un \`mermaid classDiagram\` conceptual que muestre cómo interactúan los tipos de componentes detectados (Ej. \`Controller\` -> \`Service\` -> \`Repository\`). Usa las relaciones \`calls_out\` para validar esto.

### 3. Modelo de Dominio y Datos
* **Entidades Principales:** Lista las clases que representan tablas de base de datos (busca \`tables_used\` o anotaciones \`@Entity\`).
* **Gestión de Datos Sensibles:** Indica qué componentes manejan información sensible (\`sensitive_data: true\`) y requieren auditoría de seguridad.

### 4. Evaluación de Salud del Código
* **Métricas Globales:** Resumen de LOC, total de componentes y dependencias.
* **Puntos Calientes (Hotspots):**
    * Componentes con **Alto Acoplamiento (CBO > 4)**: Difíciles de testear/mantener.
    * Componentes con **Baja Cohesión**: Posibles candidatos a refactorizar (Single Responsibility Principle).
    * **Manejo de Excepciones:** ¿Existe un manejo centralizado (ej. \`@ControllerAdvice\`) o es disperso?

### 5. Propuestas de Modernización / Modularización
* Analiza la sección \`proposals\` del JSON.
* Para cada Cluster propuesto:
    * **Nombre y Viabilidad:** ¿Es viable extraer esto como un microservicio o módulo Maven/Gradle separado?
    * **Análisis Funcional:** ¿Los componentes agrupados tienen sentido semántico juntos? (Ej. ¿Junta toda la lógica de 'Facturación'?).
    * **Veredicto del Arquitecto:** Tu opinión experta sobre si aceptar, rechazar o modificar esta propuesta.

### 6. Conclusiones y Roadmap
* Resumen del estado actual.
* 3 acciones inmediatas recomendadas para el equipo de desarrollo.

**Tono:** Profesional, constructivo y técnicamente preciso.
`,
});

const generateArchitectureDocumentationFlow = ai.defineFlow(
  {
    name: 'generateArchitectureDocumentationFlow',
    inputSchema: ArchitectureDocumentationInputSchema,
    outputSchema: ArchitectureDocumentationOutputSchema,
  },
  async (input) => {
    const promptInput = {
      archData: JSON.stringify(input.archData, null, 2),
      componentsData: JSON.stringify(input.componentsData, null, 2)
    };

    const { output } = await docPrompt(promptInput, {
      config: {
        temperature: 0.2, // Mantener bajo para análisis factual
      }
    });

    return output!;
  }
);