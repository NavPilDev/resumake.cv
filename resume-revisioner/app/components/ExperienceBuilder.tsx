"use client";

import { useEffect, useState } from "react";
import CertificationRow from "@/app/components/CertificationRow";
import EducationEntryRow from "@/app/components/EducationEntryRow";
import type { AcceptedFragment } from "@/app/components/ExperienceUploadPanel";
import ExperienceUploadPanel from "@/app/components/ExperienceUploadPanel";
import JobEntryRow from "@/app/components/JobEntryRow";
import ProjectEntryRow from "@/app/components/ProjectEntryRow";
import type {
  Certification,
  EducationEntry,
  ExperienceData,
  GetExperienceResponse,
  JobEntry,
  ProjectEntry,
  SaveExperienceResponse,
  TechnicalSkills,
} from "@/lib/types";

const EMPTY_EXPERIENCE: ExperienceData = {
  meta: { name: "", email: "", linkedin: "", github: "", website: "" },
  jobs: [],
  projects: [],
  education: [],
  certifications: [],
  technical_skills: {},
};

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyJob(): JobEntry {
  return { company: "", role: "", dates: "", date_confidence: "unknown", included: true, bullets: [] };
}

function emptyProject(): ProjectEntry {
  return { name: "", dates: "", date_confidence: "unknown", included: true, bullets: [] };
}

function emptyEducation(): EducationEntry {
  return { institution: "", credential: "", dates: "", date_confidence: "unknown", included: true };
}

function emptyCertification(): Certification {
  return { id: makeId("cert"), name: "", included: true };
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";
const sectionClass =
  "flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950";
const addButtonClass =
  "self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

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

  function handleAccept(fragment: AcceptedFragment) {
    update({
      meta: { ...experience.meta, ...fragment.meta },
      jobs: [...experience.jobs, ...fragment.jobs],
      projects: [...experience.projects, ...fragment.projects],
      education: [...experience.education, ...fragment.education],
      certifications: [...(experience.certifications ?? []), ...fragment.certifications],
      technical_skills: mergeTechnicalSkills(experience.technical_skills, fragment.technical_skills),
    });
  }

  function mergeTechnicalSkills(base: TechnicalSkills, incoming?: TechnicalSkills): TechnicalSkills {
    if (!incoming) return base;
    const merged: TechnicalSkills = { ...base };
    for (const [category, skills] of Object.entries(incoming)) {
      const existing = merged[category] ?? [];
      const existingNames = new Set(existing.map((s) => s.skill.toLowerCase()));
      merged[category] = [...existing, ...skills.filter((s) => !existingNames.has(s.skill.toLowerCase()))];
    }
    return merged;
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

      <ExperienceUploadPanel ollamaModel={ollamaModel} ollamaHost={ollamaHost} onAccept={handleAccept} />

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

      <section className={sectionClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Contact info</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={labelClass}>
            Name
            <input
              className={inputClass}
              value={experience.meta.name}
              onChange={(e) => update({ meta: { ...experience.meta, name: e.target.value } })}
            />
          </label>
          <label className={labelClass}>
            Email
            <input
              className={inputClass}
              value={experience.meta.email}
              onChange={(e) => update({ meta: { ...experience.meta, email: e.target.value } })}
            />
          </label>
          <label className={labelClass}>
            Phone
            <input
              className={inputClass}
              value={experience.meta.phone ?? ""}
              onChange={(e) => update({ meta: { ...experience.meta, phone: e.target.value || undefined } })}
            />
          </label>
          <label className={labelClass}>
            LinkedIn
            <input
              className={inputClass}
              value={experience.meta.linkedin}
              onChange={(e) => update({ meta: { ...experience.meta, linkedin: e.target.value } })}
            />
          </label>
          <label className={labelClass}>
            GitHub
            <input
              className={inputClass}
              value={experience.meta.github}
              onChange={(e) => update({ meta: { ...experience.meta, github: e.target.value } })}
            />
          </label>
          <label className={labelClass}>
            Website
            <input
              className={inputClass}
              value={experience.meta.website}
              onChange={(e) => update({ meta: { ...experience.meta, website: e.target.value } })}
            />
          </label>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Other social/portfolio links (stored for reference only — never fetched)
          </p>
          <div className="flex flex-col gap-2">
            {(experience.meta.social_links ?? []).map((link, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputClass} w-32`}
                  placeholder="Instagram"
                  value={link.platform}
                  onChange={(e) => {
                    const links = [...(experience.meta.social_links ?? [])];
                    links[i] = { ...links[i], platform: e.target.value };
                    update({ meta: { ...experience.meta, social_links: links } });
                  }}
                />
                <input
                  className={`${inputClass} min-w-[12rem] flex-1`}
                  placeholder="https://…"
                  value={link.url}
                  onChange={(e) => {
                    const links = [...(experience.meta.social_links ?? [])];
                    links[i] = { ...links[i], url: e.target.value };
                    update({ meta: { ...experience.meta, social_links: links } });
                  }}
                />
                <button
                  onClick={() => {
                    const links = (experience.meta.social_links ?? []).filter((_, li) => li !== i);
                    update({ meta: { ...experience.meta, social_links: links } });
                  }}
                  className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                update({
                  meta: {
                    ...experience.meta,
                    social_links: [...(experience.meta.social_links ?? []), { platform: "", url: "" }],
                  },
                })
              }
              className={addButtonClass}
            >
              + Add link
            </button>
          </div>
        </div>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Work experience</h2>
        <div className="flex flex-col gap-4">
          {experience.jobs.map((job, i) => (
            <JobEntryRow
              key={i}
              job={job}
              onChange={(next) =>
                update({ jobs: experience.jobs.map((j, ji) => (ji === i ? next : j)) })
              }
              onRemove={() => update({ jobs: experience.jobs.filter((_, ji) => ji !== i) })}
            />
          ))}
        </div>
        <button onClick={() => update({ jobs: [...experience.jobs, emptyJob()] })} className={addButtonClass}>
          + Add job
        </button>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Projects</h2>
        <div className="flex flex-col gap-4">
          {experience.projects.map((project, i) => (
            <ProjectEntryRow
              key={i}
              project={project}
              onChange={(next) =>
                update({ projects: experience.projects.map((p, pi) => (pi === i ? next : p)) })
              }
              onRemove={() => update({ projects: experience.projects.filter((_, pi) => pi !== i) })}
            />
          ))}
        </div>
        <button
          onClick={() => update({ projects: [...experience.projects, emptyProject()] })}
          className={addButtonClass}
        >
          + Add project
        </button>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Education</h2>
        <div className="flex flex-col gap-4">
          {experience.education.map((education, i) => (
            <EducationEntryRow
              key={i}
              education={education}
              onChange={(next) =>
                update({ education: experience.education.map((e, ei) => (ei === i ? next : e)) })
              }
              onRemove={() => update({ education: experience.education.filter((_, ei) => ei !== i) })}
            />
          ))}
        </div>
        <button
          onClick={() => update({ education: [...experience.education, emptyEducation()] })}
          className={addButtonClass}
        >
          + Add education
        </button>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Certifications</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Not yet included in generated resumes — tracked here for your records and future use.
        </p>
        <div className="flex flex-col gap-4">
          {certifications.map((cert, i) => (
            <CertificationRow
              key={cert.id}
              certification={cert}
              onChange={(next) =>
                update({ certifications: certifications.map((c, ci) => (ci === i ? next : c)) })
              }
              onRemove={() => update({ certifications: certifications.filter((_, ci) => ci !== i) })}
            />
          ))}
        </div>
        <button
          onClick={() => update({ certifications: [...certifications, emptyCertification()] })}
          className={addButtonClass}
        >
          + Add certification
        </button>
      </section>

      <section className={sectionClass}>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Technical skills</h2>
        <div className="flex flex-col gap-3">
          {Object.entries(experience.technical_skills).map(([category, skills]) => (
            <div key={category}>
              <p className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">{category}</p>
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s, si) => (
                  <span
                    key={s.skill}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    {s.skill}
                    <button
                      onClick={() =>
                        update({
                          technical_skills: {
                            ...experience.technical_skills,
                            [category]: skills.filter((_, i2) => i2 !== si),
                          },
                        })
                      }
                      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                      aria-label={`Remove ${s.skill}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sticky bottom-4 flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {dirty ? "You have unsaved changes." : "All changes saved."} Saving writes directly to{" "}
            <code className="rounded bg-zinc-200 px-1 py-0.5 text-xs dark:bg-zinc-800">experience.yaml</code>{" "}
            (a timestamped backup is kept alongside it, but hand-written comments in the file won&apos;t
            survive the first save).
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}
        {saveResult && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            Saved to <code className="font-mono">{saveResult.path}</code>
            {saveResult.backupPath && (
              <>
                {" "}
                — previous version backed up to <code className="font-mono">{saveResult.backupPath}</code>
              </>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
