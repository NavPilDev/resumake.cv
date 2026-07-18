"use client";

import { useState } from "react";
import CertificationRow from "@/app/components/CertificationRow";
import EducationEntryRow from "@/app/components/EducationEntryRow";
import JobEntryRow from "@/app/components/JobEntryRow";
import ProjectEntryRow from "@/app/components/ProjectEntryRow";
import type {
  Bullet,
  Certification,
  EducationEntry,
  ExtractExperienceResponse,
  JobEntry,
  Meta,
  ProjectEntry,
  ProjectLink,
  TechnicalSkills,
} from "@/lib/types";

export interface AcceptedFragment {
  meta?: Partial<Meta>;
  jobs: JobEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: Certification[];
  technical_skills?: TechnicalSkills;
}

interface ExperienceUploadPanelProps {
  ollamaModel: string;
  ollamaHost: string;
  onAccept: (fragment: AcceptedFragment) => void;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The model doesn't always return array-typed fields as arrays (e.g. a
 * single string instead of a one-item list) — coerce rather than let a
 * downstream `.map()` throw. */
function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeLinks(value: unknown): ProjectLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is { name?: unknown; href?: unknown } => !!l && typeof l === "object")
    .map((l) => ({ name: typeof l.name === "string" ? l.name : "", href: typeof l.href === "string" ? l.href : "" }))
    .filter((l) => l.name || l.href);
}

function normalizeTechnicalSkills(value: unknown): TechnicalSkills {
  if (!value || typeof value !== "object") return {};
  const result: TechnicalSkills = {};
  for (const [category, skills] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(skills)) continue;
    const normalized = skills
      .filter((s): s is { skill?: unknown; source?: unknown } => !!s && typeof s === "object")
      .map((s) => ({ skill: typeof s.skill === "string" ? s.skill : "", source: typeof s.source === "string" ? s.source : "resume" }))
      .filter((s) => s.skill);
    if (normalized.length > 0) result[category] = normalized;
  }
  return result;
}

function normalizeBullets(bullets: Partial<Bullet>[] | undefined): Bullet[] {
  if (!Array.isArray(bullets)) return [];
  return bullets.map((b) => ({
    id: makeId("bullet"),
    text: typeof b.text === "string" ? b.text : "",
    tags: normalizeStringArray(b.tags),
    has_metric: b.has_metric === true,
  }));
}

/** Small local models don't always honor a "number" instruction in the
 * extraction prompt (e.g. returning "40" instead of 40) — coerce rather than
 * let a stray string flow into a numeric field. */
function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Drops blank fields and placeholder {platform:"",url:""} social-link
 * entries the model sometimes echoes back from the prompt's example shape
 * even when nothing was actually found in the source text. */
function normalizeMeta(meta: Partial<Meta> | undefined): Partial<Meta> {
  if (!meta) return {};
  const cleaned: Partial<Meta> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (key === "social_links") continue;
    if (typeof value === "string" && value.trim()) {
      (cleaned as Record<string, string>)[key] = value.trim();
    }
  }
  const socialLinks = (meta.social_links ?? []).filter((l) => l.platform?.trim() && l.url?.trim());
  if (socialLinks.length > 0) cleaned.social_links = socialLinks;
  return cleaned;
}

interface PendingReview {
  meta: Partial<Meta>;
  jobs: JobEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: Certification[];
  technical_skills: TechnicalSkills;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export default function ExperienceUploadPanel({ ollamaModel, ollamaHost, onAccept }: ExperienceUploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingReview | null>(null);

  async function handleExtract() {
    if (!file && !pastedText.trim()) {
      setExtractError("Choose a file or paste some text first.");
      return;
    }
    setExtracting(true);
    setExtractError(null);
    setExtractWarnings([]);

    try {
      const form = new FormData();
      if (file) {
        form.set("file", file);
      } else {
        form.set("text", pastedText.trim());
      }
      form.set("ollamaModel", ollamaModel);
      if (ollamaHost.trim()) form.set("ollamaHost", ollamaHost.trim());

      const res = await fetch("/api/experience/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);

      const payload = data as ExtractExperienceResponse;
      const fragment = payload.fragment ?? {};
      const fragmentJobs = Array.isArray(fragment.jobs) ? fragment.jobs : [];
      const fragmentProjects = Array.isArray(fragment.projects) ? fragment.projects : [];
      const fragmentEducation = Array.isArray(fragment.education) ? fragment.education : [];
      const fragmentCertifications = Array.isArray(fragment.certifications) ? fragment.certifications : [];
      setExtractWarnings(payload.warnings ?? []);
      setPending({
        meta: normalizeMeta(fragment.meta),
        jobs: fragmentJobs.map((j) => ({
          company: j.company ?? "",
          role: j.role ?? "",
          dates: j.dates ?? "",
          start_date: j.start_date,
          end_date: j.end_date,
          date_confidence: j.date_confidence ?? "unknown",
          location: j.location,
          work_mode: j.work_mode,
          hours_per_week: normalizeNumber(j.hours_per_week),
          pay_plan: j.pay_plan,
          pay_series: j.pay_series,
          pay_grade: j.pay_grade,
          included: true,
          bullets: normalizeBullets(j.bullets),
        })),
        projects: fragmentProjects.map((p) => ({
          name: p.name ?? "",
          dates: p.dates ?? "",
          date_confidence: p.date_confidence ?? "unknown",
          links: normalizeLinks(p.links),
          included: true,
          bullets: normalizeBullets(p.bullets),
        })),
        education: fragmentEducation.map((e) => ({
          institution: e.institution ?? "",
          credential: e.credential ?? "",
          degree_level: e.degree_level,
          major: e.major,
          dates: e.dates ?? "",
          graduation_date: e.graduation_date,
          gpa: e.gpa,
          date_confidence: e.date_confidence ?? "unknown",
          location: e.location,
          details: normalizeStringArray(e.details),
          links: normalizeLinks(e.links),
          included: true,
        })),
        certifications: fragmentCertifications.map((c) => ({
          id: makeId("cert"),
          name: c.name ?? "",
          issuer: c.issuer,
          date: c.date,
          expiration_date: c.expiration_date,
          credential_id: c.credential_id,
          links: normalizeLinks(c.links),
          included: true,
        })),
        technical_skills: normalizeTechnicalSkills(fragment.technical_skills),
      });
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  function updatePending<K extends keyof PendingReview>(key: K, value: PendingReview[K]) {
    setPending((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function acceptAll() {
    if (!pending) return;
    onAccept(pending);
    setPending(null);
    setFile(null);
    setPastedText("");
  }

  function discardAll() {
    setPending(null);
  }

  const hasPendingContent =
    !!pending &&
    (pending.jobs.length > 0 ||
      pending.projects.length > 0 ||
      pending.education.length > 0 ||
      pending.certifications.length > 0 ||
      Object.keys(pending.meta).length > 0 ||
      Object.keys(pending.technical_skills).length > 0);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Import from a file or pasted text</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Upload a resume PDF, a Markdown/JSON export, or paste text describing your experience. A local
        Ollama model extracts structured entries for you to review — nothing is added until you accept it
        below.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
          File (PDF, Markdown, or JSON)
          <input
            type="file"
            accept=".pdf,.md,.txt,.json"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              if (e.target.files?.[0]) setPastedText("");
            }}
            className="text-sm"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Or paste text
        <textarea
          value={pastedText}
          onChange={(e) => {
            setPastedText(e.target.value);
            if (e.target.value) setFile(null);
          }}
          placeholder="Paste a resume, a bio, or a description of a role you worked…"
          className="h-28 w-full resize-y rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      <button
        onClick={handleExtract}
        disabled={extracting}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {extracting ? "Asking Ollama…" : "Extract"}
      </button>

      {extractError && <p className="text-sm text-red-600 dark:text-red-400">{extractError}</p>}
      {extractWarnings.length > 0 && (
        <ul className="list-inside list-disc text-xs text-amber-700 dark:text-amber-400">
          {extractWarnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}

      {pending && (
        <div className="mt-2 flex flex-col gap-4 rounded-md border border-violet-200 bg-violet-50 p-3 dark:border-violet-800 dark:bg-violet-950/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              Review before adding
            </p>
            <div className="flex gap-2">
              <button
                onClick={acceptAll}
                disabled={!hasPendingContent}
                className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
              >
                Add all accepted items
              </button>
              <button
                onClick={discardAll}
                className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Discard all
              </button>
            </div>
          </div>

          {!hasPendingContent && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Nothing was extracted from that source — try a different file or add more detail to the
              pasted text.
            </p>
          )}

          {Object.keys(pending.meta).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-violet-800 dark:text-violet-300">Contact info found</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(["name", "email", "phone", "linkedin", "github", "website"] as (keyof Meta)[])
                  .filter((key) => pending.meta[key] !== undefined)
                  .map((key) => (
                    <label key={key} className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {key}
                      <input
                        className={inputClass}
                        value={(pending.meta[key] as string) ?? ""}
                        onChange={(e) => updatePending("meta", { ...pending.meta, [key]: e.target.value })}
                      />
                    </label>
                  ))}
              </div>
            </div>
          )}

          {pending.jobs.map((job, i) => (
            <JobEntryRow
              key={i}
              job={job}
              onChange={(next) =>
                updatePending(
                  "jobs",
                  pending.jobs.map((j, ji) => (ji === i ? next : j))
                )
              }
              onRemove={() =>
                updatePending(
                  "jobs",
                  pending.jobs.filter((_, ji) => ji !== i)
                )
              }
            />
          ))}

          {pending.projects.map((project, i) => (
            <ProjectEntryRow
              key={i}
              project={project}
              onChange={(next) =>
                updatePending(
                  "projects",
                  pending.projects.map((p, pi) => (pi === i ? next : p))
                )
              }
              onRemove={() =>
                updatePending(
                  "projects",
                  pending.projects.filter((_, pi) => pi !== i)
                )
              }
            />
          ))}

          {pending.education.map((education, i) => (
            <EducationEntryRow
              key={i}
              education={education}
              onChange={(next) =>
                updatePending(
                  "education",
                  pending.education.map((e, ei) => (ei === i ? next : e))
                )
              }
              onRemove={() =>
                updatePending(
                  "education",
                  pending.education.filter((_, ei) => ei !== i)
                )
              }
            />
          ))}

          {pending.certifications.map((cert, i) => (
            <CertificationRow
              key={cert.id}
              certification={cert}
              onChange={(next) =>
                updatePending(
                  "certifications",
                  pending.certifications.map((c, ci) => (ci === i ? next : c))
                )
              }
              onRemove={() =>
                updatePending(
                  "certifications",
                  pending.certifications.filter((_, ci) => ci !== i)
                )
              }
            />
          ))}

          {Object.keys(pending.technical_skills).length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-violet-800 dark:text-violet-300">
                Technical skills found (merged in as-is on accept)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(pending.technical_skills).flatMap(([category, skills]) =>
                  skills.map((s) => (
                    <span
                      key={`${category}-${s.skill}`}
                      className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                    >
                      {s.skill}
                    </span>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
