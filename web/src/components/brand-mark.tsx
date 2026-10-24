// dev-arch brand mark (013-agent-mcp-bridge, FR-024): three components joined into one, on the primary colour of the
// active theme. The same drawing is the tab icon (src/app/icon.svg).
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg data-testid="brand-mark" viewBox="0 0 32 32" role="img" aria-label="dev-arch" className={className}>
      <rect width="32" height="32" rx="8" fill="hsl(var(--primary))" />
      <path d="M10 11 L22 11 M10 11 L16 22 M22 11 L16 22" stroke="hsl(var(--primary-foreground))" strokeWidth="2" strokeLinecap="round" opacity="0.7" fill="none" />
      <circle cx="10" cy="11" r="3.2" fill="hsl(var(--primary-foreground))" />
      <circle cx="22" cy="11" r="3.2" fill="hsl(var(--primary-foreground))" />
      <circle cx="16" cy="22" r="3.2" fill="hsl(var(--primary-foreground))" />
    </svg>
  );
}
