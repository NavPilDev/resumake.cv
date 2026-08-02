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

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400",
};

const GROUP_ICONS: Record<string, React.ReactNode> = {
  "exp-section-contact": (
    <svg {...iconProps}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.6-1.6 1.8-2.5 3-2.5s2.4.9 3 2.5" />
      <path d="M14 10h4M14 13h4" />
    </svg>
  ),
  "exp-section-jobs": (
    <svg {...iconProps}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
      <path d="M10 12v1.5h4V12" />
    </svg>
  ),
  "exp-section-projects": (
    <svg {...iconProps}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  ),
  "exp-section-education": (
    <svg {...iconProps}>
      <path d="M2 9.5 12 5l10 4.5-10 4.5-10-4.5Z" />
      <path d="M6 11.5V16c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5" />
      <path d="M21 9.5v5" />
    </svg>
  ),
  "exp-section-certifications": (
    <svg {...iconProps}>
      <circle cx="12" cy="9" r="5.5" />
      <path d="M9 13.5 8 21l4-2 4 2-1-7.5" />
    </svg>
  ),
  "exp-section-skills": (
    <svg {...iconProps}>
      <path d="M14.5 4.5a3.5 3.5 0 0 0-4.6 4.6L4 15v3h3l5.9-5.9a3.5 3.5 0 0 0 4.6-4.6l-2.6 2.6-2-2 2.6-2.6Z" />
    </svg>
  ),
};

function GroupIcon({ groupId }: { groupId: string }) {
  return GROUP_ICONS[groupId] ?? null;
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
              <GroupIcon groupId={group.id} />
              {group.needsAttention && <RedDot />}
              <a href={`#${group.id}`} onClick={(e) => scrollToId(e, group.id)} className="mr-auto hover:underline">
                {group.label}
              </a>
            <div className="flex gap-2 select-none">
                <CountBadge count={group.entries.length} />
                <ChevronIcon />
              </div>
            </summary>
            <ul className="relative mt-1.5 flex flex-col gap-1 pl-4">
              {group.entries.length > 0 && (
                <div className="absolute bottom-1 left-1.5 top-0 w-px bg-zinc-200 dark:bg-zinc-800" />
              )}
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
