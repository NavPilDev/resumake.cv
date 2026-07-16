import fs from "fs";
import path from "path";
import { loadExperience } from "@/lib/loadExperience";
import { cleanupJob, compileLatex } from "@/lib/latexCompile";
import { sanitizeFilename } from "@/lib/latexEscape";
import { buildResumeTex } from "@/lib/latexTemplate";
import { resolveRepoPath } from "@/lib/repoPaths";
import { selectTopSections, toTemplateInput, trimOnce } from "@/lib/resumeFit";
import type { GenerateResumeRequest, GenerateResumeResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_TRIM_ITERATIONS = 60;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

export async function POST(request: Request) {
  let body: Partial<GenerateResumeRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const filename = sanitizeFilename(typeof body.filename === "string" ? body.filename : "");
  const maxJobs = clamp(body.maxJobs, 0, 50, 10);
  const maxProjects = clamp(body.maxProjects, 0, 50, 4);
  const maxPages = clamp(body.maxPages, 1, 10, 1);
  const sections = Array.isArray(body.sections) ? body.sections : [];

  if (sections.length === 0) {
    return Response.json({ error: "No sections provided — run an analysis first." }, { status: 400 });
  }

  let experience;
  let latexResumesDir: string;
  try {
    experience = loadExperience();
    latexResumesDir = resolveRepoPath("latex-resumes");
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load resume data." },
      { status: 500 }
    );
  }

  if (fs.existsSync(path.join(latexResumesDir, `${filename}.tex`)) && !body.confirmOverwrite) {
    return Response.json(
      {
        error: `A file named "${filename}.tex" already exists in latex-resumes/. Generate again to overwrite it.`,
        needsConfirmation: true,
      },
      { status: 409 }
    );
  }

  const jobs = selectTopSections(sections, "job", maxJobs);
  const projects = selectTopSections(sections, "project", maxProjects);

  const trimmedItems: string[] = [];
  const scratchJobName = `.scratch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let pages: number | null = null;

  try {
    for (let i = 0; i < MAX_TRIM_ITERATIONS; i++) {
      const tex = buildResumeTex({
        meta: experience.meta,
        education: experience.education ?? [],
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

  // Final pass under the actual requested filename (the loop above only
  // ever compiled under a scratch name so partial fit attempts never
  // clobbered a real file).
  const finalTex = buildResumeTex({
    meta: experience.meta,
    education: experience.education ?? [],
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

  return Response.json(payload);
}
