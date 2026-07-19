"use client";

export interface TocEntry {
  id: string;
  label: string;
  needsAttention: boolean;
}

export interface TocGroup {
  id: string;
  label: string;
  entries: TocEntry[];
  needsAttention: boolean;
}

interface ExperienceSidebarTocProps {
  groups: TocGroup[];
}

function RedDot() {
  return (
    <span
      aria-label="Needs attention"
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
    />
  );
}

function scrollToId(e: React.MouseEvent, id: string) {
  e.preventDefault();
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Collapsible jump-to-section list for the "My Experience" page, reflecting
 * the live (saved-state) `experience` data — not the upload panel's
 * transient pre-accept staging area. A red dot flags an entry (or, bubbled
 * up, a whole group) whose core identifying field is still blank. */
export default function ExperienceSidebarToc({ groups }: ExperienceSidebarTocProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Table of Contents</h2>
      <div className="flex flex-col gap-1.5">
        {groups.map((group) => (
          <details key={group.id} className="rounded-md border border-zinc-100 p-2 text-sm dark:border-zinc-800">
            <summary className="flex cursor-pointer items-center gap-2 font-medium text-zinc-800 dark:text-zinc-200">
              {group.needsAttention && <RedDot />}
              <a href={`#${group.id}`} onClick={(e) => scrollToId(e, group.id)} className="hover:underline">
                {group.label}
              </a>
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1 pl-4">
              {group.entries.length === 0 && <li className="text-xs text-zinc-500 dark:text-zinc-400">—</li>}
              {group.entries.map((entry) => (
                <li key={entry.id} className="flex items-center gap-1.5">
                  {entry.needsAttention && <RedDot />}
                  <a
                    href={`#${entry.id}`}
                    onClick={(e) => scrollToId(e, entry.id)}
                    className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    {entry.label}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </div>
  );
}
