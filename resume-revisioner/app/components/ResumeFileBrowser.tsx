"use client";

import { useState } from "react";
import { Download, FilePlus2, FolderPlus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Folder, File, Tree } from "@/components/ui/file-viewer";
import type { ResumeTreeNode } from "@/lib/resumeFiles";

interface ResumeFileBrowserProps {
  tree: ResumeTreeNode[];
  selectedId: string | null;
  onOpenResume: (id: string) => void;
  onCreateFolder: (parentPath: string, name: string) => void;
  onCreateResume: (parentPath: string) => void;
}

/** Left-rail file browser for the "My Resumes" tab: composes the exported
 * Tree/Folder/File primitives from components/ui/file-viewer.tsx (which
 * were built for a static, fully-loaded code-file tree) with our own
 * folder/resume data and create/download actions, since the ported
 * component has no CRUD affordances of its own. */
export function ResumeFileBrowser({
  tree,
  selectedId,
  onOpenResume,
  onCreateFolder,
  onCreateResume,
}: ResumeFileBrowserProps) {
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [pendingName, setPendingName] = useState("");

  function submitPendingFolder() {
    const name = pendingName.trim();
    if (name) onCreateFolder("", name);
    setCreatingFolder(false);
    setPendingName("");
  }

  function renderNodes(nodes: ResumeTreeNode[]) {
    return nodes.map((node) =>
      node.type === "folder" ? (
        <Folder key={node.path} element={node.name} value={node.path}>
          {renderNodes(node.children)}
        </Folder>
      ) : (
        <div key={node.id} className="group flex items-center gap-1">
          <File
            value={node.id}
            isSelect={selectedId === node.id}
            fileIcon={<FileText className="h-4 w-4" />}
            onClick={() => onOpenResume(node.id)}
            className="flex-1"
          >
            {node.title}
          </File>
          <a
            href={`/api/resumes/${node.id}/pdf?download=1`}
            title="Download PDF"
            onClick={(e) => e.stopPropagation()}
            className="hidden rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground group-hover:block"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      )
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <span className="text-sm font-medium">Saved Resumes</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="New folder"
            onClick={() => {
              setCreatingFolder(true);
              setPendingName("");
            }}
          >
            <FolderPlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="New resume"
            onClick={() => onCreateResume("")}
          >
            <FilePlus2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          {creatingFolder && (
            <input
              autoFocus
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitPendingFolder();
                if (e.key === "Escape") {
                  setCreatingFolder(false);
                  setPendingName("");
                }
              }}
              onBlur={submitPendingFolder}
              placeholder="Folder name"
              className="mx-2 mb-2 block rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          {tree.length === 0 && !creatingFolder && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No saved resumes yet.
            </p>
          )}
          <Tree indicator>{renderNodes(tree)}</Tree>
        </div>
      </ScrollArea>
    </div>
  );
}
