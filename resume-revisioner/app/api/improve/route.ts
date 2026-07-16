import { improveWithOllama } from "@/lib/ollama";
import type { ImproveRequest, ImproveResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: Partial<ImproveRequest>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const bulletText = typeof body.bulletText === "string" ? body.bulletText.trim() : "";
  const jdText = typeof body.jdText === "string" ? body.jdText.trim() : "";
  const tags = Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [];

  if (!bulletText || !jdText) {
    return Response.json({ error: "bulletText and jdText are required." }, { status: 400 });
  }

  const ollamaModel = typeof body.ollamaModel === "string" && body.ollamaModel.trim()
    ? body.ollamaModel.trim()
    : "llama3.2:3b";
  const ollamaHost = typeof body.ollamaHost === "string" && body.ollamaHost.trim()
    ? body.ollamaHost.trim()
    : undefined;

  try {
    const improvedText = await improveWithOllama(bulletText, tags, jdText, {
      model: ollamaModel,
      host: ollamaHost,
    });
    const payload: ImproveResponse = { improvedText };
    return Response.json(payload);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Ollama improve request failed." },
      { status: 502 }
    );
  }
}
