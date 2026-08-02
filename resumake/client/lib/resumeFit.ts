import type { GenerateResumeSectionInput } from "./types";

export interface WorkingSection {
  input: GenerateResumeSectionInput;
  bullets: { id: string; text: string; score: number }[];
  aggregateScore: number;
}

function label(section: WorkingSection): string {
  return section.input.kind === "job"
    ? `${section.input.company ?? ""} — ${section.input.role ?? ""}`
    : section.input.label;
}

/** Ranks sections of one kind by their best bullet's score and keeps the top
 * `maxCount`. Each kept section's own bullets are also sorted best-first so
 * later trimming always drops the weakest bullet in a section. */
export function selectTopSections(
  sections: GenerateResumeSectionInput[],
  kind: "job" | "project",
  maxCount: number
): WorkingSection[] {
  const working = sections
    .filter((s) => s.kind === kind && s.bullets.length > 0)
    .map((s) => ({
      input: s,
      bullets: [...s.bullets].sort((a, b) => b.score - a.score),
      aggregateScore: Math.max(0, ...s.bullets.map((b) => b.score)),
    }));

  working.sort((a, b) => b.aggregateScore - a.aggregateScore);
  return working.slice(0, Math.max(0, maxCount));
}

function pickLowestScoring<T extends { aggregateScore: number }>(list: T[]): T {
  return list.reduce((min, cur) => (cur.aggregateScore < min.aggregateScore ? cur : min));
}

/** One step of the page-fit ladder: shrink the weakest project's bullets
 * before dropping a whole project, and only touch jobs (full work history)
 * once every project option is exhausted. Mutates `jobs`/`projects` in
 * place. Returns null once nothing is left to trim. */
export function trimOnce(jobs: WorkingSection[], projects: WorkingSection[]): string | null {
  const shrinkableProjects = projects.filter((p) => p.bullets.length > 1);
  if (shrinkableProjects.length > 0) {
    const target = pickLowestScoring(shrinkableProjects);
    target.bullets.pop();
    return `Trimmed one bullet from project "${label(target)}"`;
  }

  if (projects.length > 0) {
    const target = pickLowestScoring(projects);
    projects.splice(projects.indexOf(target), 1);
    return `Dropped project "${label(target)}" (lowest scoring) to fit the page limit`;
  }

  const shrinkableJobs = jobs.filter((j) => j.bullets.length > 1);
  if (shrinkableJobs.length > 0) {
    const target = pickLowestScoring(shrinkableJobs);
    target.bullets.pop();
    return `Trimmed one bullet from "${label(target)}"`;
  }

  if (jobs.length > 1) {
    const target = pickLowestScoring(jobs);
    jobs.splice(jobs.indexOf(target), 1);
    return `Dropped job "${label(target)}" (lowest scoring) — resume still exceeds the page limit`;
  }

  return null;
}

export function toTemplateInput(sections: WorkingSection[]): GenerateResumeSectionInput[] {
  return sections.map((s) => ({ ...s.input, bullets: s.bullets }));
}
