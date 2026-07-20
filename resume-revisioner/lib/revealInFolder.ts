import { execFile } from "node:child_process";
import path from "node:path";

/** Opens the OS's native file browser pointed at `absolutePath`. When
 * `select` is true the target is a file that should be highlighted inside
 * its containing folder (Explorer's /select, / Finder's `open -R`); when
 * false the path itself is a directory to open. Fire-and-forget: explorer.exe
 * routinely exits with a non-zero code even on success, and there's nothing
 * useful to do with an error here beyond not crashing the request. */
export function revealInFileBrowser(absolutePath: string, select: boolean): void {
  const platform = process.platform;
  if (platform === "win32") {
    const args = select ? ["/select,", absolutePath] : [absolutePath];
    execFile("explorer.exe", args, () => {});
  } else if (platform === "darwin") {
    const args = select ? ["-R", absolutePath] : [absolutePath];
    execFile("open", args, () => {});
  } else {
    execFile("xdg-open", [select ? path.dirname(absolutePath) : absolutePath], () => {});
  }
}
