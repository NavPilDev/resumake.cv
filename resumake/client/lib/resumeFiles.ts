import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import { resolveResumakeMediaRoot } from "./repoPaths";
import { CONTACT_FIELDS } from "./contactFields";
import { DEFAULT_SPACING, type SpacingSettings } from "./latexTemplate";

/** Compiled-artifact scratch space, shared by every saved resume regardless
 * of which user-facing folder its manifest lives in — latexmk only reads
 * .latexmkrc from its own cwd (no parent-directory search), so a single
 * shared build dir avoids needing one .latexmkrc per user-created folder. */
const BUILD_DIR_NAME = ".build";

/** "My Resumes" tab's saved-manifest tree root: resumake-media/resumes,
 * alongside that same directory's example-resume fixtures (ignored by
 * listResumeTree's walk() below, since it only recognizes folders and
 * .json manifests) and the resumake-media/cover-letters directory. */
export function resolveSavedRoot(): string {
  const root = path.join(resolveResumakeMediaRoot(), "resumes");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Joins user-supplied path segments onto the saved-resumes root and
 * verifies the resolved absolute path never escapes it — folder/resume
 * names arrive from API request bodies, so this is the single choke point
 * guarding every write under it against `..`, absolute-path, or
 * drive-letter injection. */
export function resolveSavedPath(...segments: string[]): string {
  const root = resolveSavedRoot();
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Path escapes the saved-resumes directory.");
  }
  return resolved;
}

export function sanitizeFolderOrTitleName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "").slice(0, 120);
  if (!cleaned) throw new Error("Name cannot be empty.");
  return cleaned;
}

/** Marks a directory hidden in Windows Explorer (a leading dot alone doesn't
 * hide anything on Windows, unlike Unix). Best-effort — if `attrib` isn't
 * on PATH for some reason, the folder just stays visible, which is harmless
 * since nothing about the build pipeline depends on it being hidden. */
function hideOnWindows(dirPath: string): void {
  if (process.platform !== "win32") return;
  try {
    execFileSync("attrib", ["+h", dirPath], { windowsHide: true });
  } catch {
    // Non-fatal — see doc comment above.
  }
}

const DEFAULT_LATEXMKRC =
  "$aux_dir = 'build';\n$out_dir = 'out';\n$pdf_mode = 1;\n$synctex = 1;\n$pdflatex = 'pdflatex -synctex=1 %O %S';\n";

/** Seeds a directory with the standard aux_dir=build/out_dir=out .latexmkrc
 * every latexmk-driven scratch dir in this app needs, if it doesn't already
 * have one. */
function ensureLatexmkrc(dir: string): void {
  const rcPath = path.join(dir, ".latexmkrc");
  if (!fs.existsSync(rcPath)) fs.writeFileSync(rcPath, DEFAULT_LATEXMKRC, "utf8");
}

export function resolveSavedBuildDir(): string {
  const buildDir = path.join(resolveSavedRoot(), BUILD_DIR_NAME);
  fs.mkdirSync(buildDir, { recursive: true });
  hideOnWindows(buildDir);
  ensureLatexmkrc(buildDir);
  return buildDir;
}

/** Scratch + output directory for the "Tailor Resume" tab's one-shot
 * "Generate Resume" flow — separate from the "My Resumes" tab's saved
 * manifest tree above (resolveSavedRoot), but still under the same
 * resumake-media/resumes root. Dot-prefixed so listResumeTree()'s walk()
 * (which already skips dotfiles and BUILD_DIR_NAME) never surfaces it in
 * the file browser. */
export function resolveGeneratedResumesDir(): string {
  const dir = path.join(resolveSavedRoot(), ".generated");
  fs.mkdirSync(dir, { recursive: true });
  ensureLatexmkrc(dir);
  return dir;
}

export function createFolder(parentPath: string, name: string): string {
  const sanitized = sanitizeFolderOrTitleName(name);
  const target = resolveSavedPath(parentPath, sanitized);
  fs.mkdirSync(target, { recursive: false });
  return target;
}

export interface SectionSelection {
  included: boolean;
  /** Selected Bullet.id values, in source order — no reordering in v1. */
  bulletIds: string[];
}

export interface ResumeSelection {
  /** Which optional contact fields render in the header: subset of
   * "email" | "linkedin" | "github" | "website". Name is always shown. */
  contact: string[];
  jobs: Record<string, SectionSelection>;
  projects: Record<string, SectionSelection>;
  education: string[];
  certifications: string[];
  technicalSkillCategories: string[];
}

export interface ResumeManifest {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  selection: ResumeSelection;
  /** bulletId -> edited plain text, mirroring the Tailor Resume flow's
   * existing per-bullet override map. Ctrl+B/Ctrl+I/Ctrl+U in the bullet
   * textareas insert real \textbf{}/\textit{}/\underline{} commands
   * directly into this text (see lib/latexEscape.ts's
   * escapeLatexWithFormatting) rather than an abstracted markup syntax. */
  textOverrides: Record<string, string>;
  /** Raw LaTeX typed directly in the "My Resumes" LaTeX-view editor. When
   * set, this is compiled verbatim instead of regenerating .tex from
   * `selection`/`textOverrides` — it's cleared back to null the next time
   * the resume is saved from a Form-view edit, so Form edits always take
   * precedence over a stale hand-edit once the user acts on them again. */
  rawLatexOverride: string | null;
  lastCompile: { pagesUsed: number | null; compiledAt: string; warnings?: string[] } | null;
  /** Per-resume vertical spacing overrides, set from the Form view's
   * Settings section — see lib/latexTemplate.ts's SpacingSettings. Optional
   * on disk (older manifests predate this field); normalizeSpacing fills in
   * DEFAULT_SPACING for anything missing when loading. */
  spacing?: Partial<SpacingSettings>;
}

export interface ResumeCreateRequest {
  title: string;
  folderPath: string;
  selection: ResumeSelection;
  textOverrides: Record<string, string>;
  rawLatexOverride?: string | null;
  spacing?: Partial<SpacingSettings>;
}

export interface ResumeUpdateRequest {
  title?: string;
  selection: ResumeSelection;
  textOverrides: Record<string, string>;
  rawLatexOverride?: string | null;
  spacing?: Partial<SpacingSettings>;
}

export type ResumeTreeNode =
  | { type: "folder"; name: string; path: string; children: ResumeTreeNode[] }
  | { type: "resume"; id: string; title: string; path: string; updatedAt: string };

function walk(dirAbs: string, relPath: string): ResumeTreeNode[] {
  const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  const nodes: ResumeTreeNode[] = [];
  for (const entry of entries) {
    if (entry.name === BUILD_DIR_NAME || entry.name.startsWith(".")) continue;
    const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      nodes.push({
        type: "folder",
        name: entry.name,
        path: entryRel,
        children: walk(path.join(dirAbs, entry.name), entryRel),
      });
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      try {
        const manifest: ResumeManifest = JSON.parse(fs.readFileSync(path.join(dirAbs, entry.name), "utf8"));
        nodes.push({ type: "resume", id: manifest.id, title: manifest.title, path: relPath, updatedAt: manifest.updatedAt });
      } catch {
        // Skip unreadable/malformed manifests rather than failing the whole tree.
      }
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    const an = a.type === "folder" ? a.name : a.title;
    const bn = b.type === "folder" ? b.name : b.title;
    return an.localeCompare(bn);
  });
  return nodes;
}

/** Walks the whole saved-resumes tree (skipping .build and .generated).
 * Fine at personal-resume scale — no id->path index is maintained since
 * there's nothing resembling a database here, just a folder of JSON files. */
export function listResumeTree(): ResumeTreeNode[] {
  return walk(resolveSavedRoot(), "");
}

/** Manifest filenames are the resume's (sanitized) title, not its id — see
 * writeManifest/overwriteManifestAtPath — so finding a resume by id has to
 * open and check each manifest's contents rather than matching a filename.
 * Fine at personal-resume scale (see listResumeTree's doc comment). */
export function findManifestPath(id: string): string | null {
  const root = resolveSavedRoot();
  function search(dirAbs: string): string | null {
    const entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === BUILD_DIR_NAME || entry.name.startsWith(".")) continue;
      const abs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        const found = search(abs);
        if (found) return found;
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        try {
          const manifest: Partial<ResumeManifest> = JSON.parse(fs.readFileSync(abs, "utf8"));
          if (manifest.id === id) return abs;
        } catch {
          // Skip unreadable/malformed manifests rather than failing the search.
        }
      }
    }
    return null;
  }
  return search(root);
}

/** Fills in fields absent from a manifest written before they existed (e.g.
 * `contact`, added after some resumes were already saved) with the same
 * defaults a brand-new resume gets, so loading an older saved resume never
 * crashes the editor on a missing array/object. */
function normalizeSelection(selection: Partial<ResumeSelection> | undefined): ResumeSelection {
  return {
    contact: selection?.contact ?? [...CONTACT_FIELDS],
    jobs: selection?.jobs ?? {},
    projects: selection?.projects ?? {},
    education: selection?.education ?? [],
    certifications: selection?.certifications ?? [],
    technicalSkillCategories: selection?.technicalSkillCategories ?? [],
  };
}

/** Fills in any spacing knobs absent from a manifest written before they
 * existed (or before a specific knob was added) with DEFAULT_SPACING. */
function normalizeSpacing(spacing: Partial<SpacingSettings> | undefined): SpacingSettings {
  return { ...DEFAULT_SPACING, ...spacing };
}

export function loadManifest(id: string): ResumeManifest | null {
  const manifestPath = findManifestPath(id);
  if (!manifestPath) return null;
  const manifest: ResumeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return {
    ...manifest,
    selection: normalizeSelection(manifest.selection),
    rawLatexOverride: manifest.rawLatexOverride ?? null,
    spacing: normalizeSpacing(manifest.spacing),
  };
}

/** Derives the human-readable base filename (no extension) a manifest with
 * this title should use on disk — sanitized the same way user-created
 * folder names are, so both look consistent side by side in a native file
 * browser. */
function manifestBaseName(title: string): string {
  try {
    return sanitizeFolderOrTitleName(title);
  } catch {
    return "Untitled resume";
  }
}

/** Picks `${desiredBase}.json`, or `${desiredBase} (2).json`, `(3)`, etc. if
 * that name is already taken in `dir` — the same disambiguation scheme
 * Windows/macOS file browsers use for copy/paste name collisions. */
function uniqueManifestFilename(dir: string, desiredBase: string): string {
  let candidate = `${desiredBase}.json`;
  for (let n = 2; fs.existsSync(path.join(dir, candidate)); n++) {
    candidate = `${desiredBase} (${n}).json`;
  }
  return candidate;
}

export function writeManifest(folderPath: string, manifest: ResumeManifest): string {
  const dir = resolveSavedPath(folderPath);
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, uniqueManifestFilename(dir, manifestBaseName(manifest.title)));
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2), "utf8");
  return target;
}

/** Overwrites a manifest in place, keeping its on-disk filename in sync with
 * its title — if the title changed since this path was last written, the
 * file is renamed (to a disambiguated name if something else in the same
 * folder now has that name) rather than left stale under its old title. */
export function overwriteManifestAtPath(manifestPath: string, manifest: ResumeManifest): string {
  const dir = path.dirname(manifestPath);
  const desiredBase = manifestBaseName(manifest.title);
  const currentBase = path.basename(manifestPath, ".json");
  const target =
    currentBase === desiredBase
      ? manifestPath
      : path.join(dir, uniqueManifestFilename(dir, desiredBase));
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2), "utf8");
  if (target !== manifestPath) fs.rmSync(manifestPath, { force: true });
  return target;
}

/** Moves a saved resume's manifest json to a different folder under the
 * saved-resumes root (drag-and-drop in the file browser). Only the manifest moves — compiled
 * PDF/tex artifacts live in the shared id-keyed .build scratch dir (see
 * resolveSavedBuildDir) and aren't tied to the manifest's folder location. */
export function moveManifest(id: string, targetFolderPath: string): string {
  const sourcePath = findManifestPath(id);
  if (!sourcePath) throw new Error("Resume not found.");
  const targetDir = resolveSavedPath(targetFolderPath);
  fs.mkdirSync(targetDir, { recursive: true });
  if (path.resolve(targetDir) === path.resolve(path.dirname(sourcePath))) return sourcePath;
  const targetPath = path.join(targetDir, uniqueManifestFilename(targetDir, path.basename(sourcePath, ".json")));
  fs.renameSync(sourcePath, targetPath);
  return targetPath;
}
