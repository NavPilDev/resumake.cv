"use client";

import { useState } from "react";
import BulletCard from "@/app/components/BulletCard";
import ExperienceBuilder from "@/app/components/ExperienceBuilder";
import ResumesBuilder from "@/app/components/ResumesBuilder";
import SidebarNav from "@/app/components/SidebarNav";
import type {
  AnalyzeMode,
  AnalyzeProgressEvent,
  AnalyzeResponse,
  GenerateProgressEvent,
  GenerateResumeResponse,
  GenerateResumeSectionInput,
} from "@/lib/types";

function stageLabel(stage: "scoring" | "gaps" | "overview" | undefined): string {
  switch (stage) {
    case "scoring":
      return "Scoring bullets against the job description…";
    case "gaps":
      return "Identifying skill gaps…";
    case "overview":
      return "Writing analysis overview…";
    default:
      return "Working…";
  }
}

function genStageLabel(stage: "compiling" | "trimming" | "finalizing" | undefined): string {
  switch (stage) {
    case "compiling":
      return "Compiling the resume…";
    case "trimming":
      return "Trimming to fit the page limit…";
    case "finalizing":
      return "Writing the final resume…";
    default:
      return "Working…";
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"tailor" | "experience" | "resumes">("tailor");
  const [jdText, setJdText] = useState("");
  const [maxBullets, setMaxBullets] = useState(4);
  const [mode, setMode] = useState<AnalyzeMode>("keyword");
  const [ollamaModel, setOllamaModel] = useState("llama3.2:3b");
  const [ollamaHost, setOllamaHost] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [progress, setProgress] = useState<Extract<AnalyzeProgressEvent, { type: "progress" }> | null>(
    null
  );
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const [genFilename, setGenFilename] = useState("tailored-resume");
  const [genMaxJobs, setGenMaxJobs] = useState(10);
  const [genMaxProjects, setGenMaxProjects] = useState(4);
  const [genMaxPages, setGenMaxPages] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [needsOverwriteConfirm, setNeedsOverwriteConfirm] = useState(false);
  const [generateResult, setGenerateResult] = useState<GenerateResumeResponse | null>(null);
  const [genProgress, setGenProgress] = useState<
    Extract<GenerateProgressEvent, { type: "progress" }> | null
  >(null);
  const [showGenNotes, setShowGenNotes] = useState(false);

  function getDisplayText(bulletId: string, originalText: string): string {
    return overrides[bulletId] ?? originalText;
  }

  function handleSaveEdit(bulletId: string, newText: string) {
    setOverrides((prev) => ({ ...prev, [bulletId]: newText }));
  }

  async function handleGenerate(confirmOverwrite: boolean) {
    if (!result) return;
    setGenerating(true);
    setGenerateError(null);
    setGenerateResult(null);
    setGenProgress(null);
    setShowGenNotes(false);

    const sections: GenerateResumeSectionInput[] = result.sections.map((section) => ({
      id: section.id,
      kind: section.kind,
      company: section.company,
      role: section.role,
      location: section.location,
      label: section.label,
      dates: section.dates,
      links: section.links,
      bullets: section.shownBullets.map((b) => ({
        id: b.id,
        text: getDisplayText(b.id, b.text),
        score: b.score,
      })),
    }));

    try {
      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: genFilename,
          maxJobs: genMaxJobs,
          maxProjects: genMaxProjects,
          maxPages: genMaxPages,
          sections,
          confirmOverwrite,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          if (!line) continue;

          const event = JSON.parse(line) as GenerateProgressEvent;
          if (event.type === "progress") {
            setGenProgress(event);
          } else if (event.type === "needs_confirmation") {
            setNeedsOverwriteConfirm(true);
            setGenerateError(event.message);
          } else if (event.type === "result") {
            setNeedsOverwriteConfirm(false);
            setGenerateResult(event.data);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
      setGenProgress(null);
    }
  }

  async function handleAnalyze() {
    if (!jdText.trim()) {
      setError("Paste a job description first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(null);

    try {
      if (mode === "ollama") {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jdText,
            maxBullets,
            mode,
            ollamaModel,
            ollamaHost: ollamaHost.trim() || undefined,
          }),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? `Request failed (${res.status})`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex;
          while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (!line) continue;

            const event = JSON.parse(line) as AnalyzeProgressEvent;
            if (event.type === "progress") {
              setProgress(event);
            } else if (event.type === "result") {
              setResult(event.data);
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          }
        }
      } else {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jdText, maxBullets, mode }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? `Request failed (${res.status})`);
        }
        setResult(data as AnalyzeResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setResult(null);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return (
    <div className="flex min-h-full bg-zinc-50 dark:bg-black">
      <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />

      <main
        className={
          activeTab === "resumes"
            ? "flex h-screen w-full flex-col overflow-hidden"
            : "mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12"
        }
      >
        {activeTab !== "resumes" && (
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {activeTab === "tailor" ? "Tailor Resume" : "My Experience"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {activeTab === "tailor" ? (
                <>
                  Paste a job description to rank your bullet bank (
                  <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
                    experience.yaml
                  </code>
                  ) by keyword overlap and surface skill gaps. Nothing is written back to your resume —
                  review and copy in the bullets you want.
                </>
              ) : (
                <>
                  Build or edit your{" "}
                  <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">
                    experience.yaml
                  </code>{" "}
                  bullet bank from uploads, pasted text, or the form below.
                </>
              )}
            </p>
          </header>
        )}

        {activeTab === "experience" && <ExperienceBuilder />}

        {activeTab === "resumes" && <ResumesBuilder />}

        {activeTab === "tailor" && (
          <>
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

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Analysis method
            </legend>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "keyword"}
                  onChange={() => setMode("keyword")}
                />
                Keyword overlap (local, instant)
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === "ollama"}
                  onChange={() => setMode("ollama")}
                />
                Ollama (local LLM)
              </label>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {mode === "keyword"
                ? "Scores bullets by tag/word overlap with the JD — no dependencies, runs instantly."
                : "Sends the JD and your bullet bank to a local Ollama model, section by section, for judgment-based scoring, gap analysis, and an overview. Requires `ollama serve` running with the model already pulled, and can take anywhere from several seconds to a couple minutes depending on your hardware."}
            </p>
          </fieldset>

          {mode === "ollama" && (
            <div className="flex flex-wrap items-end gap-4 rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Model
                <input
                  type="text"
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  placeholder="llama3.2:3b"
                  className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Ollama host (optional)
                <input
                  type="text"
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-56 rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Must already be pulled — check with{" "}
                <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-800">
                  ollama list
                </code>
                .
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="flex items-center gap-2">
                Max bullets per role
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxBullets}
                  onChange={(e) => setMaxBullets(Number(e.target.value) || 1)}
                  className="w-16 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </span>
              <span className="max-w-sm text-xs text-zinc-500 dark:text-zinc-400">
                The most bullets to show for any one job or project. Each section in{" "}
                <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-800">
                  experience.yaml
                </code>{" "}
                (e.g. a specific internship, or a hackathon project) gets ranked on its own and
                trimmed down to this many — so a role with 6 bullets only shows its top 4 (say),
                keeping the recommendation resume-length instead of listing every bullet ever
                written for that role.
              </span>
            </label>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="ml-auto self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {loading ? (mode === "ollama" ? "Asking Ollama…" : "Analyzing…") : "Analyze"}
            </button>
          </div>

          {loading && mode === "ollama" && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {stageLabel(progress?.stage)}
              </p>
              {progress?.stage === "scoring" && progress.total ? (
                <>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                    <div
                      className="h-full bg-zinc-900 transition-all dark:bg-zinc-100"
                      style={{ width: `${((progress.current ?? 0) / progress.total) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    Section {progress.current} of {progress.total}
                    {progress.label ? ` — ${progress.label}` : ""}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  This step covers the whole bullet bank at once, so there is no sub-progress — hang tight.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </section>

        {result && (
          <>
            {result.warnings && result.warnings.length > 0 && (
              <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  Some steps had trouble:
                </p>
                <ul className="mt-1 list-inside list-disc text-sm text-amber-800 dark:text-amber-300">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </section>
            )}

            {result.overview && (
              <section className="rounded-lg border border-violet-200 bg-violet-50 p-5 dark:border-violet-800 dark:bg-violet-950/30">
                <h2 className="mb-1 font-semibold text-violet-900 dark:text-violet-200">
                  Analysis overview
                </h2>
                <p className="text-sm text-violet-950 dark:text-violet-100">{result.overview}</p>
              </section>
            )}

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
                        <BulletCard
                          key={bullet.id}
                          bullet={bullet}
                          displayText={getDisplayText(bullet.id, bullet.text)}
                          jdText={jdText}
                          ollamaModel={ollamaModel}
                          ollamaHost={ollamaHost}
                          onSaveEdit={handleSaveEdit}
                          onAcceptImprovement={handleSaveEdit}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <aside className="sidebar-scroll flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
                <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
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
                          title={g.frequency ? `mentioned ${g.frequency}x in the JD` : "flagged by Ollama"}
                        >
                          {g.keyword}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
                  <h2 className="mb-1 font-semibold text-zinc-900 dark:text-zinc-50">
                    Generate tailored resume
                  </h2>
                  <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Writes a new .tex file (and compiles a PDF) into{" "}
                    <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-800">
                      resumake-media/resumes/.generated/
                    </code>
                    , using master-resume.tex&apos;s template with your top-scoring jobs and projects
                    above (including any edits/improvements you&apos;ve made). It compiles repeatedly
                    and trims the weakest bullets, then whole projects, then whole jobs, until it fits
                    your page limit — education and technical skills are copied as-is from{" "}
                    <code className="rounded bg-zinc-200 px-1 py-0.5 dark:bg-zinc-800">
                      experience.yaml
                    </code>{" "}
                    and aren&apos;t trimmed.
                  </p>

                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                      Filename
                      <input
                        type="text"
                        value={genFilename}
                        onChange={(e) => {
                          setGenFilename(e.target.value);
                          setNeedsOverwriteConfirm(false);
                        }}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                        Max jobs
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={genMaxJobs}
                          onChange={(e) => setGenMaxJobs(Number(e.target.value) || 0)}
                          className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                        Max projects
                        <input
                          type="number"
                          min={0}
                          max={50}
                          value={genMaxProjects}
                          onChange={(e) => setGenMaxProjects(Number(e.target.value) || 0)}
                          className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                        Max pages
                        <input
                          type="number"
                          min={1}
                          max={10}
                          value={genMaxPages}
                          onChange={(e) => setGenMaxPages(Number(e.target.value) || 1)}
                          className="w-20 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                    </div>

                    <button
                      onClick={() => handleGenerate(needsOverwriteConfirm)}
                      disabled={generating}
                      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                    >
                      {generating
                        ? "Compiling…"
                        : needsOverwriteConfirm
                          ? "Overwrite and Generate"
                          : "Generate Resume"}
                    </button>
                  </div>

                  {generating && (
                    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {genStageLabel(genProgress?.stage)}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {genProgress?.label ??
                          "Running latexmk — this can take a few compile passes if trimming is needed."}
                      </p>
                    </div>
                  )}

                  {generateError && (
                    <p className="mt-2 text-sm text-red-600 dark:text-red-400">{generateError}</p>
                  )}

                  {generateResult && (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
                      <p>
                        Wrote <code className="font-mono">{generateResult.texPath}</code> —{" "}
                        {generateResult.pagesUsed ?? "unknown"} page(s)
                        {generateResult.pdfPath && (
                          <>
                            {" "}
                            · PDF at <code className="font-mono">{generateResult.pdfPath}</code>
                          </>
                        )}
                      </p>
                      {(generateResult.trimmedItems.length > 0 ||
                        (generateResult.warnings && generateResult.warnings.length > 0)) && (
                        <>
                          <button
                            onClick={() => setShowGenNotes((v) => !v)}
                            className="mt-2 text-xs font-medium text-emerald-900 underline underline-offset-2 hover:text-emerald-700 dark:text-emerald-200 dark:hover:text-emerald-100"
                          >
                            {showGenNotes ? "Hide generation notes" : "View generation notes"} (
                            {generateResult.trimmedItems.length + (generateResult.warnings?.length ?? 0)})
                          </button>
                          {showGenNotes && (
                            <>
                              {generateResult.trimmedItems.length > 0 && (
                                <ul className="mt-2 list-inside list-disc text-xs text-emerald-800 dark:text-emerald-300">
                                  {generateResult.trimmedItems.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              )}
                              {generateResult.warnings && generateResult.warnings.length > 0 && (
                                <ul className="mt-2 list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
                                  {generateResult.warnings.map((w, i) => (
                                    <li key={i}>{w}</li>
                                  ))}
                                </ul>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </aside>
            </section>
          </>
        )}
          </>
        )}
      </main>
    </div>
  );
}
