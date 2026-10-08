# Analizador de Arquitectura de Software Java

Una herramienta potente para analizar, visualizar y modernizar aplicaciones Java existentes mediante IA, proporcionando insights sobre arquitectura, dependencias y propuestas de refactorización a microservicios.

## 🎯 Características Principales

- **Análisis Automatizado**: Analiza proyectos Java completos desde archivos ZIP
- **Visualización de Dependencias**: Grafo interactivo de componentes con código de colores por cluster
- **Propuestas de Microservicios**: Sistema de IA que sugiere cómo dividir monolitos en microservicios
- **Documentación Generada por IA**: Genera documentación técnica de arquitectura automáticamente usando Gemini AI
- **Métricas de Código**: Análisis de CBO (Coupling Between Objects), LCOM (Lack of Cohesion), LOC y más
- **Detección de Patrones**: Identifica arquitecturas (Hexagonal, N-Capas, Spring Boot, Java EE)
- **Análisis de Seguridad**: Detecta componentes con datos sensibles y referencias a secretos

[![Ver video en YouTube](https://img.youtube.com/vi/ndbPA8qsZJE/maxresdefault.jpg)](https://youtu.be/ndbPA8qsZJE)

## 🚀 Inicio Rápido

### Prerequisitos

- Node.js 20.x o superior
- npm o yarn
- Google Gemini API Key

### Instalación

1. Clona el repositorio:
```bash
git clone <repository-url>
cd ia-arch-view
```

2. Instala las dependencias:
```bash
npm install
```

3. Configura las variables de entorno:
```bash
# Crea un archivo .env en la raíz del proyecto
cp .env.example .env
```

Añade tu Google Gemini API Key al archivo `.env`:
```
GOOGLE_GENAI_API_KEY=tu_api_key_aqui
LLM_MODEL=gemini-2.5-flash  # Opcional
```

4. Inicia el servidor de desarrollo:
```bash
npm run dev
```

5. Abre [http://localhost:9002](http://localhost:9002) en tu navegador

## 📖 Uso

### 1. Preparación del Proyecto Java

Primero, necesitas analizar tu proyecto Java usando la herramienta Java Dependency Extractor (incluida):

```bash
java -jar java-dependency-extractor.jar /ruta/a/tu/proyecto output.json
```

Esto generará dos archivos JSON:
- `output.json` - Detalles de componentes individuales
- `output_architecture.json` - Análisis de arquitectura y propuestas

### 2. Análisis en la Aplicación

1. Comprime tu proyecto en un archivo ZIP (incluyendo el código fuente Java)
2. Sube el archivo ZIP usando el botón "Analizar Proyecto (.zip)"
3. La aplicación procesará automáticamente tu proyecto y generará el análisis

### 3. Exploración de Resultados

La aplicación ofrece tres vistas principales:

#### **Análisis General**
- Métricas clave del proyecto (componentes totales, LOC, tablas BD)
- Tipos de componentes (EJB, interfaces, obsoletos)
- Dependencias externas
- Propuestas de microservicios con métricas de viabilidad

#### **Grafo de Componentes**
- Visualización interactiva de dependencias
- Componentes coloreados por cluster propuesto
- Zoom, arrastre e inspección de nodos
- Tooltips con información detallada

#### **Documentación IA**
- Documentación técnica generada automáticamente
- Análisis forense del stack tecnológico Java
- Evaluación de arquitectura y patrones
- Recomendaciones de modernización

## 🏗️ Arquitectura del Proyecto

```
/
├── src/
│   ├── ai/                     # Configuración de Genkit y flujos de IA
│   │   ├── genkit.ts          # Setup de Gemini AI
│   │   └── flows/             # Flujos de generación de IA
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx           # Página principal
│   │   ├── actions.ts         # Server Actions
│   │   └── api/               # API Routes
│   ├── components/            # Componentes React
│   │   ├── ui/                # Componentes UI base (shadcn/ui)
│   │   ├── software-architecture-analyzer.tsx  # Componente principal
│   │   ├── component-graph.tsx                # Visualización del grafo
│   │   └── proposal-card.tsx                   # Tarjetas de propuestas
│   ├── lib/                   # Utilidades y tipos
│   └── hooks/                 # React hooks personalizados
├── docs/                      # Documentación del proyecto
├── java-dependency-extractor.jar  # Herramienta de análisis Java
└── public/                    # Assets estáticos
```

## 🎨 Stack Tecnológico

- **Framework**: Next.js 15 (App Router)
- **UI**: React 18 + TypeScript
- **Componentes**: shadcn/ui + Radix UI
- **Estilos**: Tailwind CSS
- **IA**: Google Gemini (via Genkit)
- **Visualización**: D3.js para grafos
- **Estado**: React Hooks + LocalStorage
- **Análisis Java**: Custom JAR (Java Dependency Extractor)

## 🔧 Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia servidor de desarrollo en puerto 9002

# Genkit (IA Development)
npm run genkit:dev       # Inicia Genkit dev UI
npm run genkit:watch     # Genkit con auto-reload

# Producción
npm run build            # Build de producción
npm run start            # Servidor de producción

# Calidad de Código
npm run lint             # ESLint
npm run typecheck        # TypeScript check
```

## 📊 Métricas y Análisis

### Métricas de Componentes
- **LOC**: Líneas de código
- **CBO**: Acoplamiento entre objetos (recomendado < 5)
- **LCOM**: Falta de cohesión en métodos (menor es mejor)

### Evaluación de Propuestas
Las propuestas de microservicios incluyen:
- **Cohesión Promedio**: Qué tan relacionados están los componentes
- **Acoplamiento Externo**: Dependencias hacia otros clusters
- **Viabilidad**: Alta, Media, Baja
- **Justificación**: Razones técnicas para la agrupación

## 🔐 Seguridad

- El análisis se ejecuta localmente (excepto generación de documentación por IA)
- Los datos se almacenan en LocalStorage del navegador
- Las API keys deben configurarse en variables de entorno (nunca en el código)
- Detección automática de componentes con datos sensibles


### El grafo no se renderiza
- Asegúrate de que el análisis se haya completado exitosamente
- Verifica que existan datos en `output.json` y `output_architecture.json`
- Revisa la consola del navegador para errores

### Error de API Key de Gemini
- Verifica que `GEMINI_API_KEY` esté configurada en `.env`
- Asegúrate de que la API key sea válida y tenga acceso a Gemini
- Reinicia el servidor después de modificar las variables de entorno

## 📝 Próximos Pasos

- [ ] Soporte para múltiples proyectos
- [ ] Exportación de documentación en PDF
- [ ] Comparación de versiones de análisis
- [ ] Integración con sistemas de CI/CD
- [ ] Soporte para otros lenguajes (Kotlin, Scala)

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:
1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👥 Autores

Desarrollado como parte del proyecto de Maestría en Ingeniería de Software

- Raul Alzate <alzategomez.raul@gmail.com>

## 🙏 Agradecimientos

- [shadcn/ui](https://ui.shadcn.com/) por los componentes UI
- [Google Gemini](https://deepmind.google/technologies/gemini/) por la capacidad de IA
- [Firebase Genkit](https://firebase.google.com/docs/genkit) por la integración de IA
- [D3.js](https://d3js.org/) por las visualizaciones de grafos
