import type { AnalyzeProgressEvent, Section } from "./types";

const AGENT_SERVER_URL = (process.env.RESUMAKE_SERVER_URL || "http://localhost:8000").replace(/\/+$/, "");

function agentUnreachableMessage(err: unknown): string {
  return `Could not reach the Resumake agent server at ${AGENT_SERVER_URL}. Is it running (\`fastapi run main.py\` in resumake/server)? (${
    err instanceof Error ? err.message : String(err)
  })`;
}

/** All actual Ollama calls now live server-side (see
 * resumake/server/resumake-agent.py) — this just relays the request and
 * re-streams the same NDJSON progress events this used to yield directly. */
export async function* analyzeWithOllamaStream(
  sections: Section[],
  jdText: string,
  maxBullets: number,
  options: { model: string; host?: string }
): AsyncGenerator<AnalyzeProgressEvent, void, void> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_SERVER_URL}/ollama/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sections,
        jdText,
        maxBullets,
        model: options.model,
        host: options.host,
      }),
    });
  } catch (err) {
    throw new Error(agentUnreachableMessage(err));
  }

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agent server /ollama/analyze failed (${res.status}). ${text}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex;
    while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;
      yield JSON.parse(line) as AnalyzeProgressEvent;
    }
  }
}

/** Relays to the FastAPI server's /ollama/improve endpoint. */
export async function improveWithOllama(
  bulletText: string,
  tags: string[],
  jdText: string,
  options: { model: string; host?: string }
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_SERVER_URL}/ollama/improve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bulletText, tags, jdText, model: options.model, host: options.host }),
    });
  } catch (err) {
    throw new Error(agentUnreachableMessage(err));
  }

  const data = await res.json().catch(() => ({}) as { improvedText?: unknown; detail?: unknown });
  if (!res.ok) {
    const message = typeof data?.detail === "string" ? data.detail : `Agent server /ollama/improve failed (${res.status}).`;
    throw new Error(message);
  }

  const improvedText = typeof data?.improvedText === "string" ? data.improvedText.trim() : "";
  if (!improvedText) {
    throw new Error("Agent server did not return an improved bullet — try again.");
  }
  return improvedText;
}
