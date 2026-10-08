"use client";

// Status, phase and warnings of the active analysis (007-native-engine-runtime; FR-007, FR-026).
import React from 'react';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PHASE_LABELS, STATUS_LABELS, type AnalysisStatus, type Phase } from '@/lib/analyses-client';

const ORDER: Phase[] = ['detection', 'extraction', 'inference', 'writing'];

const AnalysisProgress: React.FC<{ status: AnalysisStatus }> = ({ status }) => {
  const active = status.status === 'queued' || status.status === 'running';
  const current = status.phase ? ORDER.indexOf(status.phase) : -1;
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {active && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          {status.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
          {status.status === 'failed' && <XCircle className="h-4 w-4 text-destructive" />}
          <span>Estado:</span>
          <Badge data-testid="analysis-status" data-status={status.status} variant={status.status === 'failed' ? 'destructive' : 'secondary'}>
            {STATUS_LABELS[status.status]}
          </Badge>
          <span>Fase:</span>
          <Badge data-testid="analysis-phase" data-phase={status.phase ?? ''} variant="outline">
            {status.phase ? PHASE_LABELS[status.phase] : status.status === 'queued' ? 'esperando turno' : 'iniciando'}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            Análisis <code data-testid="analysis-id">{status.jobId}</code>
          </span>
        </div>
        <ol className="flex gap-2 text-xs text-muted-foreground">
          {ORDER.map((p, i) => (
            <li key={p} className={i <= current ? 'font-semibold text-primary' : ''}>
              {i + 1}. {PHASE_LABELS[p]}
            </li>
          ))}
        </ol>
        {status.error && (
          <Alert variant="destructive" data-testid="analysis-error">
            <XCircle className="h-4 w-4" />
            <AlertTitle>El análisis falló ({status.error.code})</AlertTitle>
            <AlertDescription>{status.error.message}</AlertDescription>
          </Alert>
        )}
        {status.warnings.length > 0 && (
          <Alert data-testid="analysis-warnings">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Advertencias del análisis ({status.warnings.length})</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-xs font-mono">
                {status.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default AnalysisProgress;
