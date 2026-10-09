"use client";

// Start of the flow (010 FR-008): upload a ZIP, import earlier results or reopen a recent analysis. The upload
// controls keep the 007 hooks (upload-input, language-select, analyze-button) and also live, compact, in the top
// bar once results are shown, so a new analysis can always be started.
import React, { useEffect, useState } from 'react';
import { FolderArchive, Loader2, Upload } from 'lucide-react';
import type { HistoryEntry, Language } from '@/lib/analyses-client';
import { STATUS_LABELS } from '@/lib/analyses-client';
import ImportDialog from './import-dialog';

export interface UploadProps {
  fileRef: React.RefObject<HTMLInputElement | null>;
  language: Language;
  onLanguage: (l: Language) => void;
  onAnalyze: () => void;
  busy: boolean;
}

export function UploadControls({ fileRef, language, onLanguage, onAnalyze, busy, compact }: UploadProps & { compact?: boolean }) {
  const [name, setName] = useState<string | null>(null);
  const select = (
    <select
      data-testid="language-select"
      aria-label="Lenguaje del proyecto"
      value={language}
      onChange={(e) => onLanguage(e.target.value as Language)}
      className={`rounded-md border border-input bg-background px-2 text-sm ${compact ? 'hidden h-8 lg:block' : 'h-10'}`}
    >
      <option value="auto">Detectar lenguaje</option>
      <option value="java">Java</option>
      <option value="dotnet">.NET (C# / VB)</option>
    </select>
  );
  const input = (
    <input
      id="file-zip"
      data-testid="upload-input"
      type="file"
      accept=".zip"
      ref={fileRef as React.RefObject<HTMLInputElement>}
      onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
      className="sr-only"
    />
  );
  const button = (
    <button
      type="button"
      data-testid="analyze-button"
      onClick={onAnalyze}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 ${compact ? 'h-8 text-sm' : 'h-10'}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
      {compact ? 'Analizar' : 'Analizar proyecto'}
    </button>
  );
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {input}
        <label htmlFor="file-zip" className="inline-flex h-8 max-w-[12rem] cursor-pointer items-center gap-1.5 truncate rounded-md border border-dashed border-input px-2.5 text-sm text-muted-foreground hover:text-foreground">
          <FolderArchive className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{name ?? 'Nuevo .zip'}</span>
        </label>
        {select}
        {button}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {input}
      <label
        htmlFor="file-zip"
        className="flex cursor-pointer items-center gap-4 rounded-md border border-dashed border-input bg-background px-4 py-5 hover:border-primary"
      >
        <FolderArchive className="h-8 w-8 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          <span className="block font-medium">{name ?? 'Elige el .zip del proyecto'}</span>
          <span className="block text-sm text-muted-foreground">Código fuente Java (Maven/Gradle) o .NET (C#, VB.NET). Se analiza en este servidor.</span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        {select}
        {button}
      </div>
    </div>
  );
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function Landing({
  upload, recent, onOpen, onImported, onImportError,
}: {
  upload: UploadProps;
  recent: HistoryEntry[];
  onOpen: (jobId: string) => void;
  onImported: (jobId: string) => void;
  onImportError: (e: unknown) => boolean;
}) {
  return (
    <div className="mx-auto grid max-w-[1120px] gap-8 px-4 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Recorre la modernización de un sistema legacy</h1>
          <p className="mt-2 max-w-[62ch] text-md text-muted-foreground">
            Analiza el código, mira dónde está el acoplamiento real, ajusta las propuestas de extracción y sal con un plan
            ordenado por viabilidad.
          </p>
        </div>
        <section aria-label="Nuevo análisis" className="rounded-md border border-border bg-card p-5">
          <UploadControls {...upload} />
        </section>
        <section className="rounded-md border border-border bg-card p-5">
          <ImportDialog onImported={onImported} onError={onImportError} />
        </section>
      </div>
      <aside className="space-y-3">
        <h2 className="text-base font-semibold">Análisis recientes</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay análisis en este servidor.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-card">
            {recent.slice(0, 6).map((r) => (
              <li key={r.jobId} data-testid="recent-row" className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-sm">{r.projectRoot ?? r.origin}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.technologyLabel ?? '—'} · {STATUS_LABELS[r.status]} · {when(r.createdAt)}
                  </div>
                </div>
                {r.status !== 'failed' && (
                  <button type="button" onClick={() => onOpen(r.jobId)} className="rounded-md border border-border px-2 py-1 text-sm hover:bg-accent">
                    Abrir
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
