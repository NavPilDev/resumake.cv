import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { resolveRepoPath } from "./repoPaths";
import type { ExperienceData } from "./types";

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

/** Writes `data` to experience.yaml at the repo root, preserving the file's
 * leading `#`-comment header block (if any) across the rewrite. This is a
 * direct overwrite with no backup copy — the source-controlled repo (or your
 * own external backups) is the safety net for this file, not this function. */
export function saveExperience(data: ExperienceData): SaveExperienceResult {
  let filePath: string;
  try {
    filePath = resolveRepoPath("experience.yaml");
  } catch {
    // Brand-new user: resolveRepoPath throws because the file doesn't exist
    // anywhere yet. Fall back to the repo root it would have searched —
    // cwd, or cwd's parent when running from inside resume-revisioner/.
    const repoRoot =
      path.basename(process.cwd()) === "resume-revisioner"
        ? path.join(process.cwd(), "..")
        : process.cwd();
    filePath = path.join(repoRoot, "experience.yaml");
  }

  let header = "";
  if (fs.existsSync(filePath)) {
    header = extractHeaderComment(fs.readFileSync(filePath, "utf8"));
  }

  const body = yaml.dump(withDetectedMetrics(data), { lineWidth: -1, noRefs: true, sortKeys: false });
  fs.writeFileSync(filePath, header + body, "utf8");

  return { path: filePath };
}
