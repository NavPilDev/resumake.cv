import yaml from "js-yaml";
import type { ExperienceData } from "./types";

const AGENT_SERVER_URL = (process.env.RESUMAKE_SERVER_URL || "http://localhost:8000").replace(/\/+$/, "");

function agentUnreachableMessage(err: unknown): string {
  return `Could not reach the Resumake agent server at ${AGENT_SERVER_URL}. Is it running (\`fastapi run main.py\` in resumake/server)? (${
    err instanceof Error ? err.message : String(err)
  })`;
}

/** True for a brand-new user with no experience.yaml on disk yet — the
 * caller (GET /api/experience) turns this into an empty-state response
 * instead of a hard error, same as before this moved server-side. */
export class ExperienceFileNotFoundError extends Error {}

/** Fetches the raw experience.yaml text from the FastAPI server's
 * /experience/raw endpoint (see resumake/server/experience_file) — the repo
 * root's canonical file, never resumake/server/resumake-media's sample copy
 * — and parses it here. Parsing/shape stay client-side; only the disk read
 * moved server-side so the client never touches the filesystem directly. */
export async function loadExperience(): Promise<ExperienceData> {
  let res: Response;
  try {
    res = await fetch(`${AGENT_SERVER_URL}/experience/raw`, { cache: "no-store" });
  } catch (err) {
    throw new Error(agentUnreachableMessage(err));
  }

  if (res.status === 404) {
    throw new ExperienceFileNotFoundError("experience.yaml does not exist yet.");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agent server GET /experience/raw failed (${res.status}). ${text}`);
  }

  const data = (await res.json()) as { content: string };
  return yaml.load(data.content) as ExperienceData;
}
