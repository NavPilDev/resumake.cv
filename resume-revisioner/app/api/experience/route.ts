import { loadExperience } from "@/lib/loadExperience";
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

export async function GET() {
  try {
    const experience = loadExperience();
    const payload: GetExperienceResponse = { experience, isNew: false };
    return Response.json(payload);
  } catch (err) {
    // A brand-new user with no experience.yaml on disk yet isn't an error —
    // resolveRepoPath throws because nothing exists to find. Any other
    // failure (e.g. malformed YAML) should still surface loudly.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("Could not find")) {
      const payload: GetExperienceResponse = { experience: EMPTY_EXPERIENCE, isNew: true };
      return Response.json(payload);
    }
    return Response.json({ error: message }, { status: 500 });
  }
}
