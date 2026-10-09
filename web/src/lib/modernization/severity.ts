// Visual vocabulary of severities and technology accents (010 FR-014, FR-015, FR-016). Each color has a light and a
// dark variant that reaches WCAG AA (4.5:1) on the panel surface of its theme; globals.css mirrors these values.
import type { CodeIssue } from '@static-inference/schema';
import type { Accent } from './technology';

export type Severity = CodeIssue['severity'];
export const SEVERITIES = ['CRITICAL', 'ERROR', 'WARNING', 'INFO'] as const satisfies readonly Severity[];

export interface Swatch {
  label: string;
  light: string;
  dark: string;
}

export const SURFACES = { light: '#FFFFFF', dark: '#1B202B' } as const;

export const SEVERITY_STYLES: Record<Severity, Swatch> = {
  CRITICAL: { label: 'Crítica', light: '#B42318', dark: '#FF8F85' },
  ERROR: { label: 'Error', light: '#B54708', dark: '#FDB022' },
  WARNING: { label: 'Advertencia', light: '#7A5B00', dark: '#F5D565' },
  INFO: { label: 'Info', light: '#475467', dark: '#B4BFD0' },
};

export const TECH_ACCENTS: Record<Accent, Swatch> = {
  java: { label: 'Java', light: '#A3461F', dark: '#F2A47E' },
  dotnet: { label: '.NET', light: '#6941C6', dark: '#C2AEFF' },
  vb: { label: 'VB.NET', light: '#0E6E78', dark: '#5ED0DA' },
};

export function severityRank(s: Severity): number {
  return SEVERITIES.length - SEVERITIES.indexOf(s);
}

function luminance(hex: string): number {
  const v = hex.replace('#', '');
  const ch = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
