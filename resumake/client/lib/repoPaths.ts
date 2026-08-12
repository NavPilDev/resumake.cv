import fs from "fs";
import path from "path";

/** Resolves the repo root by walking up from cwd looking for the `resumake`
 * folder (this app's own grandparent) as a marker — robust to whichever
 * directory the Next.js process's cwd happens to be (resumake/client when
 * launched via `npm --prefix resumake/client run dev`, the repo root
 * itself if launched some other way, etc.), unlike a hardcoded basename
 * check. Always returns a path (never throws), since callers use this to
 * create new files/dirs that may not exist yet. */
export function resolveRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, "resumake"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

/** Resolves resumake/server/resumake-media — this server's local data
 * directory (git-ignored; see resumake/server/.gitignore) that holds
 * experience.yaml and every saved/generated resume artifact. */
export function resolveResumakeMediaRoot(): string {
  return path.join(resolveRepoRoot(), "resumake", "server", "resumake-media");
}
