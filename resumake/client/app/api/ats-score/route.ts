import { buildAtsScoreRequest, scoreAts } from "@/lib/atsScore";
import { loadExperience } from "@/lib/loadExperience";
import { toSections } from "@/lib/scoring";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { jdText?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jdText = typeof body.jdText === "string" ? body.jdText.trim() : "";
  if (!jdText) {
    return Response.json({ error: "jdText is required." }, { status: 400 });
  }

  let experience;
  try {
    experience = await loadExperience();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load experience.yaml" },
      { status: 500 }
    );
  }

  const sections = toSections(experience);
  const scoreRequest = buildAtsScoreRequest(experience, sections, jdText);

  try {
    const results = await scoreAts(scoreRequest);
    return Response.json(results);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "ATS scoring failed." },
      { status: 502 }
    );
  }
}
