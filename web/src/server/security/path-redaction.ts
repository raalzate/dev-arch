// No absolute server paths in API responses (007, decision A3, FR-034, plan note 15).
// Textual and deterministic: the engine JSON keeps its exact formatting, so a web document equals the command-line
// document after applying the same function (SC-007, TS-065).

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => b.length - a.length);
const replaceAll = (s: string, find: string, by: string) => s.split(find).join(by);

/** Removes `<root>/` from every string of a JSON text and turns the exact root into ".". */
export function redactDocument(json: string, roots: string[]): string {
  let out = json;
  for (const root of unique(roots)) {
    const esc = JSON.stringify(root).slice(1, -1);
    out = replaceAll(out, `${esc}/`, '');
    out = replaceAll(out, `"${esc}"`, '"."');
  }
  return out;
}

/** Relativizes the project roots and hides the data directories (`<data>`) in a free text. */
export function redactText(text: string, roots: string[], dataDirs: string[] = []): string {
  let out = text;
  for (const root of unique(roots)) {
    out = replaceAll(out, `${root}/`, '');
    out = out.replace(new RegExp(`${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w./-])`, 'g'), '.');
  }
  for (const dir of unique(dataDirs)) out = replaceAll(out, dir, '<data>');
  return out;
}
