import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const COMPILE_TIMEOUT_MS = 60_000;

export interface CompileResult {
  pages: number | null;
  log: string;
  pdfPath: string;
}

function parsePageCount(output: string): number | null {
  const match = output.match(/Output written on .*\((\d+) pages?,/);
  return match ? parseInt(match[1], 10) : null;
}

/** Writes `texContent` to `${latexResumesDir}/${jobName}.tex` and compiles it
 * with latexmk (using that directory's .latexmkrc for aux_dir/out_dir).
 * Never throws on a LaTeX compile error — callers need the page count (or
 * lack thereof) and log either way, not an exception. */
export async function compileLatex(
  latexResumesDir: string,
  jobName: string,
  texContent: string
): Promise<CompileResult> {
  const texFilePath = path.join(latexResumesDir, `${jobName}.tex`);
  fs.writeFileSync(texFilePath, texContent, "utf8");

  const pdfPath = path.join(latexResumesDir, "out", `${jobName}.pdf`);
  const args = [
    "-pdf",
    "-interaction=nonstopmode",
    "-halt-on-error",
    `-jobname=${jobName}`,
    `${jobName}.tex`,
  ];

  try {
    const { stdout, stderr } = await execFileAsync("latexmk", args, {
      cwd: latexResumesDir,
      timeout: COMPILE_TIMEOUT_MS,
      windowsHide: true,
    });
    return { pages: parsePageCount(stdout), log: stdout + stderr, pdfPath };
  } catch (err) {
    const stdout = (err as { stdout?: string }).stdout ?? "";
    const stderr = (err as { stderr?: string }).stderr ?? "";
    return { pages: parsePageCount(stdout), log: stdout + stderr || String(err), pdfPath };
  }
}

/** Removes every artifact latexmk produces for a given jobname — used to
 * clean up the scratch files from intermediate page-fit iterations. */
export function cleanupJob(latexResumesDir: string, jobName: string): void {
  const rootExts = [".tex"];
  const buildExts = [".aux", ".log", ".fls", ".fdb_latexmk", ".out", ".synctex.gz"];

  for (const ext of rootExts) {
    const p = path.join(latexResumesDir, `${jobName}${ext}`);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
  for (const ext of buildExts) {
    const p = path.join(latexResumesDir, "build", `${jobName}${ext}`);
    if (fs.existsSync(p)) fs.rmSync(p, { force: true });
  }
  const pdf = path.join(latexResumesDir, "out", `${jobName}.pdf`);
  if (fs.existsSync(pdf)) fs.rmSync(pdf, { force: true });
}
