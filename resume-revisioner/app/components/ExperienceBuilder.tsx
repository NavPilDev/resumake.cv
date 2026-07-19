"use client";

import { useEffect, useState } from "react";
import ExperienceUploadPanel from "@/app/components/ExperienceUploadPanel";
import ExperienceSidebarToc, { type TocGroup } from "@/app/components/ExperienceSidebarToc";
import type { ExperienceData, GetExperienceResponse, SaveExperienceResponse } from "@/lib/types";

const EMPTY_EXPERIENCE: ExperienceData = {
  meta: { name: "", email: "", linkedin: "", github: "", website: "" },
  jobs: [],
  projects: [],
  education: [],
  certifications: [],
  technical_skills: {},
};

const sectionClass =
  "flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950";

export default function ExperienceBuilder() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [experience, setExperience] = useState<ExperienceData>(EMPTY_EXPERIENCE);
  const [dirty, setDirty] = useState(false);

  const [ollamaModel, setOllamaModel] = useState("llama3.2:3b");
  const [ollamaHost, setOllamaHost] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveExperienceResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/experience");
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
        if (cancelled) return;
        const payload = data as GetExperienceResponse;
        setExperience(payload.experience);
        setIsNew(payload.isNew);
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load experience.yaml");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function update(patch: Partial<ExperienceData>) {
    setExperience((prev) => ({ ...prev, ...patch }));
    setDirty(true);
    setSaveResult(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveResult(null);
    try {
      const res = await fetch("/api/experience/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ experience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setSaveResult(data as SaveExperienceResponse);
      setDirty(false);
      setIsNew(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save experience.yaml");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading your experience…</p>;
  }

  if (loadError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  }

  const certifications = experience.certifications ?? [];

  const tocGroups: TocGroup[] = [
    {
      id: "exp-section-contact",
      label: "Contact info",
      entries: [],
      needsAttention: !experience.meta.name.trim() || !experience.meta.email.trim(),
    },
    {
      id: "exp-section-jobs",
      label: "Work experience",
      entries: experience.jobs.map((job, i) => ({
        id: `exp-job-${i}`,
        label:
          job.company.trim() || job.role.trim()
            ? `${job.company.trim() || "—"} — ${job.role.trim() || "—"}`
            : "(untitled)",
        needsAttention: !job.company.trim() && !job.role.trim(),
      })),
      needsAttention: experience.jobs.some((j) => !j.company.trim() && !j.role.trim()),
    },
    {
      id: "exp-section-projects",
      label: "Projects",
      entries: experience.projects.map((project, i) => ({
        id: `exp-project-${i}`,
        label: project.name.trim() || "(untitled)",
        needsAttention: !project.name.trim(),
      })),
      needsAttention: experience.projects.some((p) => !p.name.trim()),
    },
    {
      id: "exp-section-education",
      label: "Education",
      entries: experience.education.map((education, i) => ({
        id: `exp-edu-${i}`,
        label:
          education.institution.trim() || education.credential.trim()
            ? education.institution.trim() || education.credential.trim()
            : "(untitled)",
        needsAttention: !education.institution.trim() && !education.credential.trim(),
      })),
      needsAttention: experience.education.some((e) => !e.institution.trim() && !e.credential.trim()),
    },
    {
      id: "exp-section-certifications",
      label: "Certifications",
      entries: certifications.map((cert) => ({
        id: `exp-cert-${cert.id}`,
        label: cert.name.trim() || "(untitled)",
        needsAttention: !cert.name.trim(),
      })),
      needsAttention: certifications.some((c) => !c.name.trim()),
    },
    {
      id: "exp-section-skills",
      label: "Technical skills",
      entries: [],
      needsAttention: false,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {isNew && (
        <section className="rounded-lg border border-violet-200 bg-violet-50 p-4 dark:border-violet-800 dark:bg-violet-950/30">
          <p className="text-sm text-violet-900 dark:text-violet-200">
            No <code className="font-mono">experience.yaml</code> found yet — let&apos;s build one. Upload a
            resume below, or fill in the sections by hand.
          </p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-8">
          <section className={sectionClass}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Extraction settings</h2>
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Model
                <input
                  value={ollamaModel}
                  onChange={(e) => setOllamaModel(e.target.value)}
                  className="w-48 rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
                Ollama host (optional)
                <input
                  value={ollamaHost}
                  onChange={(e) => setOllamaHost(e.target.value)}
                  placeholder="http://localhost:11434"
                  className="w-56 rounded-md border border-zinc-300 bg-white px-2 py-1 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900"
                />
              </label>
            </div>
          </section>

          <ExperienceUploadPanel
            experience={experience}
            onChange={update}
            ollamaModel={ollamaModel}
            ollamaHost={ollamaHost}
          />
        </div>

        <aside className="sidebar-scroll flex flex-col gap-6 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
          <div className={sectionClass}>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">How this page works</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Upload or paste a resume above (usually a one-time step) — a local Ollama model drops the
              entries it finds straight into the sections below, which are your actual saved data. If two
              attachments disagree on something (e.g. two different phone numbers), you&apos;ll get a
              small prompt right there to pick one; everything else appears immediately. Edit anything in
              those sections directly, any time. Nothing touches{" "}
              <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">experience.yaml</code>{" "}
              until you click{" "}
              <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">Save</code> below.
            </p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Note: bullet <span className="font-medium">tags</span> (e.g. &quot;python&quot;,
              &quot;rest-api&quot;) don&apos;t affect bolding or formatting in your generated resume —
              they&apos;re only used on the &quot;Tailor Resume&quot; tab to score how well a bullet
              matches a job description.
            </p>
          </div>

          <ExperienceSidebarToc groups={tocGroups} />

          <div className={sectionClass}>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {dirty ? "You have unsaved changes." : "All changes saved."} Saving writes directly to{" "}
              <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">experience.yaml</code>{" "}
              (mid-document comments won&apos;t survive a save — only the leading header comment block is
              preserved).
            </p>
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
            {saveResult && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Saved to <code className="font-mono">{saveResult.path}</code>
              </p>
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
