import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ResumeAnchor } from "./types";

const execFileAsync = promisify(execFile);
const SYNCTEX_TIMEOUT_MS = 10_000;

export interface SyncTexEditResult {
  texPath: string;
  line: number;
}

const LINE_PATTERN = /^Line:(\d+)/m;
const INPUT_PATTERN = /^Input:(.+)$/m;

/** Inverse SyncTeX search: given a point the user clicked in the compiled
 * PDF (1-based page, x/y in big points from the page's top-left corner —
 * exactly what pdf.js gives after dividing by the render scale, no extra
 * flip needed), asks the `synctex` CLI which .tex file/line produced it.
 * Requires the resume to have been compiled with `-synctex=1` (already the
 * case for every "My Resumes" save — see resolveSavedBuildDir's .latexmkrc)
 * so a .synctex.gz sits next to the PDF. */
export async function runSynctexEdit(
  pdfPath: string,
  page: number,
  x: number,
  y: number
): Promise<SyncTexEditResult | null> {
  try {
    const { stdout } = await execFileAsync(
      "synctex",
      ["edit", "-o", `${page}:${x}:${y}:${pdfPath}`],
      { timeout: SYNCTEX_TIMEOUT_MS, windowsHide: true }
    );
    const lineMatch = LINE_PATTERN.exec(stdout);
    const inputMatch = INPUT_PATTERN.exec(stdout);
    if (!lineMatch || !inputMatch) return null;
    return { texPath: inputMatch[1].trim(), line: parseInt(lineMatch[1], 10) };
  } catch {
    return null;
  }
}

const ANCHOR_PREFIX = "%RESUME_ANCHOR:";

/** Scans a compiled .tex source upward from a SyncTeX-resolved line (1-based)
 * for the nearest preceding `%RESUME_ANCHOR:{...}` comment emitted by
 * lib/latexTemplate.ts, and parses its JSON payload. Anchors always sit
 * immediately before the source line(s) they describe, so "nearest at or
 * before the resolved line" correctly covers multi-line constructs (e.g. a
 * \resumeSubheading spanning several source lines) without ambiguity. */
export function resolveAnchorForLine(texContent: string, line: number): ResumeAnchor | null {
  const lines = texContent.split("\n");
  const startIndex = Math.min(line, lines.length) - 1;
  for (let i = startIndex; i >= 0; i--) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith(ANCHOR_PREFIX)) {
      try {
        return JSON.parse(trimmed.slice(ANCHOR_PREFIX.length)) as ResumeAnchor;
      } catch {
        return null;
      }
    }
  }
  return null;
}
