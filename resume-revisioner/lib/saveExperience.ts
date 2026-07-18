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

export interface SaveExperienceResult {
  path: string;
  backupPath: string | null;
}

/** Writes `data` to experience.yaml at the repo root, backing up the
 * previous file (if any) to a timestamped `.bak-<ISO time>` copy first —
 * this is the first-ever write path to this hand-curated file, so the
 * backup is a deliberate safety net rather than a full versioning system. */
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
  let backupPath: string | null = null;
  if (fs.existsSync(filePath)) {
    const existingRaw = fs.readFileSync(filePath, "utf8");
    header = extractHeaderComment(existingRaw);
    backupPath = `${filePath}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
    fs.copyFileSync(filePath, backupPath);
  }

  const body = yaml.dump(data, { lineWidth: -1, noRefs: true, sortKeys: false });
  fs.writeFileSync(filePath, header + body, "utf8");

  return { path: filePath, backupPath };
}
