"use client";

import { useEffect, useState } from "react";
import type { ResumeTreeNode } from "@/lib/resumeFiles";

function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}

function collectFolderPaths(nodes: ResumeTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.type === "folder") {
      paths.push(node.path);
      paths.push(...collectFolderPaths(node.children));
    }
  }
  return paths;
}

interface ResumeSaveLocationModalProps {
  tree: ResumeTreeNode[];
  submitting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (title: string, folderPath: string) => void;
}

/** Title + save-location prompt shown on a resume's first save. Styled the
 * same hand-rolled fixed-overlay way as app/components/ui/version-compare-modal.tsx
 * (that file's shell isn't exported, so this is its own standalone modal
 * rather than a shared component). */
export function ResumeSaveLocationModal({
  tree,
  submitting,
  error,
  onCancel,
  onConfirm,
}: ResumeSaveLocationModalProps) {
  const [title, setTitle] = useState("");
  const [folderPath, setFolderPath] = useState("");
  useEscapeToClose(onCancel);

  const folders = ["", ...collectFolderPaths(tree)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Save resume"
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg bg-white p-5 dark:bg-zinc-950"
      >
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Save resume</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Give it a title and choose where it lives in the file browser.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Title
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Backend Engineer - Acme"
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Folder
          <select
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {folders.map((f) => (
              <option key={f} value={f}>
                {f === "" ? "(root)" : f}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => title.trim() && onConfirm(title.trim(), folderPath)}
            disabled={!title.trim() || submitting}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
