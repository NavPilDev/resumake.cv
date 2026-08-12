import fs from "fs";
import path from "path";

/** Resolves a path relative to the repo root, whether the Next.js process's
 * cwd is the repo root or the resume-revisioner/ subdirectory (depends on
 * how `npm run dev` was invoked). */
export function resolveRepoPath(relative: string): string {
  const cwdCandidate = path.join(process.cwd(), relative);
  if (fs.existsSync(cwdCandidate)) return cwdCandidate;

  const parentCandidate = path.join(process.cwd(), "..", relative);
  if (fs.existsSync(parentCandidate)) return parentCandidate;

  throw new Error(
    `Could not find ${relative} (looked in the current working directory and its parent).`
  );
}

/** Resolves the repo root the same way regardless of whether anything at
 * that path exists yet — unlike resolveRepoPath, which requires the target
 * to already exist. Needed for anything that creates new files/dirs under
 * the repo root (e.g. /saved) rather than reading something already there. */
export function resolveRepoRoot(): string {
  return path.basename(process.cwd()) === "resumake"
    ? path.join(process.cwd(), "..")
    : process.cwd();
}
