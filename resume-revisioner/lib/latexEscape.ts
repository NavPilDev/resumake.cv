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
 * Ctrl+I/Ctrl+U formatting shortcuts, applied through the rich contentEditable
 * bullet editor — see lib/bulletRichText.ts) — real commands, not an
 * abstracted markup syntax, so they must survive escaping verbatim. A small
 * recursive-descent parser (not a flat regex) so nested spans — e.g. bolding
 * text that's already italicized, which the rich editor can legitimately
 * produce — still round-trip correctly instead of falling through to be
 * escaped as plain text. Everything outside a formatting command still goes
 * through escapeLatex as normal, character by character. */
const FORMATTING_COMMAND_PATTERN = /^\\(textbf|textit|underline)\{/;

export function escapeLatexWithFormatting(text: string): string {
  let i = 0;

  function parseSegment(insideCommand: boolean): string {
    let out = "";
    while (i < text.length) {
      const command = FORMATTING_COMMAND_PATTERN.exec(text.slice(i));
      if (command) {
        i += command[0].length;
        const inner = parseSegment(true);
        out += `\\${command[1]}{${inner}}`;
        continue;
      }
      if (insideCommand && text[i] === "}") {
        i++;
        return out;
      }
      out += escapeLatex(text[i]);
      i++;
    }
    return out;
  }

  return parseSegment(false);
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
