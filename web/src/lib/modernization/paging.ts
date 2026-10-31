// 027-large-project-ux (FR-030): pagination of long lists ("Mostrar más"), pure and deterministic.
export const PAGE = 150;

export function paginate<T>(rows: readonly T[], pages: number, pageSize = PAGE): { shown: T[]; remaining: number } {
  const n = Math.min(rows.length, Math.max(1, pages) * pageSize);
  return { shown: rows.slice(0, n), remaining: rows.length - n };
}

/** 027 (FR-010): hover dimming is affordable only on small maps. */
export const HOVER_DIM_MAX_COMPONENTS = 300;
export function hoverDimmingEnabled(components: number): boolean {
  return components <= HOVER_DIM_MAX_COMPONENTS;
}
