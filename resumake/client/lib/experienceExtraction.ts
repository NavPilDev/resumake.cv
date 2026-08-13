import type { ExtractedExperienceFragment } from "./types";

const AGENT_SERVER_URL = (process.env.RESUMAKE_SERVER_URL || "http://localhost:8000").replace(/\/+$/, "");

export interface ExtractionResult {
  fragment: ExtractedExperienceFragment;
  /** Non-fatal: e.g. the technical-skills pass failed while the core
   * extraction succeeded. Core-extraction failures still throw, same as
   * before, since there's nothing useful to show without them. */
  warnings: string[];
}

/** Relays raw extracted text (from an upload or pasted free text) to the
 * FastAPI server's /ollama/extract endpoint (see
 * resumake/server/resumake-agent.py), which owns the actual local-model
 * calls and returns a partial ExperienceData fragment for the user to
 * review before anything is merged into their experience bank. */
export async function extractExperienceFragment(
  rawText: string,
  sourceLabel: string,
  options: { model: string; host?: string }
): Promise<ExtractionResult> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_SERVER_URL}/ollama/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText, sourceLabel, model: options.model, host: options.host }),
    });
  } catch (err) {
    throw new Error(
      `Could not reach the Resumake agent server at ${AGENT_SERVER_URL}. Is it running (\`fastapi run main.py\` in resumake/server)? (${
        err instanceof Error ? err.message : String(err)
      })`
    );
  }

  const data = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok) {
    const message =
      typeof data?.detail === "string" ? data.detail : `Agent server /ollama/extract failed (${res.status}).`;
    throw new Error(message);
  }

  return {
    fragment: (data?.fragment ?? {}) as ExtractedExperienceFragment,
    warnings: Array.isArray(data?.warnings) ? (data.warnings as string[]) : [],
  };
}
