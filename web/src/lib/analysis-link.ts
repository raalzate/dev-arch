// Deep link to an analysis (013-agent-mcp-bridge, research D6): the agent tools answer <base>/?analysis=<id>; the web
// opens that analysis and drops the parameter from the address bar.
const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function linkedAnalysisId(search: string): string | null {
  const raw = new URLSearchParams(search).get('analysis')?.trim().toLowerCase() ?? '';
  return ID_RE.test(raw) ? raw : null;
}

export function withoutAnalysisParam(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('analysis');
  return url.toString();
}
