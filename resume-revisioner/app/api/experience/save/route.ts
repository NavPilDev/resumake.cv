import { saveExperience } from "@/lib/saveExperience";
import type { ExperienceData, SaveExperienceRequest, SaveExperienceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidExperience(value: unknown): value is ExperienceData {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<ExperienceData>;
  return (
    !!v.meta &&
    typeof v.meta.name === "string" &&
    typeof v.meta.email === "string" &&
    Array.isArray(v.jobs) &&
    Array.isArray(v.projects) &&
    Array.isArray(v.education)
  );
}

export async function POST(request: Request) {
  let body: Partial<SaveExperienceRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isValidExperience(body.experience)) {
    return Response.json(
      { error: "experience must include meta.name, meta.email, and jobs/projects/education arrays." },
      { status: 400 }
    );
  }

  try {
    const result = saveExperience(body.experience);
    const payload: SaveExperienceResponse = result;
    return Response.json(payload);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to save experience.yaml." },
      { status: 500 }
    );
  }
}
