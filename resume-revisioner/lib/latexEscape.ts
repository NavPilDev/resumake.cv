const ESCAPE_MAP: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "&": "\\&",
  "%": "\\%",
  $: "\\$",
  "#": "\\#",
  _: "\\_",
  "{": "\\{",
  "}": "\\}",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

/** Escapes LaTeX special characters. A single regex pass with a replacer
 * function (rather than sequential .replace calls) so the backslashes this
 * function inserts are never themselves re-escaped. */
export function escapeLatex(text: string): string {
  return text.replace(/[\\&%$#_{}~^]/g, (ch) => ESCAPE_MAP[ch] ?? ch);
}

/** Safe basename for a filename the user typed into the UI — no path
 * separators, no traversal, no extension (caller appends .tex/.pdf). */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .trim()
    .replace(/\.(tex|pdf)$/i, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || "tailored-resume";
}
