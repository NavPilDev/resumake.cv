import fs from "fs";
import path from "path";
import { resolveRepoRoot } from "./repoPaths";
import { CONTACT_FIELDS } from "./contactFields";

/** Compiled-artifact scratch space, shared by every saved resume regardless
 * of which user-facing folder its manifest lives in — latexmk only reads
 * .latexmkrc from its own cwd (no parent-directory search), so a single
 * shared build dir avoids needing one .latexmkrc per user-created folder. */
const BUILD_DIR_NAME = ".build";

export function resolveSavedRoot(): string {
  const root = path.join(resolveRepoRoot(), "saved");
  fs.mkdirSync(root, { recursive: true });
  return root;
}

/** Joins user-supplied path segments onto the /saved root and verifies the
 * resolved absolute path never escapes it — folder/resume names arrive from
 * API request bodies, so this is the single choke point guarding every
 * write under /saved against `..`, absolute-path, or drive-letter injection. */
export function resolveSavedPath(...segments: string[]): string {
  const root = resolveSavedRoot();
  const resolved = path.resolve(root, ...segments);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error("Path escapes the /saved directory.");
  }
  return resolved;
}

export function sanitizeFolderOrTitleName(name: string): string {
  const cleaned = name.trim().replace(/[\\/:*?"<>|\x00-\x1f]/g, "").slice(0, 120);
  if (!cleaned) throw new Error("Name cannot be empty.");
  return cleaned;
}

export function resolveSavedBuildDir(): string {
  const buildDir = path.join(resolveSavedRoot(), BUILD_DIR_NAME);
  fs.mkdirSync(buildDir, { recursive: true });
  const rcPath = path.join(buildDir, ".latexmkrc");
  if (!fs.existsSync(rcPath)) {
    fs.writeFileSync(
      rcPath,
      "$aux_dir = 'build';\n$out_dir = 'out';\n$pdf_mode = 1;\n$synctex = 1;\n$pdflatex = 'pdflatex -synctex=1 %O %S';\n",
      "utf8"
    );
  }
  return buildDir;
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
   * existing per-bullet override map. Plain text only for now — Ctrl+B/
   * Ctrl+I rich text is deferred (see resume-revisioner/AGENTS.md). */
  textOverrides: Record<string, string>;
  lastCompile: { pagesUsed: number | null; compiledAt: string; warnings?: string[] } | null;
}

export interface ResumeCreateRequest {
  title: string;
  folderPath: string;
  selection: ResumeSelection;
  textOverrides: Record<string, string>;
}

export interface ResumeUpdateRequest {
  title?: string;
  selection: ResumeSelection;
  textOverrides: Record<string, string>;
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

/** Walks the whole /saved tree (skipping .build). Fine at personal-resume
 * scale — no id->path index is maintained since there's nothing resembling
 * a database here, just a folder of JSON files. */
export function listResumeTree(): ResumeTreeNode[] {
  return walk(resolveSavedRoot(), "");
}

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
      } else if (entry.name === `${id}.json`) {
        return abs;
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

export function loadManifest(id: string): ResumeManifest | null {
  const manifestPath = findManifestPath(id);
  if (!manifestPath) return null;
  const manifest: ResumeManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  return { ...manifest, selection: normalizeSelection(manifest.selection) };
}

export function writeManifest(folderPath: string, manifest: ResumeManifest): void {
  const dir = resolveSavedPath(folderPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${manifest.id}.json`), JSON.stringify(manifest, null, 2), "utf8");
}

export function overwriteManifestAtPath(manifestPath: string, manifest: ResumeManifest): void {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}
