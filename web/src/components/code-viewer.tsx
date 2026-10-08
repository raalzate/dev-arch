"use client";

// Source of a component, read through the analysis it belongs to (007-native-engine-runtime; FR-017, FR-019):
// GET /api/source?jobId=<analysis>&path=<path relative to the project root>.
import React, { useState, useEffect } from 'react';
import { Loader2, FileCode, AlertCircle } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getSource } from '@/lib/analyses-client';

interface CodeViewerProps {
  jobId: string;
  filePath: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ jobId, filePath }) => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getSource(jobId, filePath)
      .then((r) => { if (!cancelled) setContent(r.content); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Error desconocido'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [jobId, filePath]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">Cargando código fuente...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" data-testid="code-viewer-error">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar el archivo</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const lines = content?.split('\n') ?? [];
  return (
    <div className="rounded-md border bg-muted/30">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50 rounded-t-md">
        <FileCode className="h-4 w-4 text-primary" />
        <span className="text-xs font-mono truncate">{filePath}</span>
      </div>
      <ScrollArea className="h-[60vh] w-full p-4">
        <div className="flex gap-4 text-xs font-mono">
          <pre aria-hidden className="text-right text-muted-foreground/50 select-none border-r pr-4">
            {lines.map((_, i) => `${i + 1}\n`).join('')}
          </pre>
          <pre data-testid="code-viewer-content" className="whitespace-pre text-foreground">{content}</pre>
        </div>
      </ScrollArea>
    </div>
  );
};

export default CodeViewer;
