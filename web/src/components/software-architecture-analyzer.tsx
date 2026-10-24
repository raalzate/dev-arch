"use client";

// State container of the modernization flow (010-modernization-ux; plan "Architecture"). It owns the active analysis
// (only its identifier is kept in the browser, 007 FR-007), its documents, the inference scenario, the edited
// proposals with their engine scores, the active step, the history and the comparison. Every view is a pure
// projection of this state through src/lib/modernization.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Info, ShieldCheck, XCircle } from 'lucide-react';
import type { ConsolidatedArchitecture, DependencyGraph, EntrypointsDocument } from '@static-inference/schema';
import { getArchitectureDocumentation } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import {
  ApiAuthError, ApiRequestError, getActiveJobId, getContracts, getDocuments, getInferenceDefaults, listAnalyses, pollAnalysis,
  reinfer, scoreProposal, setActiveJobId, setApiToken, submitAnalysis, type AnalysisStatus, type HistoryEntry, type Language,
} from '@/lib/analyses-client';
import { compareAnalyses, type Comparison } from '@/lib/modernization/compare';
import { isDefault, toInferenceConfig, type MinViability } from '@/lib/modernization/inference';
import { exportPlanJson, planToMarkdown } from '@/lib/modernization/markdown';
import { buildPlan, type ScoreLike } from '@/lib/modernization/plan';
import { linkedAnalysisId, withoutAnalysisParam } from '@/lib/analysis-link';
import { STEPS, type AnalysisView, type StepId } from '@/lib/modernization/sections';
import { technologyProfile, technologyLabel } from '@/lib/modernization/technology';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { StepRail, TopBar } from './app-shell';
import CodeViewer from './code-viewer';
import ComparisonView, { type ComparedSide } from './comparison-view';
import ComponentDetails from './component-details';
import HistoryPanel from './history-panel';
import type { InferenceUiState } from './inference-panel';
import Landing, { UploadControls, type UploadProps } from './landing';
import PrintReport from './print-report';
import type { ScoreState } from './proposal-card';
import RunProgress from './run-progress';
import FindingsStep from './steps/findings-step';
import MapStep from './steps/map-step';
import PlanStep from './steps/plan-step';
import ProposalsStep from './steps/proposals-step';
import SummaryStep from './steps/summary-step';

interface Docs {
  graph: DependencyGraph;
  architecture: ConsolidatedArchitecture;
  contracts: EntrypointsDocument | null;
}

interface AiDocs {
  loading: boolean;
  text: string | null;
  error: string | null;
  provider: string | null;
  template: string | null;
}

const INITIAL_INFERENCE: InferenceUiState = {
  params: null, loadError: null, values: {}, minViability: null, state: 'original', revision: 0, error: null, lastMs: null,
};
const NO_AI_DOCS: AiDocs = { loading: false, text: null, error: null, provider: null, template: null };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function SoftwareArchitectureAnalyzer() {
  const { toast } = useToast();
  // Active analysis
  const [analysis, setAnalysis] = useState<AnalysisStatus | null>(null);
  const [docs, setDocs] = useState<Docs | null>(null);
  const [language, setLanguage] = useState<Language>('auto');
  const [submitting, setSubmitting] = useState(false);
  const [expired, setExpired] = useState(false);
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const pendingAction = useRef<(() => Promise<void>) | null>(null);
  const pollAbort = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Flow
  const [step, setStep] = useState<StepId>('summary');
  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState<{ file: string; id: string } | null>(null);
  // Inference scenario and edited proposals
  const [inference, setInference] = useState<InferenceUiState>(INITIAL_INFERENCE);
  const [reinferred, setReinferred] = useState<ConsolidatedArchitecture | null>(null);
  const inferenceSeq = useRef(0);
  const inferenceAbort = useRef<AbortController | null>(null);
  const [edits, setEdits] = useState<Record<number, string[]>>({});
  const [scores, setScores] = useState<Record<number, ScoreState>>({});
  const [aiDocs, setAiDocs] = useState<AiDocs>(NO_AI_DOCS);
  // History and comparison
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyState, setHistoryState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null });
  const [comparison, setComparison] = useState<{ a: ComparedSide; b: ComparedSide; cmp: Comparison } | null>(null);

  /** Returns true when the error asked for the API token (the action is retried once it is entered). */
  const handleAuth = useCallback((e: unknown, retry: () => Promise<void>): boolean => {
    if (e instanceof ApiAuthError) {
      pendingAction.current = retry;
      setNeedsToken(true);
      return true;
    }
    return false;
  }, []);

  const resetResults = useCallback(() => {
    inferenceAbort.current?.abort();
    inferenceSeq.current++;
    setDocs(null);
    setStep('summary');
    setSelected(null);
    setSource(null);
    setInference(INITIAL_INFERENCE);
    setReinferred(null);
    setEdits({});
    setScores({});
    setComparison(null);
    setAiDocs(NO_AI_DOCS);
  }, []);

  const refreshHistory = useCallback(async (): Promise<void> => {
    setHistoryState({ loading: true, error: null });
    try {
      setHistory(await listAnalyses());
      setHistoryState({ loading: false, error: null });
    } catch (e) {
      setHistoryState({ loading: false, error: e instanceof ApiAuthError ? null : `No se pudo leer el historial: ${errorText(e)}` });
    }
  }, []);

  const followAnalysis = useCallback(async (jobId: string): Promise<void> => {
    pollAbort.current?.abort();
    const abort = new AbortController();
    pollAbort.current = abort;
    setActiveJobId(jobId);
    setExpired(false);
    try {
      const final = await pollAnalysis(jobId, setAnalysis, abort.signal);
      if (!final || abort.signal.aborted) return;
      if (final.status === 'completed') {
        const [d, contracts] = await Promise.all([getDocuments(jobId), getContracts(jobId).catch(() => null)]);
        if (abort.signal.aborted) return;
        setDocs({ graph: d.graph, architecture: d.architecture, contracts });
      } else if (final.error) {
        toast({ variant: 'destructive', title: 'El análisis falló', description: final.error.message, duration: 9000 });
      }
    } catch (e) {
      if (handleAuth(e, () => followAnalysis(jobId))) return;
      if (e instanceof ApiRequestError && e.status === 404) {
        setActiveJobId(null);
        setAnalysis(null);
        setExpired(true);
        return;
      }
      toast({ variant: 'destructive', title: 'Error', description: errorText(e) });
    }
  }, [handleAuth, toast]);

  useEffect(() => {
    // A link /?analysis=<id> (013, agent tools) opens that analysis; otherwise resume the analysis that was active
    // before a reload (007 FR-007). Then list the recent ones.
    const linked = linkedAnalysisId(window.location.search);
    if (linked) {
      setActiveJobId(linked);
      window.history.replaceState(null, '', withoutAnalysisParam(window.location.href));
    }
    const jobId = getActiveJobId();
    if (jobId) void followAnalysis(jobId);
    void refreshHistory();
    return () => pollAbort.current?.abort();
  }, [followAnalysis, refreshHistory]);

  const openAnalysis = useCallback((jobId: string) => {
    pollAbort.current?.abort();
    resetResults();
    setAnalysis(null);
    setHistoryOpen(false);
    void followAnalysis(jobId);
  }, [followAnalysis, resetResults]);

  const handleAnalyze = async (): Promise<void> => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ variant: 'destructive', title: 'Falta el proyecto', description: 'Elige el archivo .zip del proyecto que quieres analizar.' });
      return;
    }
    pollAbort.current?.abort();
    resetResults();
    setAnalysis(null);
    setSubmitting(true);
    try {
      const { jobId } = await submitAnalysis(file, language);
      void followAnalysis(jobId);
    } catch (e) {
      if (handleAuth(e, handleAnalyze)) return;
      toast({ variant: 'destructive', title: 'No se pudo enviar el análisis', description: errorText(e), duration: 9000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) return;
    setApiToken(tokenInput);
    setNeedsToken(false);
    setTokenInput('');
    const retry = pendingAction.current;
    pendingAction.current = null;
    if (retry) await retry();
  };

  // --- derived views -------------------------------------------------------------------------------------
  const jobId = analysis?.jobId ?? null;
  const profile = useMemo(() => (docs ? technologyProfile(docs.graph) : null), [docs]);
  const activeArchitecture = reinferred ?? docs?.architecture ?? null;
  const warnings = analysis?.warnings;
  const view: AnalysisView | null = useMemo(
    () => (docs && activeArchitecture ? { graph: docs.graph, architecture: activeArchitecture, contracts: docs.contracts, warnings: warnings ?? [] } : null),
    [docs, activeArchitecture, warnings],
  );
  const project = !analysis ? null
    : analysis.projectRoot && analysis.projectRoot !== '.' ? analysis.projectRoot
      : analysis.origin === 'import' ? 'resultados importados' : 'proyecto';
  const completed = analysis?.status === 'completed' && !!view && !!profile;

  const config = useMemo(() => (inference.params ? toInferenceConfig(inference.values, inference.params) : undefined), [inference.params, inference.values]);
  const scoreLikes = useMemo(() => {
    const out: Record<number, ScoreLike> = {};
    for (const [id, s] of Object.entries(scores)) if (s.status === 'done') out[Number(id)] = s.result;
    return out;
  }, [scores]);
  const plan = useMemo(() => {
    if (!view || !profile || !analysis) return null;
    const tuned = !!inference.params && (!isDefault(inference.values, inference.params) || !!inference.minViability);
    const parameters = tuned ? { config: config ?? {}, minViability: inference.minViability } : null;
    return buildPlan(view, profile, { project: project ?? 'proyecto', analysisId: analysis.jobId, finishedAt: analysis.finishedAt, parameters, scores: scoreLikes });
  }, [view, profile, analysis, inference.params, inference.values, inference.minViability, config, project, scoreLikes]);

  // --- inference ------------------------------------------------------------------------------------------
  useEffect(() => {
    if (!completed || inference.params || inference.loadError) return;
    let cancelled = false;
    getInferenceDefaults()
      .then((d) => { if (!cancelled) setInference((s) => ({ ...s, params: d.parameters })); })
      .catch((e) => {
        if (cancelled) return;
        setInference((s) => ({ ...s, loadError: `Los parámetros no están disponibles: ${errorText(e)}` }));
      });
    return () => { cancelled = true; };
  }, [completed, inference.params, inference.loadError]);

  const runInference = useCallback((values: Record<string, number>, minViability: MinViability | null) => {
    if (!jobId || !inference.params) return;
    const params = inference.params;
    inferenceAbort.current?.abort();
    const seq = ++inferenceSeq.current;
    setEdits({});
    setScores({});
    if (isDefault(values, params) && !minViability) {
      setReinferred(null);
      setInference((s) => ({ ...s, values, minViability, state: 'original', error: null, revision: s.revision + 1, lastMs: null }));
      return;
    }
    const abort = new AbortController();
    inferenceAbort.current = abort;
    const started = performance.now();
    setInference((s) => ({ ...s, values, minViability, state: 'pending' }));
    reinfer(jobId, { config: toInferenceConfig(values, params), ...(minViability ? { minViability } : {}) }, abort.signal)
      .then((arch) => {
        if (seq !== inferenceSeq.current) return;
        setReinferred(arch);
        setInference((s) => ({ ...s, state: 'recalculated', error: null, revision: s.revision + 1, lastMs: performance.now() - started }));
      })
      .catch((e) => {
        if (seq !== inferenceSeq.current || abort.signal.aborted) return;
        if (handleAuth(e, async () => runInference(values, minViability))) return;
        setInference((s) => ({ ...s, state: 'error', error: errorText(e), revision: s.revision + 1, lastMs: null }));
      });
  }, [jobId, inference.params, handleAuth]);

  const onParam = (path: string, value: number) => runInference({ ...inference.values, [path]: value }, inference.minViability);
  const onMinViability = (v: MinViability | null) => runInference(inference.values, v);
  const onReset = () => {
    inferenceAbort.current?.abort();
    inferenceSeq.current++;
    setReinferred(null);
    setEdits({});
    setScores({});
    setInference((s) => ({ ...s, values: {}, minViability: null, state: 'original', error: null, revision: s.revision + 1, lastMs: null }));
  };

  const onMove = (from: number, componentId: string, to: number) => {
    if (!jobId || !activeArchitecture) return;
    const base = (id: number) => edits[id] ?? activeArchitecture.proposals.find((p) => p.id === id)?.components ?? [];
    const next = { ...edits, [from]: base(from).filter((c) => c !== componentId), [to]: [...base(to).filter((c) => c !== componentId), componentId] };
    setEdits(next);
    for (const id of [from, to]) {
      const components = next[id];
      if (components.length === 0) {
        setScores((s) => ({ ...s, [id]: { status: 'error', message: 'La propuesta quedó sin componentes; no hay nada que puntuar.' } }));
        continue;
      }
      setScores((s) => ({ ...s, [id]: { status: 'pending' } }));
      scoreProposal(jobId, { components, ...(config && Object.keys(config).length ? { config } : {}) })
        .then((result) => setScores((s) => ({ ...s, [id]: { status: 'done', result } })))
        .catch((e) => setScores((s) => ({ ...s, [id]: { status: 'error', message: `El motor no pudo puntuar la propuesta: ${errorText(e)}` } })));
    }
  };

  // --- AI documentation -----------------------------------------------------------------------------------
  const generateDocs = async () => {
    if (!view) return;
    setAiDocs((d) => ({ ...d, loading: true, error: null }));
    try {
      const r = await getArchitectureDocumentation({ graph: view.graph, architecture: view.architecture, warnings: view.warnings });
      if (r.error) setAiDocs((d) => ({ ...d, loading: false, error: r.error }));
      else setAiDocs({ loading: false, text: r.documentation, error: null, provider: r.provider, template: r.template });
    } catch (e) {
      setAiDocs((d) => ({ ...d, loading: false, error: errorText(e) }));
    }
  };

  // --- comparison -----------------------------------------------------------------------------------------
  const compare = async (a: string, b: string): Promise<void> => {
    const [ea, eb] = [history.find((h) => h.jobId === a), history.find((h) => h.jobId === b)];
    try {
      const [da, db] = await Promise.all([getDocuments(a), getDocuments(b)]);
      const side = (id: string, e: HistoryEntry | undefined, g: DependencyGraph): ComparedSide => ({
        jobId: id,
        project: e?.projectRoot ?? e?.origin ?? id,
        label: e?.technologyLabel ?? technologyLabel(technologyProfile(g).technology),
        createdAt: e?.createdAt ?? '',
      });
      setComparison({ a: side(a, ea, da.graph), b: side(b, eb, db.graph), cmp: compareAnalyses(da, db) });
      setHistoryOpen(false);
    } catch (e) {
      if (handleAuth(e, () => compare(a, b))) return;
      setHistoryState((s) => ({ ...s, error: `No se pudieron comparar: ${errorText(e)}` }));
    }
  };

  const openHistory = () => {
    setHistory([]); // never show a stale list: rows appear once the server answered
    setHistoryOpen(true);
    void refreshHistory();
  };

  // --- render ---------------------------------------------------------------------------------------------
  const uploadProps: UploadProps = { fileRef, language, onLanguage: setLanguage, onAnalyze: () => void handleAnalyze(), busy: submitting };
  const showLanding = !analysis && !comparison;
  const canOpenSource = !!analysis?.hasSources;
  const byId = useMemo(() => new Map((docs?.graph.components ?? []).map((c) => [c.id, c])), [docs]);
  const selectedComponent = selected ? byId.get(selected) ?? null : null;
  const details = selectedComponent && profile ? (
    <ComponentDetails
      component={selectedComponent}
      profile={profile}
      canOpenSource={canOpenSource}
      onOpenSource={(file, id) => setSource({ file, id })}
      onSelect={setSelected}
      onClose={() => setSelected(null)}
    />
  ) : null;

  const counts: Partial<Record<StepId, number>> = view
    ? {
      map: view.graph.components.length,
      proposals: view.architecture.proposals.length,
      findings: view.graph.components.reduce((n, c) => n + c.code_issues.length, 0),
      plan: plan?.stages.length,
    }
    : {};
  const stepInfo = STEPS.find((s) => s.id === step)!;

  return (
    <>
      <div className="min-h-screen print:hidden">
        <TopBar
          project={docs ? project : null}
          profile={completed ? profile : null}
          status={analysis}
          onHistory={openHistory}
          upload={showLanding ? null : <UploadControls {...uploadProps} compact />}
        />

        {(needsToken || expired || analysis?.status === 'failed') && (
          <div className="mx-auto max-w-[1320px] space-y-3 px-4 pt-4">
            {needsToken && (
              <div className="rounded-md border border-border bg-card p-4">
                <p className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" aria-hidden />Este servidor exige un token de acceso</p>
                <p className="text-sm text-muted-foreground">Se guarda solo durante esta sesión del navegador.</p>
                <div className="mt-3 flex max-w-md gap-2">
                  <input
                    data-testid="api-token-input"
                    type="password"
                    autoComplete="off"
                    placeholder="Token de acceso"
                    aria-label="Token de acceso"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleTokenSubmit(); }}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  />
                  <button type="button" data-testid="api-token-submit" onClick={() => void handleTokenSubmit()} className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                    Continuar
                  </button>
                </div>
              </div>
            )}
            {expired && (
              <p data-testid="analysis-expired" role="status" className="flex items-start gap-2 rounded-md border border-border bg-card p-4 text-sm">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                El análisis que tenías abierto caducó o ya no existe en el servidor. Sube de nuevo el .zip para analizarlo otra vez.
              </p>
            )}
            {analysis?.status === 'failed' && analysis.error && (
              <div data-testid="analysis-error" role="alert" className="flex items-start gap-2 rounded-md border bg-card p-4 text-sm" style={{ borderColor: 'color-mix(in srgb, var(--sev-critical) 40%, transparent)' }}>
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--sev-critical)' }} aria-hidden />
                <div>
                  <p className="font-medium">El análisis falló ({analysis.error.code})</p>
                  <p className="text-muted-foreground">{analysis.error.message}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {showLanding && (
          <Landing upload={uploadProps} recent={history} onOpen={openAnalysis} onImported={openAnalysis} onImportError={(e) => handleAuth(e, async () => undefined)} />
        )}

        {comparison && (
          <main className="mx-auto max-w-[1320px] px-4 py-6">
            <ComparisonView a={comparison.a} b={comparison.b} cmp={comparison.cmp} onClose={() => setComparison(null)} />
          </main>
        )}

        {!comparison && analysis && !completed && analysis.status !== 'failed' && (
          <main className="mx-auto max-w-[1320px] px-4 py-8">
            {analysis.status === 'completed' ? (
              <p className="text-sm text-muted-foreground">Leyendo los resultados del análisis…</p>
            ) : (
              <RunProgress status={analysis} />
            )}
          </main>
        )}

        {!comparison && completed && view && profile && (
          <div className="mx-auto flex max-w-[1560px] flex-col gap-4 px-4 py-4 md:flex-row md:gap-6 md:py-6">
            <div className="md:w-[216px] md:shrink-0">
              <div className="md:sticky md:top-[72px]">
                <StepRail active={step} counts={counts} onSelect={setStep} />
              </div>
            </div>
            <main className="min-w-0 max-w-[1320px] flex-1">
              <section data-testid="step-panel" data-step={step} aria-labelledby="step-title" className="space-y-4">
                <header>
                  <h1 id="step-title" className="text-lg font-semibold tracking-tight">{stepInfo.label}</h1>
                  <p className="text-sm text-muted-foreground">{stepInfo.question}</p>
                </header>
                {step === 'summary' && (
                  <SummaryStep
                    view={view}
                    profile={profile}
                    canOpenSource={canOpenSource}
                    onOpenSource={(file, id) => setSource({ file, id })}
                    onDetails={(id) => { setSelected(id); setStep('map'); }}
                    onGoProposals={() => setStep('proposals')}
                  />
                )}
                {step === 'map' && <MapStep view={view} profile={profile} selectedId={selected} onSelect={setSelected} details={details} />}
                {step === 'proposals' && (
                  <ProposalsStep
                    view={view}
                    profile={profile}
                    inference={inference}
                    edits={edits}
                    scores={scores}
                    onParam={onParam}
                    onMinViability={onMinViability}
                    onReset={onReset}
                    onMove={onMove}
                  />
                )}
                {step === 'findings' && <FindingsStep view={view} profile={profile} onSelect={setSelected} details={details} />}
                {step === 'plan' && plan && (
                  <PlanStep
                    plan={plan}
                    markdown={() => planToMarkdown(plan)}
                    json={() => exportPlanJson(view.architecture, plan.parameters)}
                    onGenerateDocs={() => void generateDocs()}
                    docs={aiDocs}
                  />
                )}
              </section>
            </main>
          </div>
        )}
      </div>

      {completed && plan && <PrintReport plan={plan} />}

      {historyOpen && (
        <HistoryPanel
          entries={history}
          loading={historyState.loading}
          error={historyState.error}
          activeJobId={jobId}
          onOpen={openAnalysis}
          onCompare={(a, b) => void compare(a, b)}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      <Dialog open={!!source} onOpenChange={(o) => { if (!o) setSource(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{source?.id}</DialogTitle>
          </DialogHeader>
          {source && jobId && <CodeViewer jobId={jobId} filePath={source.file} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
