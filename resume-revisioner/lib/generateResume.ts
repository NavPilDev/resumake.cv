import fs from "fs";
import path from "path";
import { loadExperience } from "./loadExperience";
import { cleanupJob, compileLatex } from "./latexCompile";
import { sanitizeFilename } from "./latexEscape";
import { buildResumeTex } from "./latexTemplate";
import { resolveRepoPath } from "./repoPaths";
import { selectTopSections, toTemplateInput, trimOnce } from "./resumeFit";
import type { GenerateProgressEvent, GenerateResumeRequest, GenerateResumeResponse } from "./types";

const MAX_TRIM_ITERATIONS = 60;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

export interface ValidatedGenerateRequest {
  filename: string;
  maxJobs: number;
  maxProjects: number;
  maxPages: number;
  sections: GenerateResumeRequest["sections"];
  confirmOverwrite: boolean;
}

/** Parses and clamps the raw request body. Returns `{ error }` if the
 * request can't be acted on at all (no sections), which the route answers
 * with a plain 400 before ever opening the progress stream. */
export function validateGenerateRequest(
  body: Partial<GenerateResumeRequest>
): ValidatedGenerateRequest | { error: string } {
  const sections = Array.isArray(body.sections) ? body.sections : [];
  if (sections.length === 0) {
    return { error: "No sections provided — run an analysis first." };
  }

  return {
    filename: sanitizeFilename(typeof body.filename === "string" ? body.filename : ""),
    maxJobs: clamp(body.maxJobs, 0, 50, 10),
    maxProjects: clamp(body.maxProjects, 0, 50, 4),
    maxPages: clamp(body.maxPages, 1, 10, 1),
    sections,
    confirmOverwrite: Boolean(body.confirmOverwrite),
  };
}

/** Compiles a tailored resume, trimming to fit `maxPages`, yielding a
 * progress event before every compile attempt so the frontend can show real
 * status instead of a blind spinner during what can be several latexmk
 * invocations in a row. */
export async function* generateResumeStream(
  input: ValidatedGenerateRequest
): AsyncGenerator<GenerateProgressEvent> {
  const { filename, maxJobs, maxProjects, maxPages, sections, confirmOverwrite } = input;

  const experience = loadExperience();
  const latexResumesDir = resolveRepoPath("latex-resumes");

  if (fs.existsSync(path.join(latexResumesDir, `${filename}.tex`)) && !confirmOverwrite) {
    yield {
      type: "needs_confirmation",
      message: `A file named "${filename}.tex" already exists in latex-resumes/. Generate again to overwrite it.`,
    };
    return;
  }

  const jobs = selectTopSections(sections, "job", maxJobs);
  const projects = selectTopSections(sections, "project", maxProjects);

  const trimmedItems: string[] = [];
  const scratchJobName = `.scratch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let pages: number | null = null;

  try {
    for (let i = 0; i < MAX_TRIM_ITERATIONS; i++) {
      yield {
        type: "progress",
        stage: "compiling",
        attempt: i + 1,
        label: i === 0 ? "Compiling initial draft…" : `Recompiling after trim (attempt ${i + 1})…`,
      };

      const tex = buildResumeTex({
        meta: experience.meta,
        education: (experience.education ?? []).filter((e) => e.included !== false),
        technicalSkills: experience.technical_skills ?? {},
        jobs: toTemplateInput(jobs),
        projects: toTemplateInput(projects),
      });

      const result = await compileLatex(latexResumesDir, scratchJobName, tex);
      pages = result.pages;

      if (pages !== null && pages <= maxPages) break;

      const message = trimOnce(jobs, projects);
      if (!message) break; // nothing left to cut
      trimmedItems.push(message);
      yield { type: "progress", stage: "trimming", attempt: i + 1, label: message };
    }
  } finally {
    cleanupJob(latexResumesDir, scratchJobName);
  }

  const warnings: string[] = [];
  if (pages === null) {
    warnings.push(
      "Could not determine a page count — compilation may have failed. The .tex file below reflects the last attempt; check its LaTeX log yourself."
    );
  } else if (pages > maxPages) {
    warnings.push(
      `Could not fit within ${maxPages} page(s) even after trimming everything possible — final result is ${pages} page(s).`
    );
  }

  yield { type: "progress", stage: "finalizing", label: `Writing "${filename}.tex" and compiling the PDF…` };

  // Final pass under the actual requested filename (the loop above only
  // ever compiled under a scratch name so partial fit attempts never
  // clobbered a real file).
  const finalTex = buildResumeTex({
    meta: experience.meta,
    education: (experience.education ?? []).filter((e) => e.included !== false),
    technicalSkills: experience.technical_skills ?? {},
    jobs: toTemplateInput(jobs),
    projects: toTemplateInput(projects),
  });
  const finalResult = await compileLatex(latexResumesDir, filename, finalTex);
  if (finalResult.pages === null) {
    warnings.push("Final compile did not produce a PDF — see latex-resumes/build/ for the LaTeX log.");
  }

  const payload: GenerateResumeResponse = {
    texPath: `latex-resumes/${filename}.tex`,
    pdfPath: finalResult.pages !== null ? `latex-resumes/out/${filename}.pdf` : undefined,
    pagesUsed: finalResult.pages,
    trimmedItems,
    warnings: warnings.length > 0 ? warnings : undefined,
  };

  yield { type: "result", data: payload };
}
