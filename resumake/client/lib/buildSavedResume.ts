import type { BuildResumeTexInput, SpacingSettings } from "./latexTemplate";
import { compileLatex, type CompileResult } from "./latexCompile";
import { resolveSavedBuildDir, type ResumeSelection, type SectionSelection } from "./resumeFiles";
import type { ExperienceData, GenerateResumeSectionInput, JobEntry, ProjectEntry } from "./types";

function displayText(bulletId: string, sourceText: string, textOverrides: Record<string, string>): string {
  return textOverrides[bulletId] ?? sourceText;
}

function jobToSectionInput(
  job: JobEntry,
  selection: SectionSelection | undefined,
  textOverrides: Record<string, string>
): GenerateResumeSectionInput | null {
  if (!job.id || !selection?.included) return null;
  const selectedIds = new Set(selection.bulletIds);
  const bullets = job.bullets
    .filter((b) => selectedIds.has(b.id))
    .map((b) => ({ id: b.id, text: displayText(b.id, b.text, textOverrides), score: 0 }));
  return {
    id: job.id,
    kind: "job",
    company: job.company,
    role: job.role,
    location: job.location,
    label: `${job.company} — ${job.role}`,
    dates: job.dates,
    bullets,
  };
}

function projectToSectionInput(
  project: ProjectEntry,
  selection: SectionSelection | undefined,
  textOverrides: Record<string, string>
): GenerateResumeSectionInput | null {
  if (!project.id || !selection?.included) return null;
  const selectedIds = new Set(selection.bulletIds);
  const bullets = project.bullets
    .filter((b) => selectedIds.has(b.id))
    .map((b) => ({ id: b.id, text: displayText(b.id, b.text, textOverrides), score: 0 }));
  return {
    id: project.id,
    kind: "project",
    label: project.name,
    dates: project.dates,
    links: project.links,
    bullets,
  };
}

/** Converts a manually-checked ResumeSelection (My Resumes tab) into the
 * same BuildResumeTexInput shape the JD-tailoring flow produces via
 * scoring — but built directly from user selections rather than
 * selectTopSections/trimOnce, since there's no auto-trim-to-fit when the
 * user explicitly chose what's in and out. */
export function selectionToTemplateInput(
  experience: ExperienceData,
  selection: ResumeSelection,
  textOverrides: Record<string, string>,
  spacing?: Partial<SpacingSettings>
): BuildResumeTexInput {
  const jobs = experience.jobs
    .map((job) => (job.id ? jobToSectionInput(job, selection.jobs[job.id], textOverrides) : null))
    .filter((s): s is GenerateResumeSectionInput => s !== null);

  const projects = experience.projects
    .map((project) => (project.id ? projectToSectionInput(project, selection.projects[project.id], textOverrides) : null))
    .filter((s): s is GenerateResumeSectionInput => s !== null);

  const education = experience.education.filter((e) => e.id && selection.education.includes(e.id));

  const certifications = (experience.certifications ?? []).filter((c) =>
    selection.certifications.includes(c.id)
  );

  const technicalSkills = Object.fromEntries(
    Object.entries(experience.technical_skills).filter(([category]) =>
      selection.technicalSkillCategories.includes(category)
    )
  );

  const meta = {
    name: experience.meta.name,
    email: selection.contact.includes("email") ? experience.meta.email : "",
    linkedin: selection.contact.includes("linkedin") ? experience.meta.linkedin : "",
    github: selection.contact.includes("github") ? experience.meta.github : "",
    website: selection.contact.includes("website") ? experience.meta.website : "",
  };

  return {
    meta,
    education,
    technicalSkills,
    jobs,
    projects,
    certifications,
    spacing,
  };
}

/** Compiles a saved resume's LaTeX under the shared resumake-media/resumes/
 * .build scratch dir, keyed by the manifest's globally-unique id — see
 * resolveSavedBuildDir()'s doc comment for why every saved resume shares
 * one build dir regardless of its folder location in the file browser. */
export async function compileSavedResume(id: string, tex: string): Promise<CompileResult> {
  return compileLatex(resolveSavedBuildDir(), id, tex);
}
