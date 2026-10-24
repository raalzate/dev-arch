// Public link of an analysis in the web (013 research D6): DEVARCH_PUBLIC_URL, else the origin of the request.
export function baseUrlOf(request: Request, env: Readonly<Record<string, string | undefined>> = process.env): string {
  const configured = env.DEVARCH_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  const url = new URL(request.url);
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || url.host;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() || url.protocol.replace(/:$/, '');
  return `${proto}://${host}`;
}

export function analysisUrl(baseUrl: string, id: string): string {
  return `${baseUrl}/?analysis=${id}`;
}
