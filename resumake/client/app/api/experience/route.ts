import { ExperienceFileNotFoundError, loadExperience } from "@/lib/loadExperience";
import type { ExperienceData, GetExperienceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMPTY_EXPERIENCE: ExperienceData = {
  meta: { name: "", email: "", linkedin: "", github: "", website: "" },
  jobs: [],
  projects: [],
  education: [],
  certifications: [],
  technical_skills: {},
};

/** Assigns a stable `id` (in-memory only) to any job/project/education entry
 * that predates the field. Returns whether anything was backfilled so the
 * caller knows to persist it. */
function backfillIds(data: ExperienceData): { data: ExperienceData; backfilled: boolean } {
  let backfilled = false;
  const withId = <T extends { id?: string }>(entry: T): T => {
    if (entry.id) return entry;
    backfilled = true;
    return { ...entry, id: crypto.randomUUID() };
  };
  return {
    data: {
      ...data,
      jobs: data.jobs.map(withId),
      projects: data.projects.map(withId),
      education: data.education.map(withId),
    },
    backfilled,
  };
}

export async function GET() {
  try {
    const { data: experience, backfilled } = backfillIds(await loadExperience());
    const payload: GetExperienceResponse = { experience, isNew: false, idsBackfilled: backfilled };
    return Response.json(payload);
  } catch (err) {
    // A brand-new user with no experience.yaml on disk yet isn't an error.
    // Any other failure (e.g. malformed YAML, agent server unreachable)
    // should still surface loudly.
    if (err instanceof ExperienceFileNotFoundError) {
      const payload: GetExperienceResponse = { experience: EMPTY_EXPERIENCE, isNew: true, idsBackfilled: false };
      return Response.json(payload);
    }
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
