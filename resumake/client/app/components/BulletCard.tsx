"use client";

import { useState } from "react";
import type { ScoredBullet } from "@/lib/types";

const LOW_SCORE_THRESHOLD = 50;

interface BulletCardProps {
  bullet: ScoredBullet;
  displayText: string;
  jdText: string;
  ollamaModel: string;
  ollamaHost: string;
  onSaveEdit: (bulletId: string, newText: string) => void;
  onAcceptImprovement: (bulletId: string, newText: string) => void;
}

export default function BulletCard({
  bullet,
  displayText,
  jdText,
  ollamaModel,
  ollamaHost,
  onSaveEdit,
  onAcceptImprovement,
}: BulletCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(displayText);
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [improveDraft, setImproveDraft] = useState<string | null>(null);

  function startEdit() {
    setEditDraft(displayText);
    setIsEditing(true);
  }

  function saveEdit() {
    onSaveEdit(bullet.id, editDraft.trim() || displayText);
    setIsEditing(false);
  }

  async function handleImprove() {
    setImproving(true);
    setImproveError(null);
    try {
      const res = await fetch("/api/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bulletText: displayText,
          tags: bullet.tags,
          jdText,
          ollamaModel,
          ollamaHost: ollamaHost.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setImproveDraft(data.improvedText as string);
    } catch (err) {
      setImproveError(err instanceof Error ? err.message : "Improve request failed.");
    } finally {
      setImproving(false);
    }
  }

  function acceptImprovement() {
    if (!improveDraft) return;
    onAcceptImprovement(bullet.id, improveDraft);
    setImproveDraft(null);
  }

  return (
    <li className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-medium ${
            bullet.score >= LOW_SCORE_THRESHOLD
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              : bullet.score > 0
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}
        >
          score {bullet.score}
        </span>
        {bullet.has_metric && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            has metric
          </span>
        )}
        {!isEditing && (
          <button
            onClick={startEdit}
            className="ml-auto text-xs text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            autoFocus
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            className="h-20 w-full resize-y rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              className="rounded bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Save
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-zinc-800 dark:text-zinc-200">{displayText}</p>
      )}

      {bullet.reason && (
        <p className="mt-1.5 text-xs italic text-zinc-500 dark:text-zinc-400">{bullet.reason}</p>
      )}

      {bullet.matchedKeywords && bullet.matchedKeywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {bullet.matchedKeywords.map((kw) => (
            <span
              key={kw}
              className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {bullet.score < LOW_SCORE_THRESHOLD && !improveDraft && !isEditing && (
        <button
          onClick={handleImprove}
          disabled={improving}
          className="mt-2 rounded border border-violet-300 px-2 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-50 dark:border-violet-700 dark:text-violet-300 dark:hover:bg-violet-950"
        >
          {improving ? "Asking Ollama…" : "Improve with Ollama"}
        </button>
      )}

      {improveError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">{improveError}</p>}

      {improveDraft && (
        <div className="mt-2 flex flex-col gap-2 rounded-md border border-violet-200 bg-violet-50 p-2 dark:border-violet-800 dark:bg-violet-950/30">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Before
            </p>
            <p className="text-sm text-zinc-600 line-through dark:text-zinc-400">{displayText}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
              After
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-200">{improveDraft}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={acceptImprovement}
              className="rounded bg-violet-600 px-2 py-1 text-xs font-medium text-white hover:bg-violet-500"
            >
              Use this version
            </button>
            <button
              onClick={() => setImproveDraft(null)}
              className="rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
