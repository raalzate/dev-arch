// Technology, severity and viability badges (010 FR-014..FR-016): always text + color, never color alone.
import React from 'react';
import { cn } from '@/lib/utils';
import { SEVERITY_STYLES, type Severity } from '@/lib/modernization/severity';
import type { Accent, TechnologyProfile } from '@/lib/modernization/technology';

export const ACCENT_VAR: Record<Accent, string> = {
  java: 'var(--tech-java)',
  dotnet: 'var(--tech-dotnet)',
  vb: 'var(--tech-vb)',
};

export function TechBadge({ profile, className }: { profile: Pick<TechnologyProfile, 'technology' | 'label' | 'accent'>; className?: string }) {
  const color = ACCENT_VAR[profile.accent];
  return (
    <span
      data-testid="technology-badge"
      data-technology={profile.technology}
      className={cn('inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap', className)}
      style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)`, background: `color-mix(in srgb, ${color} 9%, transparent)` }}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {profile.label}
    </span>
  );
}

const SEV_VAR: Record<Severity, string> = {
  CRITICAL: 'var(--sev-critical)',
  ERROR: 'var(--sev-error)',
  WARNING: 'var(--sev-warning)',
  INFO: 'var(--sev-info)',
};

export function severityColor(s: Severity): string {
  return SEV_VAR[s];
}

export function SeverityBadge({ severity, count }: { severity: Severity; count?: number }) {
  const color = SEV_VAR[severity];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      {SEVERITY_STYLES[severity].label}
      {count !== undefined && <span className="tabular-nums">{count}</span>}
    </span>
  );
}

const VIAB_VAR: Record<string, string> = { Alta: 'var(--viab-alta)', Media: 'var(--viab-media)', Baja: 'var(--viab-baja)' };

export function ViabilityBadge({ viability, testId, extra }: { viability: string; testId?: string; extra?: Record<string, string> }) {
  const color = VIAB_VAR[viability] ?? 'currentColor';
  return (
    <span
      data-testid={testId}
      {...extra}
      className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
    >
      Viabilidad {viability.toLowerCase()}
    </span>
  );
}
