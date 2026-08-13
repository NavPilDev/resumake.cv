import type { AtsScoreRequest, AtsScoreResult, ExperienceData, Section } from "./types";

const AGENT_SERVER_URL = (process.env.RESUMAKE_SERVER_URL || "http://localhost:8000").replace(/\/+$/, "");

function agentUnreachableMessage(err: unknown): string {
  return `Could not reach the Resumake agent server at ${AGENT_SERVER_URL}. Is it running (\`fastapi run main.py\` in resumake/server)? (${
    err instanceof Error ? err.message : String(err)
  })`;
}

/** Flattens the saved experience data's education/skills/contact into the
 * flat strings/lists resumake-agent/ats_scoring/types.py's AtsScoreRequest
 * expects — the deterministic scorer works off Section/Bullet models plus
 * plain text, not the richer EducationEntry/TechnicalSkills shapes used
 * elsewhere in the app. `sections` is passed in rather than recomputed here
 * so callers can reuse the same `toSections(experience)` call other
 * endpoints (e.g. /api/analyze) already make. */
export function buildAtsScoreRequest(experience: ExperienceData, sections: Section[], jdText: string): AtsScoreRequest {
  const educationText = experience.education
    .filter((entry) => entry.included !== false)
    .map((entry) => {
      const lines = [
        [entry.credential, entry.institution, entry.dates].filter(Boolean).join(", "),
        entry.gpa ? `GPA ${entry.gpa}` : "",
        ...(entry.details ?? []),
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");

  const skills = Object.values(experience.technical_skills ?? {})
    .flat()
    .map((entry) => entry.skill);

  const hasContactInfo = Boolean(experience.meta.name.trim() && experience.meta.email.trim());

  return {
    sections,
    educationText,
    skills,
    hasContactInfo,
    // Resumake has no resume-summary field yet (planned — see AGENTS.md)
    // — the backend already has hasSummary/Lever's "summary" quirk wired
    // up and waiting, so this just needs to flip once that field exists.
    hasSummary: false,
    jdText,
  };
}

/** Relays to the FastAPI server's POST /ollama/analyze/ats-score endpoint.
 * Non-streaming: unlike /ollama/analyze, the underlying computation is
 * deterministic and fast (no per-item Ollama progress to report). */
export async function scoreAts(request: AtsScoreRequest): Promise<AtsScoreResult[]> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_SERVER_URL}/ollama/analyze/ats-score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (err) {
    throw new Error(agentUnreachableMessage(err));
  }

  const data = await res.json().catch(() => ({}) as { detail?: unknown });
  if (!res.ok) {
    const message =
      typeof data?.detail === "string" ? data.detail : `Agent server /ollama/analyze/ats-score failed (${res.status}).`;
    throw new Error(message);
  }

  return data as AtsScoreResult[];
}
