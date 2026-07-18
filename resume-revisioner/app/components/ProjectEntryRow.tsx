"use client";

import BulletEditor from "@/app/components/BulletEditor";
import type { ProjectEntry } from "@/lib/types";

interface ProjectEntryRowProps {
  project: ProjectEntry;
  onChange: (project: ProjectEntry) => void;
  onRemove: () => void;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

export default function ProjectEntryRow({ project, onChange, onRemove }: ProjectEntryRowProps) {
  function set<K extends keyof ProjectEntry>(key: K, value: ProjectEntry[K]) {
    onChange({ ...project, [key]: value });
  }

  const links = project.links ?? [];

  function updateLink(index: number, patch: Partial<{ name: string; href: string }>) {
    set(
      "links",
      links.map((l, i) => (i === index ? { ...l, ...patch } : l))
    );
  }

  function addLink() {
    set("links", [...links, { name: "", href: "" }]);
  }

  function removeLink(index: number) {
    set("links", links.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={project.included !== false}
            onChange={(e) => set("included", e.target.checked)}
          />
          Include in tailored resume
        </label>
        <button
          onClick={onRemove}
          className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Remove project
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Project name
          <input className={inputClass} value={project.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className={labelClass}>
          Dates (display text)
          <input
            className={inputClass}
            value={project.dates}
            onChange={(e) => set("dates", e.target.value)}
            placeholder="Feb 2026 (Hacklahoma 2026)"
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">Links</p>
        <div className="flex flex-col gap-2">
          {links.map((link, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className={`${inputClass} w-32`}
                value={link.name}
                onChange={(e) => updateLink(i, { name: e.target.value })}
                placeholder="Source"
              />
              <input
                className={`${inputClass} min-w-[12rem] flex-1`}
                value={link.href}
                onChange={(e) => updateLink(i, { href: e.target.value })}
                placeholder="https://…"
              />
              <button
                onClick={() => removeLink(i)}
                className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addLink}
            className="self-start rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + Add link
          </button>
        </div>
      </div>

      <BulletEditor
        bullets={project.bullets}
        onChange={(bullets) => set("bullets", bullets)}
        label="Bullets — what you built, the skills/tools used, and any measurable impact"
      />
    </div>
  );
}
