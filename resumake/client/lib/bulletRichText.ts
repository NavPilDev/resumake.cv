/** Converts between the plain-text-with-embedded-LaTeX-commands format
 * stored in ResumeManifest.textOverrides (e.g. `Built a \textbf{scalable}
 * system`) and the HTML a contentEditable bullet field renders/edits (e.g.
 * `Built a <b>scalable</b> system`) — so the Form-mode editor shows real
 * bold/italic/underline instead of the raw \textbf{}/\textit{}/\underline{}
 * syntax, while the stored data (and the LaTeX view / compile pipeline)
 * keeps using the real commands unchanged. See lib/latexEscape.ts's
 * escapeLatexWithFormatting for the matching nesting-aware LaTeX escaper. */

const TAG_FOR_COMMAND: Record<string, string> = {
  textbf: "b",
  textit: "i",
  underline: "u",
};

const COMMAND_FOR_TAG: Record<string, string> = {
  b: "textbf",
  strong: "textbf",
  i: "textit",
  em: "textit",
  u: "underline",
};

const FORMATTING_COMMAND_PATTERN = /^\\(textbf|textit|underline)\{/;

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Raw stored bullet text -> HTML for the contentEditable to render. */
export function rawToHtml(raw: string): string {
  let i = 0;

  function parseSegment(insideCommand: boolean): string {
    let out = "";
    while (i < raw.length) {
      const command = FORMATTING_COMMAND_PATTERN.exec(raw.slice(i));
      if (command) {
        i += command[0].length;
        const inner = parseSegment(true);
        const tag = TAG_FOR_COMMAND[command[1]];
        out += `<${tag}>${inner}</${tag}>`;
        continue;
      }
      if (insideCommand && raw[i] === "}") {
        i++;
        return out;
      }
      out += escapeHtml(raw[i]);
      i++;
    }
    return out;
  }

  return parseSegment(false);
}

function serializeNode(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(serializeNode).join("");
  const command = COMMAND_FOR_TAG[tag];
  if (command) return `\\${command}{${inner}}`;
  if (tag === "br") return "\n";
  if (tag === "div" || tag === "p") return `${inner}\n`;
  return inner; // unknown wrapper (e.g. a browser-inserted <span>) — unwrap, keep contents
}

/** contentEditable's live DOM -> raw stored bullet text. */
export function htmlToRaw(el: HTMLElement): string {
  const raw = Array.from(el.childNodes).map(serializeNode).join("");
  return raw.replace(/\n+$/, "");
}
