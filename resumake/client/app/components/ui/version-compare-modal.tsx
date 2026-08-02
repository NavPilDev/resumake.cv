"use client";

import { useEffect } from "react";
import type { JobEntry, ProjectEntry } from "@/lib/types";

interface Sourced<T> {
  entry: T;
  source: string;
}

function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}

const fieldLabelClass = "text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400";
const fieldValueClass = "text-sm text-zinc-900 dark:text-zinc-100";

function CompareModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEscapeToClose(onClose);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-4 overflow-y-auto rounded-lg bg-white p-5 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Multiple attachments described this — compare and pick the version to keep.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function BulletsPreview({ bullets }: { bullets: { id: string; text: string; tags: string[] }[] }) {
  if (bullets.length === 0) {
    return <p className="text-xs text-zinc-500 dark:text-zinc-400">No bullets.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {bullets.map((b) => (
        <li key={b.id} className="rounded-md border border-zinc-100 p-2 text-sm text-zinc-800 dark:border-zinc-800 dark:text-zinc-200">
          {b.text || <span className="italic text-zinc-400 dark:text-zinc-500">(empty)</span>}
          {b.tags.length > 0 && (
            <p className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{b.tags.join(", ")}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

interface JobVersionCompareModalProps {
  title: string;
  versions: Sourced<JobEntry>[];
  onSelect: (version: Sourced<JobEntry>) => void;
  onClose: () => void;
}

export function JobVersionCompareModal({ title, versions, onSelect, onClose }: JobVersionCompareModalProps) {
  return (
    <CompareModalShell title={title} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {versions.map((version, i) => {
          const job = version.entry;
          return (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <p className="text-xs font-medium text-violet-700 dark:text-violet-400">From: {version.source}</p>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className={fieldLabelClass}>Location</p>
                  <p className={fieldValueClass}>{job.location || "—"}</p>
                </div>
                <div>
                  <p className={fieldLabelClass}>Work mode</p>
                  <p className={fieldValueClass}>{job.work_mode || "—"}</p>
                </div>
                <div>
                  <p className={fieldLabelClass}>Dates</p>
                  <p className={fieldValueClass}>{job.dates || "—"}</p>
                </div>
                <div>
                  <p className={fieldLabelClass}>Hours/week</p>
                  <p className={fieldValueClass}>{job.hours_per_week ?? "—"}</p>
                </div>
                <div>
                  <p className={fieldLabelClass}>Start date</p>
                  <p className={fieldValueClass}>{job.start_date || "—"}</p>
                </div>
                <div>
                  <p className={fieldLabelClass}>End date</p>
                  <p className={fieldValueClass}>{job.end_date || "—"}</p>
                </div>
                {(job.pay_plan || job.pay_series || job.pay_grade) && (
                  <div className="col-span-2">
                    <p className={fieldLabelClass}>Pay plan / series / grade</p>
                    <p className={fieldValueClass}>
                      {[job.pay_plan, job.pay_series, job.pay_grade].filter(Boolean).join(" / ")}
                    </p>
                  </div>
                )}
              </div>

              <BulletsPreview bullets={job.bullets} />

              <button
                onClick={() => onSelect(version)}
                className="self-start rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500"
              >
                Use this version
              </button>
            </div>
          );
        })}
      </div>
    </CompareModalShell>
  );
}

interface ProjectVersionCompareModalProps {
  title: string;
  versions: Sourced<ProjectEntry>[];
  onSelect: (version: Sourced<ProjectEntry>) => void;
  onClose: () => void;
}

export function ProjectVersionCompareModal({ title, versions, onSelect, onClose }: ProjectVersionCompareModalProps) {
  return (
    <CompareModalShell title={title} onClose={onClose}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {versions.map((version, i) => {
          const project = version.entry;
          return (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <p className="text-xs font-medium text-violet-700 dark:text-violet-400">From: {version.source}</p>

              <div>
                <p className={fieldLabelClass}>Dates</p>
                <p className={fieldValueClass}>{project.dates || "—"}</p>
              </div>

              {(project.links ?? []).length > 0 && (
                <div>
                  <p className={fieldLabelClass}>Links</p>
                  <p className={fieldValueClass}>
                    {(project.links ?? []).map((l) => l.name || l.href).join(", ")}
                  </p>
                </div>
              )}

              <BulletsPreview bullets={project.bullets} />

              <button
                onClick={() => onSelect(version)}
                className="self-start rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500"
              >
                Use this version
              </button>
            </div>
          );
        })}
      </div>
    </CompareModalShell>
  );
}
