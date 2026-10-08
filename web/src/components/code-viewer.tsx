"use client";

import React, { useState, useEffect } from 'react';
import { Loader2, FileCode, AlertCircle } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface CodeViewerProps {
  filePath: string;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ filePath }) => {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSource = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/source?path=${encodeURIComponent(filePath)}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to fetch source code');
        }

        setContent(result.content);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (filePath) {
      fetchSource();
    }
  }, [filePath]);

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
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error al cargar el archivo</AlertTitle>
        <AlertDescription>
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="rounded-md border bg-muted/30">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50 rounded-t-md">
        <FileCode className="h-4 w-4 text-primary" />
        <span className="text-xs font-mono truncate">{filePath.split('/').pop()}</span>
      </div>
      <ScrollArea className="h-[60vh] w-full p-4">
        <pre className="text-xs font-mono whitespace-pre text-foreground">
          {content?.split('\n').map((line, i) => (
            <div key={i} className="flex gap-4 hover:bg-muted/50 px-2 -mx-2">
              <span className="w-10 text-right text-muted-foreground/50 select-none border-r pr-4">{i + 1}</span>
              <span>{line || ' '}</span>
            </div>
          ))}
        </pre>
      </ScrollArea>
    </div>
  );
};

export default CodeViewer;
