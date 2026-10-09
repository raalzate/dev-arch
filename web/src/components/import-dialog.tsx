"use client";

// Import of results produced earlier by the engine (007-native-engine-runtime; FR-020, FR-021). The files are
// recognized by name: output.json (graph), output_architecture.json (architecture), output_entrypoints.json
// (API contracts, optional).
import React, { useRef, useState } from 'react';
import { FileJson, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiRequestError, importResults, type ImportViolation } from '@/lib/analyses-client';

export function slotOf(fileName: string): 'graph' | 'architecture' | 'entrypoints' | null {
  const n = fileName.toLowerCase();
  if (n.endsWith('_architecture.json')) return 'architecture';
  if (n.endsWith('_entrypoints.json')) return 'entrypoints';
  if (n.endsWith('.json')) return 'graph';
  return null;
}

interface ImportDialogProps {
  onImported: (jobId: string) => void;
  onError: (e: unknown) => boolean;
}

const ImportDialog: React.FC<ImportDialogProps> = ({ onImported, onError }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<{ message: string; violations: ImportViolation[] } | null>(null);

  const handleImport = async () => {
    const files = Array.from(inputRef.current?.files ?? []);
    setProblem(null);
    if (files.length === 0) {
      setProblem({ message: 'Selecciona output.json y output_architecture.json (y opcionalmente output_entrypoints.json).', violations: [] });
      return;
    }
    setBusy(true);
    try {
      const docs: Record<string, unknown> = {};
      for (const f of files) {
        const slot = slotOf(f.name);
        if (!slot) continue;
        try {
          docs[slot] = JSON.parse(await f.text());
        } catch {
          setProblem({ message: `${f.name} no es un JSON válido.`, violations: [] });
          return;
        }
      }
      const { jobId } = await importResults(docs);
      onImported(jobId);
    } catch (e) {
      if (onError(e)) return;
      if (e instanceof ApiRequestError) {
        const violations = (e.details.violations as ImportViolation[] | undefined) ?? [];
        const extra = e.code === 'UNSUPPORTED_SCHEMA_VERSION'
          ? ` (encontrada ${String(e.details.found)}, soportada ${String(e.details.supported)})`
          : e.code === 'MISSING_DOCUMENT' ? ` (${String(e.details.document)})` : '';
        setProblem({ message: `${e.message}${extra}`, violations });
      } else {
        setProblem({ message: e instanceof Error ? e.message : String(e), violations: [] });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="flex items-center text-base font-semibold"><FileJson className="mr-2 h-4 w-4 text-muted-foreground" />Importar resultados existentes</h2>
        <p className="text-sm text-muted-foreground">Abre los JSON que ya generó el motor (línea de comandos o agente) sin volver a analizar.</p>
      </div>
      <div className="space-y-3">
        <Input data-testid="import-input" type="file" accept=".json,application/json" multiple ref={inputRef} />
        <Button data-testid="import-submit" variant="outline" onClick={handleImport} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileJson className="mr-2 h-4 w-4" />}
          Importar
        </Button>
        {problem && (
          <Alert variant="destructive" data-testid="import-errors">
            <AlertTitle>No se pudo importar</AlertTitle>
            <AlertDescription>
              <p>{problem.message}</p>
              {problem.violations.length > 0 && (
                <ul className="list-disc list-inside text-xs font-mono mt-2">
                  {problem.violations.map((v, i) => <li key={i}>{v.document} {v.pointer}: {v.message}</li>)}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
};

export default ImportDialog;
