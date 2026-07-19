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

function CountBadge({ count }: { count: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">
      {count}
    </span>
  );
}

/** Points right by default; rotated 90° to point down via the parent
 * `<details>`'s native `open` state (Tailwind's `group-open` variant) —
 * no extra state needed to track collapsed/expanded. */
function ChevronIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-150 group-open:rotate-90 dark:text-zinc-400"
    >
      <path d="M7 5l6 5-6 5" />
    </svg>
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
          <details key={group.id} className="group rounded-md border border-zinc-100 p-2 text-sm dark:border-zinc-800">
            <summary className="flex list-none justify-between cursor-pointer items-center gap-2 font-medium text-zinc-800 [&::-webkit-details-marker]:hidden dark:text-zinc-200">
              
              {group.needsAttention && <RedDot />}
              <a href={`#${group.id}`} onClick={(e) => scrollToId(e, group.id)} className="hover:underline">
                {group.label}
              </a>
            <div className="flex gap-2 select-none">
                <CountBadge count={group.entries.length} />
                <ChevronIcon />
              </div>
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
