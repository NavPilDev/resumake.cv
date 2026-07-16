"use client";

import { useState } from "react";
import type { AnalyzeResponse } from "@/lib/types";

export default function Home() {
  const [jdText, setJdText] = useState("");
  const [maxBullets, setMaxBullets] = useState(4);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);

  async function handleAnalyze() {
    if (!jdText.trim()) {
      setError("Paste a job description first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText, maxBullets }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }
      setResult(data as AnalyzeResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Resume Revisioner
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Paste a job description to rank your bullet bank (
            <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
              experience.yaml
            </code>
            ) by keyword overlap and surface skill gaps. Nothing is written back to your resume —
            review and copy in the bullets you want.
          </p>
        </header>

        <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200" htmlFor="jd">
            Job description
          </label>
          <textarea
            id="jd"
            className="h-56 w-full resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="Paste the raw job description text here..."
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              Max bullets per role
              <input
                type="number"
                min={1}
                max={10}
                value={maxBullets}
                onChange={(e) => setMaxBullets(Number(e.target.value) || 1)}
                className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="ml-auto rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>

        {result && (
          <section className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-6">
              {result.sections.map((section) => (
                <div
                  key={section.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="mb-3 flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {section.label}
                    </h2>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                      {section.dates}
                    </span>
                  </div>
                  <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Showing top {section.shownBullets.length} of {section.totalBullets} bullets
                  </p>
                  <ul className="flex flex-col gap-3">
                    {section.shownBullets.map((bullet) => (
                      <li
                        key={bullet.id}
                        className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              bullet.score > 0
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
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
                        </div>
                        <p className="text-sm text-zinc-800 dark:text-zinc-200">{bullet.text}</p>
                        {bullet.matchedKeywords.length > 0 && (
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
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-50">Skill gaps</h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                JD keywords with no match anywhere in your bullet bank. Consider addressing these
                in your cover letter or interview prep.
              </p>
              {result.gaps.length === 0 ? (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No gaps found — the JD is well covered by your bullet bank.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {result.gaps.map((g) => (
                    <li
                      key={g.keyword}
                      className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800 dark:bg-red-900/40 dark:text-red-300"
                      title={`mentioned ${g.frequency}x in the JD`}
                    >
                      {g.keyword}
                    </li>
                  ))}
                </ul>
              )}
            </aside>
          </section>
        )}
      </main>
    </div>
  );
}
