"use client";

import { useState } from "react";
import type { AtsScoreResult } from "@/lib/types";

/** Mirrors resumake-agent/ats_scoring/classification.py's tier thresholds,
 * used here only for badge coloring — the actual scoring is server-side. */
function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-amber-500";
  if (score >= 40) return "bg-orange-500";
  return "bg-red-500";
}

function Dimension({ label, score }: { label: string; score: number }) {
  const rounded = Math.round(score);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className={`font-medium ${scoreColor(rounded)}`}>{rounded}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={`h-full ${scoreBarColor(rounded)} transition-all`}
          style={{ width: `${Math.max(0, Math.min(100, rounded))}%` }}
        />
      </div>
    </div>
  );
}

function PlatformCard({ result }: { result: AtsScoreResult }) {
  const [expanded, setExpanded] = useState(false);
  const { breakdown } = result;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{result.system}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{result.vendor}</p>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-semibold leading-none ${scoreColor(result.overallScore)}`}>
            {result.overallScore}
          </p>
          <span
            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
              result.passesFilter
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
            }`}
          >
            {result.passesFilter ? "Pass" : "Fail"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Dimension label="Formatting" score={breakdown.formatting.score} />
        <Dimension label="Keywords" score={breakdown.keywordMatch.score} />
        <Dimension label="Sections" score={breakdown.sections.score} />
        <Dimension label="Experience" score={breakdown.experience.score} />
        <Dimension label="Education" score={breakdown.education.score} />
      </div>

      {result.suggestions.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
          >
            {expanded ? "Hide suggestions" : "Show suggestions"} ({result.suggestions.length})
          </button>
          {expanded && (
            <ul className="mt-2 list-inside list-disc text-xs text-zinc-600 dark:text-zinc-400">
              {result.suggestions.map((s, i) => (
                <li key={i}>{typeof s === "string" ? s : s.summary}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default function AtsScorer() {
  const [jdText, setJdText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<AtsScoreResult[] | null>(null);

  async function handleScan() {
    if (!jdText.trim()) {
      setError("Paste a job description first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch("/api/ats-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setResults(data as AtsScoreResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const averageScore = results && results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.overallScore, 0) / results.length)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="ats-jd">
          Job description
        </label>
        <textarea
          id="ats-jd"
          className="h-48 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="Paste the raw job description text here..."
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Scores your saved{" "}
          <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-800">experience.yaml</code> against
          six real ATS platforms&apos; parsing/filtering behavior — deterministic, no LLM involved. Nothing
          is written back to your resume.
        </p>
        <button
          onClick={handleScan}
          disabled={loading}
          className="ml-auto self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? "Scoring…" : "Run ATS Scan"}
        </button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>

      {results && (
        <>
          {averageScore !== null && (
            <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Average across all platforms</p>
              <p className={`text-3xl font-semibold ${scoreColor(averageScore)}`}>{averageScore}</p>
            </section>
          )}
          <section className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {results.map((result) => (
              <PlatformCard key={result.system} result={result} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}
