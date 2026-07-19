"use client";

import type { Bullet } from "@/lib/types";

interface BulletEditorProps {
  bullets: Bullet[];
  onChange: (bullets: Bullet[]) => void;
  label: string;
}

function makeId(): string {
  return `bullet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Lightweight bullet add/edit/remove for authoring context. Unlike
 * BulletCard (used on the "Tailor Resume" tab), there's no JD-relevance
 * score, reason, or matched-keywords to show here — this is plain data
 * entry, not a review of scored content. Whether a bullet "has a metric" is
 * auto-detected from its text at save time (see lib/saveExperience.ts)
 * rather than hand-toggled here. */
export default function BulletEditor({ bullets, onChange, label }: BulletEditorProps) {
  function updateBullet(index: number, patch: Partial<Bullet>) {
    onChange(bullets.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  function removeBullet(index: number) {
    onChange(bullets.filter((_, i) => i !== index));
  }

  function addBullet() {
    onChange([...bullets, { id: makeId(), text: "", tags: [], has_metric: false }]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
        <button
          onClick={addBullet}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          + Add bullet
        </button>
      </div>
      {bullets.map((bullet, i) => (
        <div
          key={bullet.id}
          className="flex flex-col gap-1.5 rounded-md border border-zinc-100 p-2 dark:border-zinc-800"
        >
          <textarea
            value={bullet.text}
            onChange={(e) => updateBullet(i, { text: e.target.value })}
            placeholder="Describe what you did, the tools/skills used, and any measurable impact…"
            className="h-16 w-full resize-y rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={bullet.tags.join(", ")}
              onChange={(e) =>
                updateBullet(i, {
                  tags: e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder="tags: python, ros2, backend"
              className="min-w-[10rem] flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              onClick={() => removeBullet(i)}
              className="ml-auto text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
