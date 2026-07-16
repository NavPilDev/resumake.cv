import { loadExperience } from "@/lib/loadExperience";
import { analyzeWithOllama } from "@/lib/ollama";
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
  const mode = body.mode === "ollama" ? "ollama" : "keyword";

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

  if (mode === "ollama") {
    const ollamaModel = typeof body.ollamaModel === "string" && body.ollamaModel.trim()
      ? body.ollamaModel.trim()
      : "llama3.2:3b";
    const ollamaHost = typeof body.ollamaHost === "string" && body.ollamaHost.trim()
      ? body.ollamaHost.trim()
      : undefined;

    try {
      const payload = await analyzeWithOllama(sections, jdText, maxBullets, {
        model: ollamaModel,
        host: ollamaHost,
      });
      return Response.json(payload);
    } catch (err) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Ollama analysis failed." },
        { status: 502 }
      );
    }
  }

  const ranked = rankSections(sections, jdText, maxBullets);
  const gaps = findGaps(sections, jdText);

  const payload: AnalyzeResponse = { mode: "keyword", sections: ranked, gaps };
  return Response.json(payload);
}
