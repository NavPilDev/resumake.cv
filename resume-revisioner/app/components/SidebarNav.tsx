"use client";

import { useEffect, useState } from "react";

export type NavTab = "tailor" | "experience" | "resumes";

interface NavItem {
  id: NavTab;
  label: string;
  description: string;
  icon: React.ReactNode;
}

function TailorIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M11 4H4a1 1 0 0 0-1 1v15a1 1 0 0 0 1 1h15a1 1 0 0 0 1-1v-7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExperienceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="7" width="18" height="13" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12h18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResumesIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v5h5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13h8M8 17h8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  {
    id: "tailor",
    label: "Tailor Resume",
    description:
      "Paste a job description to rank your bullet bank by keyword overlap and surface skill gaps.",
    icon: <TailorIcon />,
  },
  {
    id: "experience",
    label: "My Experience",
    description: "Build or edit your experience.yaml bullet bank from uploads, pasted text, or the form.",
    icon: <ExperienceIcon />,
  },
  {
    id: "resumes",
    label: "My Resumes",
    description: "Create and edit individual tailored resumes, organized into folders under saved/.",
    icon: <ResumesIcon />,
  },
];

const STORAGE_KEY = "resumeRevisioner.sidebarCollapsed";

export default function SidebarNav({
  activeTab,
  onTabChange,
}: {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <div
        className={`flex items-center border-b border-zinc-200 py-4 dark:border-zinc-800 ${
          collapsed ? "justify-center px-0" : "gap-2 px-4"
        }`}
      >
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Resume Revisioner
          </span>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ${
            collapsed ? "" : "ml-auto"
          }`}
        >
          <MenuIcon />
        </button>
      </div>

      <nav className="flex flex-col gap-1 p-2">
        {NAV_ITEMS.map((item) => (
          <div key={item.id} className="group relative">
            <button
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={activeTab === item.id ? "page" : undefined}
              className={`flex w-full items-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-0" : "gap-3"
              } ${
                activeTab === item.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>

            <div className="pointer-events-none absolute left-full top-1/2 z-20 ml-2 hidden w-56 -translate-y-1/2 rounded-md border border-zinc-200 bg-white p-2.5 text-xs shadow-lg group-hover:block dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-0.5 font-semibold text-zinc-900 dark:text-zinc-50">{item.label}</p>
              <p className="text-zinc-600 dark:text-zinc-300">{item.description}</p>
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
