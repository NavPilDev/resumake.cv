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

/** \textbf{}/\textit{}/\underline{} are the only raw LaTeX commands the My
 * Resumes bullet editor ever inserts into stored text (via the Ctrl+B/
 * Ctrl+I/Ctrl+U formatting shortcuts) — real commands, not an abstracted
 * markup syntax, so they must survive escaping verbatim. Everything outside
 * those wrappers still goes through escapeLatex as normal; only their inner
 * text is escaped. Nested/overlapping formatting spans are not supported. */
const FORMATTING_COMMANDS = ["textbf", "textit", "underline"] as const;
const FORMATTING_PATTERN = new RegExp(`\\\\(${FORMATTING_COMMANDS.join("|")})\\{([^{}]*)\\}`, "g");

export function escapeLatexWithFormatting(text: string): string {
  let result = "";
  let lastIndex = 0;
  FORMATTING_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FORMATTING_PATTERN.exec(text))) {
    result += escapeLatex(text.slice(lastIndex, match.index));
    result += `\\${match[1]}{${escapeLatex(match[2])}}`;
    lastIndex = FORMATTING_PATTERN.lastIndex;
  }
  result += escapeLatex(text.slice(lastIndex));
  return result;
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
