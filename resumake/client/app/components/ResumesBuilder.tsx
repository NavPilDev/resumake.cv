"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Bold, Italic, Underline, Undo2, Redo2, Download } from "lucide-react";
import { undo, redo } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import { EditorView as CmEditorView } from "@codemirror/view";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { toast } from "sonner";
import { ResumeFileBrowser } from "@/app/components/ResumeFileBrowser";
import { ResumeSaveLocationModal } from "@/app/components/ResumeSaveLocationModal";
import { getPanelGroupElement, type ImperativePanelHandle } from "react-resizable-panels";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { LatexEditor } from "@/components/ui/latex-editor";
import { PdfViewer, type PdfNavigateResult } from "@/components/ui/pdf-viewer";
import { RichBulletEditor } from "@/components/ui/rich-bullet-editor";
import { humanizeSkillCategory } from "@/lib/technicalSkillCategory";
import { cn } from "@/lib/utils";
import { CONTACT_FIELDS } from "@/lib/contactFields";
import { DEFAULT_SPACING, type SpacingSettings } from "@/lib/latexTemplate";
import type {
  ResumeManifest,
  ResumeSelection,
  ResumeTreeNode,
  SectionSelection,
} from "@/lib/resumeFiles";
import type { ExperienceData, GetExperienceResponse, ResumeAnchor } from "@/lib/types";

const EMPTY_EXPERIENCE: ExperienceData = {
  meta: { name: "", email: "", linkedin: "", github: "", website: "" },
  jobs: [],
  projects: [],
  education: [],
  certifications: [],
  technical_skills: {},
};

function emptySelection(): ResumeSelection {
  return {
    contact: [...CONTACT_FIELDS],
    jobs: {},
    projects: {},
    education: [],
    certifications: [],
    technicalSkillCategories: [],
  };
}

type SectionKey =
  | "toc"
  | "contact"
  | "education"
  | "jobs"
  | "projects"
  | "certifications"
  | "skills"
  | "settings";

const sectionLabels: Record<SectionKey, string> = {
  toc: "All Sections",
  contact: "Contact Info",
  education: "Education",
  jobs: "Work Experience",
  projects: "Projects",
  certifications: "Certifications",
  skills: "Technical Skills",
  settings: "Settings",
};

const sectionCardClass =
  "flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950";
const simpleRowClass =
  "flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";
const textareaClass =
  "flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const highlightClass =
  "bg-amber-50 ring-2 ring-amber-400 dark:bg-amber-950/30 dark:ring-amber-500";

function TocRow({ label, summary, onClick }: { label: string; summary: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
    >
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
      <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {summary}
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function SectionHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronLeft className="h-4 w-4" /> All sections
      </button>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{label}</h3>
    </div>
  );
}

type EditorView = "form" | "latex";

const MAX_HISTORY = 20;
const TYPING_COALESCE_MS = 800;

// US Letter aspect ratio the compiled resume page renders at.
const PAGE_ASPECT_RATIO = 8.5 / 11;
// The preview aside's own horizontal padding (p-6 = 1.5rem each side) that
// has to be added on top of the page's own width when deriving the panel's
// pixel floor from the page's aspect ratio.
const PREVIEW_ASIDE_HORIZONTAL_PADDING_PX = 48;
const PREVIEW_MIN_SIZE_PCT_FLOOR = 20;
const PREVIEW_MIN_SIZE_PCT_CEILING = 60;

const PANEL_GROUP_ID = "resume-builder-panels";

interface FormSnapshot {
  selection: ResumeSelection;
  textOverrides: Record<string, string>;
}

function ViewToggle({ value, onChange }: { value: EditorView; onChange: (v: EditorView) => void }) {
  return (
    <div className="relative flex shrink-0 items-center rounded-full border border-zinc-300 bg-zinc-100 p-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900">
      <span
        className={cn(
          "absolute top-0.5 bottom-0.5 left-0.5 w-14 rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-700",
          value === "latex" && "translate-x-14"
        )}
      />
      <button
        onClick={() => onChange("form")}
        className={cn(
          "relative z-10 w-14 rounded-full px-2 py-1 text-center",
          value === "form" ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
        )}
      >
        Form
      </button>
      <button
        onClick={() => onChange("latex")}
        className={cn(
          "relative z-10 w-14 rounded-full px-2 py-1 text-center",
          value === "latex" ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
        )}
      >
        LaTeX
      </button>
    </div>
  );
}

function DownloadMenu({ pdfHref, texHref }: { pdfHref: string; texHref: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        title="Download"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-zinc-300 p-2 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <Download className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-40 overflow-hidden rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <a
            href={pdfHref}
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Download PDF
          </a>
          <a
            href={texHref}
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Download LaTeX
          </a>
        </div>
      )}
    </div>
  );
}

/** Icon button for the editor's contextual toolbar row (bold/italic/
 * underline in Form view, undo/redo in LaTeX view). Uses onMouseDown +
 * preventDefault (not onClick) so clicking the button never steals focus
 * away from whichever bullet textarea has the active text selection —
 * onClick would fire after the browser has already moved focus to the
 * button, losing the selection applyFormatting needs to read. */
function ToolbarIconButton({
  title,
  onActivate,
  disabled,
  children,
}: {
  title: string;
  onActivate: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onActivate();
      }}
      className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

export default function ResumesBuilder() {
  const [experience, setExperience] = useState<ExperienceData>(EMPTY_EXPERIENCE);
  const [experienceLoading, setExperienceLoading] = useState(true);
  const [experienceError, setExperienceError] = useState<string | null>(null);

  const [tree, setTree] = useState<ResumeTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);

  const [mode, setMode] = useState<"browse" | "create" | "edit">("browse");
  const [activeSection, setActiveSection] = useState<SectionKey>("toc");
  const [editorView, setEditorView] = useState<EditorView>("form");
  const [texContent, setTexContent] = useState<string | null>(null);
  const [texLoading, setTexLoading] = useState(false);
  const [texDirty, setTexDirty] = useState(false);
  const latexEditorRef = useRef<ReactCodeMirrorRef>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selection, setSelection] = useState<ResumeSelection>(emptySelection());
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  const [spacing, setSpacing] = useState<SpacingSettings>(DEFAULT_SPACING);
  const [lastCompileAt, setLastCompileAt] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Form-mode undo/redo — a separate history from the LaTeX editor's own
  // (CodeMirror already has its own undo/redo for raw-text edits). Capped at
  // 20 entries each; lives only in component state, so a page refresh (or
  // switching resumes) starts a clean history rather than persisting it.
  const [undoStack, setUndoStack] = useState<FormSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<FormSnapshot[]>([]);
  const lastEditRef = useRef<{ bulletId: string; at: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/experience");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
        if (cancelled) return;
        const payload = data as GetExperienceResponse;
        setExperience(payload.experience);
        if (payload.idsBackfilled) {
          // Persist the newly-assigned job/project/education ids once,
          // invisibly, via the existing (already-validated) save route.
          fetch("/api/experience/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ experience: payload.experience }),
          }).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setExperienceError(err instanceof Error ? err.message : "Failed to load experience.yaml");
      } finally {
        if (!cancelled) setExperienceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshTree() {
    setTreeLoading(true);
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setTree(data.tree as ResumeTreeNode[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load saved resumes");
    } finally {
      setTreeLoading(false);
    }
  }

  useEffect(() => {
    refreshTree();
  }, []);

  function startCreate() {
    setMode("create");
    setActiveSection("toc");
    setEditorView("form");
    setTexContent(null);
    setTexDirty(false);
    setResumeId(null);
    setTitle("");
    setSelection(emptySelection());
    setTextOverrides({});
    setSpacing(DEFAULT_SPACING);
    setLastCompileAt(null);
    setSaveError(null);
    setDirty(true);
    setUndoStack([]);
    setRedoStack([]);
    lastEditRef.current = null;
  }

  async function openResume(id: string) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/resumes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      const manifest = data as ResumeManifest;
      setMode("edit");
      setActiveSection("toc");
      setEditorView("form");
      setTexContent(null);
      setTexDirty(false);
      setResumeId(manifest.id);
      setTitle(manifest.title);
      setSelection(manifest.selection);
      setTextOverrides(manifest.textOverrides);
      setSpacing({ ...DEFAULT_SPACING, ...manifest.spacing });
      setLastCompileAt(manifest.lastCompile?.compiledAt ?? manifest.updatedAt);
      setDirty(false);
      setUndoStack([]);
      setRedoStack([]);
      lastEditRef.current = null;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load resume");
    }
  }

  async function handleCreateFolder(parentPath: string, name: string) {
    try {
      const res = await fetch("/api/resumes/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      await refreshTree();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    }
  }

  async function handleMoveResume(id: string, folderPath: string) {
    try {
      const res = await fetch(`/api/resumes/${id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      await refreshTree();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to move resume");
    }
  }

  async function handleRevealResume(id: string) {
    try {
      const res = await fetch(`/api/resumes/${id}/reveal`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open folder");
    }
  }

  async function handleRevealFolder(folderPath: string) {
    try {
      const res = await fetch("/api/resumes/folders/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderPath }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open folder");
    }
  }

  /** Snapshots the pre-change {selection, textOverrides} onto the undo
   * stack (capped at MAX_HISTORY) and clears any redo history, since a new
   * edit invalidates whatever was previously undone. Called by every
   * Form-mode mutating action below except continued typing in the same
   * bullet (see setOverride's coalescing). */
  function pushUndoSnapshot() {
    const next = [...undoStack, { selection, textOverrides }];
    setUndoStack(next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next);
    if (redoStack.length > 0) setRedoStack([]);
  }

  function handleUndo() {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    const nextRedo = [...redoStack, { selection, textOverrides }];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack(nextRedo.length > MAX_HISTORY ? nextRedo.slice(nextRedo.length - MAX_HISTORY) : nextRedo);
    setSelection(snapshot.selection);
    setTextOverrides(snapshot.textOverrides);
    lastEditRef.current = null;
    setDirty(true);
    setTexDirty(false);
  }

  function handleRedo() {
    if (redoStack.length === 0) return;
    const snapshot = redoStack[redoStack.length - 1];
    const nextUndo = [...undoStack, { selection, textOverrides }];
    setRedoStack(redoStack.slice(0, -1));
    setUndoStack(nextUndo.length > MAX_HISTORY ? nextUndo.slice(nextUndo.length - MAX_HISTORY) : nextUndo);
    setSelection(snapshot.selection);
    setTextOverrides(snapshot.textOverrides);
    lastEditRef.current = null;
    setDirty(true);
    setTexDirty(false);
  }

  function toggleContact(key: string) {
    pushUndoSnapshot();
    lastEditRef.current = null;
    setSelection((prev) => {
      const has = prev.contact.includes(key);
      return { ...prev, contact: has ? prev.contact.filter((k) => k !== key) : [...prev.contact, key] };
    });
    setDirty(true);
    setTexDirty(false);
  }

  function toggleJob(jobId: string, allBulletIds: string[]) {
    pushUndoSnapshot();
    lastEditRef.current = null;
    setSelection((prev) => {
      const current = prev.jobs[jobId];
      const nextIncluded = !(current?.included ?? false);
      const next: SectionSelection = {
        included: nextIncluded,
        bulletIds: current?.bulletIds ?? (nextIncluded ? allBulletIds : []),
      };
      return { ...prev, jobs: { ...prev.jobs, [jobId]: next } };
    });
    setDirty(true);
    setTexDirty(false);
  }

  function toggleJobBullet(jobId: string, bulletId: string) {
    pushUndoSnapshot();
    lastEditRef.current = null;
    setSelection((prev) => {
      const current = prev.jobs[jobId] ?? { included: true, bulletIds: [] };
      const has = current.bulletIds.includes(bulletId);
      const next: SectionSelection = {
        included: current.included,
        bulletIds: has ? current.bulletIds.filter((id) => id !== bulletId) : [...current.bulletIds, bulletId],
      };
      return { ...prev, jobs: { ...prev.jobs, [jobId]: next } };
    });
    setDirty(true);
    setTexDirty(false);
  }

  function toggleProject(projectId: string, allBulletIds: string[]) {
    pushUndoSnapshot();
    lastEditRef.current = null;
    setSelection((prev) => {
      const current = prev.projects[projectId];
      const nextIncluded = !(current?.included ?? false);
      const next: SectionSelection = {
        included: nextIncluded,
        bulletIds: current?.bulletIds ?? (nextIncluded ? allBulletIds : []),
      };
      return { ...prev, projects: { ...prev.projects, [projectId]: next } };
    });
    setDirty(true);
    setTexDirty(false);
  }

  function toggleProjectBullet(projectId: string, bulletId: string) {
    pushUndoSnapshot();
    lastEditRef.current = null;
    setSelection((prev) => {
      const current = prev.projects[projectId] ?? { included: true, bulletIds: [] };
      const has = current.bulletIds.includes(bulletId);
      const next: SectionSelection = {
        included: current.included,
        bulletIds: has ? current.bulletIds.filter((id) => id !== bulletId) : [...current.bulletIds, bulletId],
      };
      return { ...prev, projects: { ...prev.projects, [projectId]: next } };
    });
    setDirty(true);
    setTexDirty(false);
  }

  function toggleArrayMember(key: "education" | "certifications" | "technicalSkillCategories", id: string) {
    pushUndoSnapshot();
    lastEditRef.current = null;
    setSelection((prev) => {
      const arr = prev[key];
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      return { ...prev, [key]: next };
    });
    setDirty(true);
    setTexDirty(false);
  }

  /** Rapid consecutive edits to the same bullet (normal typing, or a Ctrl+B/
   * Ctrl+I/Ctrl+U formatting toggle right after) coalesce into a single undo
   * step instead of one entry per keystroke — otherwise the 20-entry cap
   * would only cover a few characters of typing. A pause longer than
   * TYPING_COALESCE_MS, or editing a different bullet, starts a new step. */
  function setOverride(bulletId: string, text: string) {
    const now = Date.now();
    const last = lastEditRef.current;
    const isContinuation = !!last && last.bulletId === bulletId && now - last.at < TYPING_COALESCE_MS;
    if (!isContinuation) pushUndoSnapshot();
    lastEditRef.current = { bulletId, at: now };
    setTextOverrides((prev) => ({ ...prev, [bulletId]: text }));
    setDirty(true);
    setTexDirty(false);
  }

  async function doSave(finalTitle: string, folderPath?: string) {
    setSaving(true);
    setSaveError(null);
    const rawLatexOverride = texDirty ? texContent : null;
    try {
      if (!resumeId) {
        const res = await fetch("/api/resumes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: finalTitle,
            folderPath: folderPath ?? "",
            selection,
            textOverrides,
            rawLatexOverride,
            spacing,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
        const manifest = data as ResumeManifest;
        setResumeId(manifest.id);
        setTitle(manifest.title);
        setMode("edit");
        setLastCompileAt(manifest.lastCompile?.compiledAt ?? manifest.updatedAt);
        setDirty(false);
        setTexDirty(false);
        setShowSaveModal(false);
        toast.success("Resume saved");
        await refreshTree();
      } else {
        const res = await fetch(`/api/resumes/${resumeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: finalTitle, selection, textOverrides, rawLatexOverride, spacing }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
        const manifest = data as ResumeManifest;
        setTitle(manifest.title);
        setLastCompileAt(manifest.lastCompile?.compiledAt ?? manifest.updatedAt);
        setDirty(false);
        setTexDirty(false);
        toast.success("Resume saved");
        await refreshTree();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save resume");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (saving || !dirty) return;
    if (!resumeId) {
      setShowSaveModal(true);
      return;
    }
    doSave(title);
  }

  /** Applies bold/italic/underline to the current selection in the
   * last-focused bullet editor (see the data-bullet-id attribute set by
   * RichBulletEditor) via the browser's native execCommand — the resulting
   * DOM edit (real <b>/<i>/<u> tags) fires a native input event, which
   * RichBulletEditor's onInput already converts back to the stored
   * \textbf{}/\textit{}/\underline{} text via htmlToRaw, so no separate
   * setOverride call is needed here. No-ops if focus isn't in a bullet
   * editor or nothing is selected. Toggling an already-bold selection
   * un-bolds it, same as any rich text editor. */
  function applyFormatting(kind: "bold" | "italic" | "underline") {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !el.isContentEditable || !el.dataset.bulletId) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
    if (!el.contains(selection.anchorNode)) return;
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(kind === "underline" ? "underline" : kind === "italic" ? "italic" : "bold");
  }

  // Ref-indirection for everything the mount-once keydown listener below
  // calls: the listener's closure is captured once (empty deps), so without
  // routing through a ref reassigned every render, it would keep calling the
  // very first render's handleUndo/handleRedo/applyFormatting — which read
  // stale undoStack/selection/textOverrides/editorView values instead of the
  // current ones (unlike plain setState updater functions, these read state
  // directly to build snapshots, so staleness here would silently corrupt
  // undo history).
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;
  const handleRedoRef = useRef(handleRedo);
  handleRedoRef.current = handleRedo;
  const applyFormattingRef = useRef(applyFormatting);
  applyFormattingRef.current = applyFormatting;
  const editorViewRef = useRef(editorView);
  editorViewRef.current = editorView;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        handleSaveRef.current();
      } else if (key === "z") {
        // The LaTeX editor has its own Ctrl+Z history (CodeMirror's
        // basicSetup); Form-mode undo is a separate history and shouldn't
        // fire underneath it.
        if (editorViewRef.current !== "form") return;
        e.preventDefault();
        handleUndoRef.current();
      } else if (key === "y") {
        if (editorViewRef.current !== "form") return;
        e.preventDefault();
        handleRedoRef.current();
      } else if (key === "b" || key === "i" || key === "u") {
        const el = document.activeElement;
        if (el instanceof HTMLElement && el.isContentEditable && el.dataset.bulletId) {
          e.preventDefault();
          applyFormattingRef.current(key === "b" ? "bold" : key === "i" ? "italic" : "underline");
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!resumeId) {
      setTexContent(null);
      return;
    }
    let cancelled = false;
    setTexLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}/tex`);
        if (!res.ok) {
          if (!cancelled) setTexContent(null);
          return;
        }
        const text = await res.text();
        if (!cancelled) {
          setTexContent(text);
          setTexDirty(false);
        }
      } finally {
        if (!cancelled) setTexLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeId, lastCompileAt]);

  // Keeps the preview panel from being resized narrower than what's needed to
  // show a full resume page at whatever height it currently has (Overleaf-style):
  // derive the required page width from the page wrapper's live height via the
  // page's own aspect ratio, then floor the panel's width at that + its padding.
  const previewPageWrapperRef = useRef<HTMLDivElement>(null);
  const previewPanelRef = useRef<ImperativePanelHandle>(null);
  const [previewMinSizePct, setPreviewMinSizePct] = useState(PREVIEW_MIN_SIZE_PCT_FLOOR);

  useEffect(() => {
    const groupEl = getPanelGroupElement(PANEL_GROUP_ID);
    const wrapperEl = previewPageWrapperRef.current;
    if (!groupEl || !wrapperEl) return;

    function recompute() {
      const groupWidth = groupEl!.getBoundingClientRect().width;
      const wrapperHeight = wrapperEl!.getBoundingClientRect().height;
      if (groupWidth <= 0 || wrapperHeight <= 0) return;

      const requiredPageWidthPx = wrapperHeight * PAGE_ASPECT_RATIO;
      const requiredPanelWidthPx = requiredPageWidthPx + PREVIEW_ASIDE_HORIZONTAL_PADDING_PX;
      const pct = Math.min(
        PREVIEW_MIN_SIZE_PCT_CEILING,
        Math.max(PREVIEW_MIN_SIZE_PCT_FLOOR, (requiredPanelWidthPx / groupWidth) * 100)
      );
      setPreviewMinSizePct(pct);

      const currentSize = previewPanelRef.current?.getSize();
      if (currentSize !== undefined && currentSize < pct) {
        previewPanelRef.current?.resize(pct);
      }
    }

    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(groupEl);
    observer.observe(wrapperEl);
    // Belt-and-suspenders alongside ResizeObserver for the whole-window-resize case.
    window.addEventListener("resize", recompute);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recompute);
    };
  }, [mode]);

  // Double-click-to-source: double-clicking the pdf.js preview resolves (via
  // SyncTeX, see /api/resumes/[id]/synctex) to a section/entry/bullet. In
  // Form view that switches to the matching section and briefly highlights
  // the row; in LaTeX view it scrolls/selects the corresponding source line.
  // rowRefs lets the highlight-scroll effect below find the target row once
  // its section becomes active — it isn't in the DOM until then.
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [highlightTarget, setHighlightTarget] = useState<ResumeAnchor | null>(null);

  function rowKey(section: string, entryId?: string, bulletId?: string): string {
    return `${section}:${entryId ?? ""}:${bulletId ?? ""}`;
  }

  function registerRow(section: string, entryId?: string, bulletId?: string) {
    const key = rowKey(section, entryId, bulletId);
    return (el: HTMLElement | null) => {
      if (el) rowRefs.current.set(key, el);
      else rowRefs.current.delete(key);
    };
  }

  function isRowHighlighted(section: string, entryId?: string, bulletId?: string): boolean {
    return (
      !!highlightTarget &&
      highlightTarget.section === section &&
      (highlightTarget.entryId ?? "") === (entryId ?? "") &&
      (highlightTarget.bulletId ?? "") === (bulletId ?? "")
    );
  }

  function handleNavigate({ anchor, line }: PdfNavigateResult) {
    if (line === null) {
      toast.error("Couldn't find that spot in the compiled source.");
      return;
    }
    if (editorViewRef.current === "latex") {
      const view = latexEditorRef.current?.view;
      if (view) {
        const clampedLine = Math.min(Math.max(line, 1), view.state.doc.lines);
        const lineInfo = view.state.doc.line(clampedLine);
        view.dispatch({
          selection: EditorSelection.range(lineInfo.from, lineInfo.to),
          effects: CmEditorView.scrollIntoView(lineInfo.from, { y: "center" }),
        });
        view.focus();
      }
      return;
    }
    if (!anchor) {
      toast("That spot doesn't map to an editable field.");
      return;
    }
    setActiveSection(anchor.section as SectionKey);
    setHighlightTarget(anchor);
  }

  const handleNavigateRef = useRef(handleNavigate);
  handleNavigateRef.current = handleNavigate;
  const stableOnNavigateRef = useRef((result: PdfNavigateResult) => handleNavigateRef.current(result));

  useEffect(() => {
    if (!highlightTarget) return;
    const t = setTimeout(() => setHighlightTarget(null), 2500);
    return () => clearTimeout(t);
  }, [highlightTarget]);

  useEffect(() => {
    if (!highlightTarget || highlightTarget.section !== activeSection) return;
    const key = rowKey(highlightTarget.section, highlightTarget.entryId, highlightTarget.bulletId);
    const el = rowRefs.current.get(key);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeSection, highlightTarget]);

  if (experienceLoading || treeLoading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>;
  }

  if (experienceError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{experienceError}</p>;
  }

  const certifications = experience.certifications ?? [];
  const skillCategories = Object.keys(experience.technical_skills);
  const jobsIncludedCount = experience.jobs.filter((j) => j.id && selection.jobs[j.id]?.included).length;
  const projectsIncludedCount = experience.projects.filter((p) => p.id && selection.projects[p.id]?.included).length;

  function renderBulletRow(
    section: "jobs" | "projects",
    entryId: string,
    bulletId: string,
    sourceText: string,
    checked: boolean,
    onToggle: () => void
  ) {
    return (
      <div
        key={bulletId}
        ref={registerRow(section, entryId, bulletId)}
        className={cn(
          "flex items-start gap-2 rounded-md p-1 transition-colors",
          isRowHighlighted(section, entryId, bulletId) && highlightClass
        )}
      >
        <input type="checkbox" className="mt-2" checked={checked} onChange={onToggle} />
        <RichBulletEditor
          value={textOverrides[bulletId] ?? sourceText}
          onChange={(next) => setOverride(bulletId, next)}
          bulletId={bulletId}
          title="Select text and press Ctrl+B / Ctrl+I / Ctrl+U to format it"
          className={textareaClass}
        />
      </div>
    );
  }

  function renderToc() {
    return (
      <div className="flex flex-col gap-2">
        <TocRow
          label="Contact Info"
          summary={`${selection.contact.length}/${CONTACT_FIELDS.length} fields`}
          onClick={() => setActiveSection("contact")}
        />
        <TocRow
          label="Education"
          summary={`${selection.education.length}/${experience.education.length} included`}
          onClick={() => setActiveSection("education")}
        />
        <TocRow
          label="Work Experience"
          summary={`${jobsIncludedCount}/${experience.jobs.length} included`}
          onClick={() => setActiveSection("jobs")}
        />
        <TocRow
          label="Projects"
          summary={`${projectsIncludedCount}/${experience.projects.length} included`}
          onClick={() => setActiveSection("projects")}
        />
        {certifications.length > 0 && (
          <TocRow
            label="Certifications"
            summary={`${selection.certifications.length}/${certifications.length} included`}
            onClick={() => setActiveSection("certifications")}
          />
        )}
        <TocRow
          label="Technical Skills"
          summary={`${selection.technicalSkillCategories.length}/${skillCategories.length} categories`}
          onClick={() => setActiveSection("skills")}
        />
        <TocRow
          label="Settings"
          summary="Spacing"
          onClick={() => setActiveSection("settings")}
        />
      </div>
    );
  }

  function renderContactSection() {
    const fieldLabels: Record<(typeof CONTACT_FIELDS)[number], string> = {
      email: "Email",
      linkedin: "LinkedIn",
      github: "GitHub",
      website: "Website",
    };
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Contact Info" onBack={() => setActiveSection("toc")} />
        <p
          ref={registerRow("contact", "name")}
          className={cn(simpleRowClass, isRowHighlighted("contact", "name") && highlightClass)}
        >
          <span className="font-medium">Name:</span> {experience.meta.name || "(not set)"}{" "}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">— always included</span>
        </p>
        {CONTACT_FIELDS.map((key) => (
          <label
            key={key}
            ref={registerRow("contact", key)}
            className={cn(simpleRowClass, isRowHighlighted("contact", key) && highlightClass)}
          >
            <input
              type="checkbox"
              checked={selection.contact.includes(key)}
              onChange={() => toggleContact(key)}
            />
            <span className="font-medium">{fieldLabels[key]}:</span>{" "}
            {(experience.meta[key] as string) || "(not set)"}
          </label>
        ))}
      </div>
    );
  }

  function renderEducationSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Education" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {experience.education.map(
            (edu) =>
              edu.id && (
                <label
                  key={edu.id}
                  ref={registerRow("education", edu.id)}
                  className={cn(simpleRowClass, isRowHighlighted("education", edu.id) && highlightClass)}
                >
                  <input
                    type="checkbox"
                    checked={selection.education.includes(edu.id)}
                    onChange={() => toggleArrayMember("education", edu.id!)}
                  />
                  {edu.institution || edu.credential || "(untitled)"}
                </label>
              )
          )}
        </div>
      </div>
    );
  }

  function renderJobsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Work Experience" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {experience.jobs.map(
            (job) =>
              job.id && (
                <div
                  key={job.id}
                  ref={registerRow("jobs", job.id)}
                  className={cn(sectionCardClass, isRowHighlighted("jobs", job.id) && highlightClass)}
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selection.jobs[job.id]?.included ?? false}
                      onChange={() => toggleJob(job.id!, job.bullets.map((b) => b.id))}
                    />
                    {job.company || "(untitled)"} — {job.role}
                  </label>
                  {selection.jobs[job.id]?.included && (
                    <div className="flex flex-col gap-2 pl-6">
                      {job.bullets.map((b) =>
                        renderBulletRow(
                          "jobs",
                          job.id!,
                          b.id,
                          b.text,
                          selection.jobs[job.id!]?.bulletIds.includes(b.id) ?? false,
                          () => toggleJobBullet(job.id!, b.id)
                        )
                      )}
                    </div>
                  )}
                </div>
              )
          )}
        </div>
      </div>
    );
  }

  function renderProjectsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Projects" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {experience.projects.map(
            (project) =>
              project.id && (
                <div
                  key={project.id}
                  ref={registerRow("projects", project.id)}
                  className={cn(sectionCardClass, isRowHighlighted("projects", project.id) && highlightClass)}
                >
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selection.projects[project.id]?.included ?? false}
                      onChange={() => toggleProject(project.id!, project.bullets.map((b) => b.id))}
                    />
                    {project.name || "(untitled)"}
                  </label>
                  {selection.projects[project.id]?.included && (
                    <div className="flex flex-col gap-2 pl-6">
                      {project.bullets.map((b) =>
                        renderBulletRow(
                          "projects",
                          project.id!,
                          b.id,
                          b.text,
                          selection.projects[project.id!]?.bulletIds.includes(b.id) ?? false,
                          () => toggleProjectBullet(project.id!, b.id)
                        )
                      )}
                    </div>
                  )}
                </div>
              )
          )}
        </div>
      </div>
    );
  }

  function renderCertificationsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Certifications" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {certifications.map((cert) => (
            <label
              key={cert.id}
              ref={registerRow("certifications", cert.id)}
              className={cn(simpleRowClass, isRowHighlighted("certifications", cert.id) && highlightClass)}
            >
              <input
                type="checkbox"
                checked={selection.certifications.includes(cert.id)}
                onChange={() => toggleArrayMember("certifications", cert.id)}
              />
              {cert.name || "(untitled)"}
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderSkillsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Technical Skills" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {skillCategories.map((category) => {
            const entries = experience.technical_skills[category] ?? [];
            return (
              <label
                key={category}
                ref={registerRow("skills", category)}
                className={cn(
                  simpleRowClass,
                  "items-start",
                  isRowHighlighted("skills", category) && highlightClass
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selection.technicalSkillCategories.includes(category)}
                  onChange={() => toggleArrayMember("technicalSkillCategories", category)}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{humanizeSkillCategory(category)}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entries.length > 0 ? entries.map((e) => e.skill).join(", ") : "No skills listed"}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  function updateSpacing(key: keyof SpacingSettings, value: number) {
    setSpacing((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function SpacingField({ label, keyName }: { label: string; keyName: keyof SpacingSettings }) {
    return (
      <label className={cn(simpleRowClass, "justify-between")}>
        <span>{label}</span>
        <span className="flex items-center gap-1">
          <input
            type="number"
            step={0.5}
            value={spacing[keyName]}
            onChange={(e) => updateSpacing(keyName, Number(e.target.value) || 0)}
            className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-right text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">pt</span>
        </span>
      </label>
    );
  }

  function renderSettingsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Settings" onBack={() => setActiveSection("toc")} />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Fine-tune the vertical spacing (LaTeX <code>\vspace</code>) between elements in the
          compiled resume. More negative values pull content closer together; less negative (or
          positive) values add room. Save to see the effect in the preview.
        </p>

        <div className={sectionCardClass}>
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Education</h4>
          <SpacingField label="Between entries" keyName="educationEntryGap" />
        </div>

        <div className={sectionCardClass}>
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Work Experience</h4>
          <SpacingField label="Between entries" keyName="jobsEntryGap" />
          <SpacingField label="After section" keyName="jobsSectionGap" />
        </div>

        <div className={sectionCardClass}>
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Projects</h4>
          <SpacingField label="Between entries" keyName="projectsEntryGap" />
          <SpacingField label="After section" keyName="projectsSectionGap" />
        </div>

        {certifications.length > 0 && (
          <div className={sectionCardClass}>
            <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Certifications</h4>
            <SpacingField label="Between entries" keyName="certificationsEntryGap" />
          </div>
        )}

        <div className={sectionCardClass}>
          <h4 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Technical Skills</h4>
          <SpacingField label="Between lines" keyName="skillsLineGap" />
          <SpacingField label="After section" keyName="skillsSectionGap" />
        </div>

        <button
          onClick={() => {
            setSpacing(DEFAULT_SPACING);
            setDirty(true);
          }}
          className="self-start text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Reset to defaults
        </button>
      </div>
    );
  }

  return (
    <>
      <ResizablePanelGroup id={PANEL_GROUP_ID} direction="horizontal" className="min-h-0 flex-1">
        <ResizablePanel id="file-browser" order={1} defaultSize={18} minSize={12} maxSize={32}>
          <ResumeFileBrowser
            tree={tree}
            selectedId={resumeId}
            onOpenResume={openResume}
            onCreateFolder={handleCreateFolder}
            onCreateResume={startCreate}
            onMoveResume={handleMoveResume}
            onRevealResume={handleRevealResume}
            onRevealFolder={handleRevealFolder}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {mode === "browse" ? (
          <ResizablePanel id="browse-placeholder" order={2} defaultSize={82} minSize={30}>
            <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500 dark:text-zinc-400">
              Select a saved resume on the left, or click the new-resume button to create one.
            </div>
          </ResizablePanel>
        ) : (
          <>
            <ResizablePanel id="editor" order={2} defaultSize={42} minSize={25}>
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
                  <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {title || "New resume"}
                    </span>
                    <span className="mx-1.5 text-zinc-400 dark:text-zinc-600">/</span>
                    {sectionLabels[activeSection]}
                  </span>
                  <ViewToggle value={editorView} onChange={setEditorView} />
                </div>

                <div className="flex shrink-0 items-center gap-1 border-b border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
                  {editorView === "latex" ? (
                    <>
                      <ToolbarIconButton
                        title="Undo (Ctrl+Z)"
                        onActivate={() => {
                          const view = latexEditorRef.current?.view;
                          if (view) undo(view);
                        }}
                      >
                        <Undo2 className="h-4 w-4" />
                      </ToolbarIconButton>
                      <ToolbarIconButton
                        title="Redo (Ctrl+Y)"
                        onActivate={() => {
                          const view = latexEditorRef.current?.view;
                          if (view) redo(view);
                        }}
                      >
                        <Redo2 className="h-4 w-4" />
                      </ToolbarIconButton>
                    </>
                  ) : (
                    <>
                      <ToolbarIconButton
                        title="Undo (Ctrl+Z)"
                        disabled={undoStack.length === 0}
                        onActivate={handleUndo}
                      >
                        <Undo2 className="h-4 w-4" />
                      </ToolbarIconButton>
                      <ToolbarIconButton
                        title="Redo (Ctrl+Y)"
                        disabled={redoStack.length === 0}
                        onActivate={handleRedo}
                      >
                        <Redo2 className="h-4 w-4" />
                      </ToolbarIconButton>
                      <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
                      <ToolbarIconButton title="Bold (Ctrl+B)" onActivate={() => applyFormatting("bold")}>
                        <Bold className="h-4 w-4" />
                      </ToolbarIconButton>
                      <ToolbarIconButton title="Italic (Ctrl+I)" onActivate={() => applyFormatting("italic")}>
                        <Italic className="h-4 w-4" />
                      </ToolbarIconButton>
                      <ToolbarIconButton
                        title="Underline (Ctrl+U)"
                        onActivate={() => applyFormatting("underline")}
                      >
                        <Underline className="h-4 w-4" />
                      </ToolbarIconButton>
                    </>
                  )}
                </div>

                {editorView === "latex" ? (
                  <div className="min-h-0 flex-1 overflow-hidden">
                    {!resumeId ? (
                      <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
                        Save this resume to generate its LaTeX source.
                      </p>
                    ) : texLoading ? (
                      <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
                    ) : texContent !== null ? (
                      <LatexEditor
                        ref={latexEditorRef}
                        value={texContent}
                        onChange={(next) => {
                          setTexContent(next);
                          setTexDirty(true);
                          setDirty(true);
                        }}
                        className="h-full"
                      />
                    ) : (
                      <p className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
                        This resume hasn&apos;t been compiled yet — save to generate LaTeX.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-auto p-6">
                    {activeSection === "toc" && renderToc()}
                    {activeSection === "contact" && renderContactSection()}
                    {activeSection === "education" && renderEducationSection()}
                    {activeSection === "jobs" && renderJobsSection()}
                    {activeSection === "projects" && renderProjectsSection()}
                    {activeSection === "certifications" && renderCertificationsSection()}
                    {activeSection === "skills" && renderSkillsSection()}
                    {activeSection === "settings" && renderSettingsSection()}
                  </div>
                )}
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel
              id="preview"
              order={3}
              ref={previewPanelRef}
              defaultSize={40}
              minSize={previewMinSizePct}
            >
              <aside className="flex h-full flex-col gap-3 overflow-hidden p-6">
                <div className="flex shrink-0 items-center gap-2">
                  {resumeId ? (
                    <input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setDirty(true);
                      }}
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  ) : (
                    <p className="flex-1 text-sm text-zinc-500 dark:text-zinc-400">New resume (unsaved)</p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className={cn(
                      "shrink-0 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50",
                      dirty ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-700"
                    )}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  {resumeId && (
                    <DownloadMenu
                      pdfHref={`/api/resumes/${resumeId}/pdf?download=1`}
                      texHref={`/api/resumes/${resumeId}/tex`}
                    />
                  )}
                </div>

                {saveError && <p className="shrink-0 text-sm text-red-600 dark:text-red-400">{saveError}</p>}

                <div
                  ref={previewPageWrapperRef}
                  className="flex min-h-0 flex-1 items-center justify-center"
                >
                  <div className="aspect-[8.5/11] h-full max-w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                    {resumeId && lastCompileAt ? (
                      <PdfViewer
                        key={resumeId}
                        resumeId={resumeId}
                        pdfUrl={`/api/resumes/${resumeId}/pdf?t=${encodeURIComponent(lastCompileAt)}`}
                        onNavigate={stableOnNavigateRef.current}
                        className="h-full w-full overflow-y-auto"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Save to generate a preview.
                      </div>
                    )}
                  </div>
                </div>
              </aside>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {showSaveModal && (
        <ResumeSaveLocationModal
          tree={tree}
          submitting={saving}
          error={saveError}
          onCancel={() => setShowSaveModal(false)}
          onConfirm={(t, folderPath) => doSave(t, folderPath)}
        />
      )}
    </>
  );
}
