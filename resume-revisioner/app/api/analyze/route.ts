import { loadExperience } from "@/lib/loadExperience";
import { findGaps, rankSections, toSections } from "@/lib/scoring";
import type { AnalyzeRequest, AnalyzeResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Partial<AnalyzeRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const jdText = typeof body.jdText === "string" ? body.jdText.trim() : "";
  const maxBullets =
    typeof body.maxBullets === "number" && Number.isFinite(body.maxBullets)
      ? Math.min(10, Math.max(1, Math.round(body.maxBullets)))
      : 4;

  if (!jdText) {
    return Response.json({ error: "jdText is required." }, { status: 400 });
  }

  let experience;
  try {
    experience = loadExperience();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load experience.yaml" },
      { status: 500 }
    );
  }

  const sections = toSections(experience);
  const ranked = rankSections(sections, jdText, maxBullets);
  const gaps = findGaps(sections, jdText);

  const payload: AnalyzeResponse = { sections: ranked, gaps };
  return Response.json(payload);
}
