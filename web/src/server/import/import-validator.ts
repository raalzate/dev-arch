// Validation of imported engine results against the data contract 1.0.0 (007, research D10; FR-020, FR-021).
import { consolidatedArchitectureSchema, dependencyGraphSchema, entrypointsDocumentSchema } from '@static-inference/schema';
import { ApiError } from '../api-error';

export const SUPPORTED_VERSION = '1.0.0';

export interface ImportViolation {
  document: 'graph' | 'architecture' | 'entrypoints';
  pointer: string;
  message: string;
}

export interface ImportedDocuments {
  graph: unknown;
  architecture: unknown;
  entrypoints?: unknown;
}

const SLOTS = [
  { document: 'graph', schema: dependencyGraphSchema, required: true },
  { document: 'architecture', schema: consolidatedArchitectureSchema, required: true },
  { document: 'entrypoints', schema: entrypointsDocumentSchema, required: false },
] as const;

const pointer = (p: (string | number)[]) => '/' + p.map((s) => String(s).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');

export function validateImport(body: unknown): ImportedDocuments {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'The import body must be a JSON object { graph, architecture, entrypoints? }.');
  }
  const docs = body as Record<string, unknown>;
  for (const slot of SLOTS) {
    if (slot.required && (docs[slot.document] === undefined || docs[slot.document] === null)) {
      throw new ApiError(400, 'MISSING_DOCUMENT', `The import needs the "${slot.document}" document.`, { document: slot.document });
    }
  }
  for (const slot of SLOTS) {
    const version = (docs[slot.document] as { meta?: { schema_version?: unknown } } | undefined)?.meta?.schema_version;
    if (typeof version === 'string' && version !== SUPPORTED_VERSION) {
      throw new ApiError(422, 'UNSUPPORTED_SCHEMA_VERSION',
        `The ${slot.document} declares contract version ${version}; supported: ${SUPPORTED_VERSION}.`,
        { document: slot.document, found: version, supported: SUPPORTED_VERSION });
    }
  }
  const violations: ImportViolation[] = [];
  for (const slot of SLOTS) {
    const doc = docs[slot.document];
    if (doc === undefined) continue;
    const r = slot.schema.safeParse(doc);
    if (r.success) continue;
    const found = r.error.issues.map((i) => ({ document: slot.document, pointer: pointer(i.path), message: i.message }));
    found.sort((a, b) => (a.pointer < b.pointer ? -1 : a.pointer > b.pointer ? 1 : 0));
    violations.push(...found);
  }
  if (violations.length > 0) {
    throw new ApiError(422, 'SCHEMA_VIOLATION', `The import violates contract ${SUPPORTED_VERSION} (${violations.length} violations).`, { violations });
  }
  return { graph: docs.graph, architecture: docs.architecture, entrypoints: docs.entrypoints };
}
