import yaml from "js-yaml";
import type { ExperienceData } from "./types";

const AGENT_SERVER_URL = (process.env.RESUMAKE_SERVER_URL || "http://localhost:8000").replace(/\/+$/, "");

function agentUnreachableMessage(err: unknown): string {
  return `Could not reach the Resumake agent server at ${AGENT_SERVER_URL}. Is it running (\`fastapi run main.py\` in resumake/server)? (${
    err instanceof Error ? err.message : String(err)
  })`;
}

/** Leading `#`-comment/blank lines at the top of the file, preserved across
 * saves since js-yaml's dump() has no comment support and would otherwise
 * silently drop the hand-written header block. Mid-document comments are not
 * preserved — that's a one-time, accepted loss on first save. */
function extractHeaderComment(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const header: string[] = [];
  for (const line of lines) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) {
      header.push(line);
    } else {
      break;
    }
  }
  return header.length > 0 ? header.join("\n") + "\n\n" : "";
}

/** A number, %, or $ in a bullet's text is a decent proxy for "this bullet
 * states a measurable outcome" — auto-detected at save time rather than
 * hand-toggled in the editor. */
function detectHasMetric(text: string): boolean {
  return /\d/.test(text) || /[%$]/.test(text);
}

function withDetectedMetrics(data: ExperienceData): ExperienceData {
  return {
    ...data,
    jobs: data.jobs.map((job) => ({
      ...job,
      bullets: job.bullets.map((b) => ({ ...b, has_metric: detectHasMetric(b.text) })),
    })),
    projects: data.projects.map((project) => ({
      ...project,
      bullets: project.bullets.map((b) => ({ ...b, has_metric: detectHasMetric(b.text) })),
    })),
  };
}

export interface SaveExperienceResult {
  path: string;
}

/** Sends `data` to the FastAPI server's /experience/raw endpoint to be
 * written to the repo-root experience.yaml, preserving the file's leading
 * `#`-comment header block (if any) across the rewrite. YAML serialization
 * happens here, client-side — the server only does the raw file write. This
 * is a direct overwrite with no backup copy — the source-controlled repo
 * (or your own external backups) is the safety net for this file, not this
 * function. */
export async function saveExperience(data: ExperienceData): Promise<SaveExperienceResult> {
  let header = "";
  try {
    const existing = await fetch(`${AGENT_SERVER_URL}/experience/raw`, { cache: "no-store" });
    if (existing.ok) {
      const { content } = (await existing.json()) as { content: string };
      header = extractHeaderComment(content);
    } else if (existing.status !== 404) {
      const text = await existing.text().catch(() => "");
      throw new Error(`Agent server GET /experience/raw failed (${existing.status}). ${text}`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Agent server")) throw err;
    throw new Error(agentUnreachableMessage(err));
  }

  const body = yaml.dump(withDetectedMetrics(data), { lineWidth: -1, noRefs: true, sortKeys: false });

  let res: Response;
  try {
    res = await fetch(`${AGENT_SERVER_URL}/experience/raw`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: header + body }),
    });
  } catch (err) {
    throw new Error(agentUnreachableMessage(err));
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Agent server PUT /experience/raw failed (${res.status}). ${text}`);
  }

  return (await res.json()) as SaveExperienceResult;
}
