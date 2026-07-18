"use client";

import { useState } from "react";
import AnimatedFileUpload from "@/app/components/ui/animated-file-upload";
import CertificationRow from "@/app/components/CertificationRow";
import EducationEntryRow from "@/app/components/EducationEntryRow";
import JobEntryRow from "@/app/components/JobEntryRow";
import ProjectEntryRow from "@/app/components/ProjectEntryRow";
import type {
  Bullet,
  Certification,
  EducationEntry,
  ExtractedExperienceFragment,
  ExtractExperienceResponse,
  JobEntry,
  Meta,
  ProjectEntry,
  ProjectLink,
  SocialLink,
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

/** Unions technical skills found across multiple attachments, deduping by
 * lowercased skill name within each category (last source wins on `source` tag). */
function mergeTechnicalSkillsAcrossSources(sources: TechnicalSkills[]): TechnicalSkills {
  const merged: TechnicalSkills = {};
  for (const skills of sources) {
    for (const [category, entries] of Object.entries(skills)) {
      const existing = merged[category] ?? [];
      const seen = new Set(existing.map((e) => e.skill.toLowerCase()));
      const additions = entries.filter((e) => !seen.has(e.skill.toLowerCase()));
      merged[category] = [...existing, ...additions];
    }
  }
  return merged;
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

function buildJobEntry(j: NonNullable<ExtractedExperienceFragment["jobs"]>[number]): JobEntry {
  return {
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
  };
}

function buildProjectEntry(p: NonNullable<ExtractedExperienceFragment["projects"]>[number]): ProjectEntry {
  return {
    name: p.name ?? "",
    dates: p.dates ?? "",
    date_confidence: p.date_confidence ?? "unknown",
    links: normalizeLinks(p.links),
    included: true,
    bullets: normalizeBullets(p.bullets),
  };
}

function buildEducationEntry(e: NonNullable<ExtractedExperienceFragment["education"]>[number]): EducationEntry {
  return {
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
  };
}

function buildCertification(c: NonNullable<ExtractedExperienceFragment["certifications"]>[number]): Certification {
  return {
    id: makeId("cert"),
    name: c.name ?? "",
    issuer: c.issuer,
    date: c.date,
    expiration_date: c.expiration_date,
    credential_id: c.credential_id,
    links: normalizeLinks(c.links),
    included: true,
  };
}

/** A draft entry plus which attachment it was extracted from, so the review
 * UI can show attribution when multiple files contribute overlapping content. */
interface Sourced<T> {
  entry: T;
  source: string;
}

const META_TEXT_FIELDS = ["name", "email", "phone", "linkedin", "github", "website"] as const;
type MetaTextField = (typeof META_TEXT_FIELDS)[number];

interface MetaFieldConflict {
  field: MetaTextField;
  candidates: { value: string; source: string }[];
}

/** Merges per-source contact info. A field with exactly one distinct value
 * across sources (however many agree) is filled in directly; a field with
 * disagreeing values becomes a conflict the user must pick between — pre-set
 * to the first candidate so there's always a sane default. */
function mergeMetaAcrossSources(
  results: { label: string; meta: Partial<Meta> }[]
): { meta: Partial<Meta>; conflicts: MetaFieldConflict[] } {
  const merged: Partial<Meta> = {};
  const conflicts: MetaFieldConflict[] = [];

  for (const field of META_TEXT_FIELDS) {
    const candidates: { value: string; source: string }[] = [];
    for (const r of results) {
      const value = r.meta[field];
      if (typeof value === "string" && value.trim()) candidates.push({ value: value.trim(), source: r.label });
    }
    const distinct = Array.from(new Set(candidates.map((c) => c.value)));
    if (distinct.length === 1) {
      (merged as Record<string, string>)[field] = distinct[0];
    } else if (distinct.length > 1) {
      conflicts.push({ field, candidates });
      (merged as Record<string, string>)[field] = candidates[0].value;
    }
  }

  const seen = new Set<string>();
  const socialLinks: SocialLink[] = [];
  for (const r of results) {
    for (const link of r.meta.social_links ?? []) {
      const key = `${link.platform.trim().toLowerCase()}|${link.url.trim().toLowerCase()}`;
      if (link.platform?.trim() && link.url?.trim() && !seen.has(key)) {
        seen.add(key);
        socialLinks.push(link);
      }
    }
  }
  if (socialLinks.length > 0) merged.social_links = socialLinks;

  return { meta: merged, conflicts };
}

interface PendingReview {
  meta: Partial<Meta>;
  metaConflicts: MetaFieldConflict[];
  jobs: Sourced<JobEntry>[];
  projects: Sourced<ProjectEntry>[];
  education: Sourced<EducationEntry>[];
  certifications: Sourced<Certification>[];
  technical_skills: TechnicalSkills;
}

type ListField = "jobs" | "projects" | "education" | "certifications";

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

const META_FIELD_LABELS: Record<MetaTextField, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  linkedin: "linkedin",
  github: "github",
  website: "website",
};

export default function ExperienceUploadPanel({ ollamaModel, ollamaHost, onAccept }: ExperienceUploadPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dropzoneKey, setDropzoneKey] = useState(0);
  const [pastedText, setPastedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [currentSourceLabel, setCurrentSourceLabel] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [sourceErrors, setSourceErrors] = useState<{ label: string; message: string }[]>([]);
  const [pending, setPending] = useState<PendingReview | null>(null);

  async function handleExtract() {
    const sources: { file?: File; text?: string; label: string }[] = [
      ...files.map((f) => ({ file: f, label: f.name })),
      ...(pastedText.trim() ? [{ text: pastedText.trim(), label: "Pasted text" }] : []),
    ];

    if (sources.length === 0) {
      setExtractError("Add at least one file or paste some text first.");
      return;
    }

    setExtracting(true);
    setExtractError(null);
    setExtractWarnings([]);
    setSourceErrors([]);

    const results: { label: string; fragment: ExtractedExperienceFragment }[] = [];
    const warnings: string[] = [];
    const errors: { label: string; message: string }[] = [];

    for (const source of sources) {
      setCurrentSourceLabel(source.label);
      try {
        const form = new FormData();
        if (source.file) form.set("file", source.file);
        else if (source.text) form.set("text", source.text);
        form.set("ollamaModel", ollamaModel);
        if (ollamaHost.trim()) form.set("ollamaHost", ollamaHost.trim());

        const res = await fetch("/api/experience/extract", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);

        const payload = data as ExtractExperienceResponse;
        results.push({ label: source.label, fragment: payload.fragment ?? {} });
        if (payload.warnings) warnings.push(...payload.warnings);
      } catch (err) {
        errors.push({ label: source.label, message: err instanceof Error ? err.message : "Extraction failed." });
      }
    }

    setCurrentSourceLabel(null);
    setExtractWarnings(warnings);
    setSourceErrors(errors);

    if (results.length === 0) {
      setExtracting(false);
      return;
    }

    const { meta, conflicts } = mergeMetaAcrossSources(
      results.map((r) => ({ label: r.label, meta: normalizeMeta(r.fragment.meta) }))
    );

    const jobs = results.flatMap((r) =>
      (Array.isArray(r.fragment.jobs) ? r.fragment.jobs : []).map((j) => ({ entry: buildJobEntry(j), source: r.label }))
    );
    const projects = results.flatMap((r) =>
      (Array.isArray(r.fragment.projects) ? r.fragment.projects : []).map((p) => ({
        entry: buildProjectEntry(p),
        source: r.label,
      }))
    );
    const education = results.flatMap((r) =>
      (Array.isArray(r.fragment.education) ? r.fragment.education : []).map((e) => ({
        entry: buildEducationEntry(e),
        source: r.label,
      }))
    );
    const certifications = results.flatMap((r) =>
      (Array.isArray(r.fragment.certifications) ? r.fragment.certifications : []).map((c) => ({
        entry: buildCertification(c),
        source: r.label,
      }))
    );
    const technical_skills = mergeTechnicalSkillsAcrossSources(
      results.map((r) => normalizeTechnicalSkills(r.fragment.technical_skills))
    );

    setPending({ meta, metaConflicts: conflicts, jobs, projects, education, certifications, technical_skills });
    setExtracting(false);
  }

  function updateMetaField(field: MetaTextField, value: string) {
    setPending((prev) => (prev ? { ...prev, meta: { ...prev.meta, [field]: value } } : prev));
  }

  function updateList<K extends ListField>(key: K, next: PendingReview[K]) {
    setPending((prev) => (prev ? { ...prev, [key]: next } : prev));
  }

  function acceptAll() {
    if (!pending) return;
    onAccept({
      meta: pending.meta,
      jobs: pending.jobs.map((j) => j.entry),
      projects: pending.projects.map((p) => p.entry),
      education: pending.education.map((e) => e.entry),
      certifications: pending.certifications.map((c) => c.entry),
      technical_skills: pending.technical_skills,
    });
    setPending(null);
    setFiles([]);
    setPastedText("");
    setDropzoneKey((k) => k + 1);
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
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Import from files or pasted text</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Upload one or more resume PDFs, Markdown/JSON exports, or paste text describing your experience. A
        local Ollama model extracts structured entries for you to review — nothing is added until you
        accept it below.
      </p>

      <AnimatedFileUpload
        key={dropzoneKey}
        accept=".pdf,.md,.txt,.json"
        multiple
        maxSize={15 * 1024 * 1024}
        onFilesSelected={setFiles}
      />

      <label className="flex flex-col gap-1 text-sm text-zinc-700 dark:text-zinc-300">
        Or paste additional text (optional — treated as one more attachment)
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          placeholder="Paste a resume, a bio, or a description of a role you worked…"
          className="h-28 w-full resize-y rounded-md border border-zinc-300 bg-white p-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>

      <button
        onClick={handleExtract}
        disabled={extracting}
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {extracting ? `Asking Ollama… ${currentSourceLabel ? `(${currentSourceLabel})` : ""}` : "Extract"}
      </button>

      {extractError && <p className="text-sm text-red-600 dark:text-red-400">{extractError}</p>}
      {sourceErrors.length > 0 && (
        <ul className="list-inside list-disc text-sm text-red-600 dark:text-red-400">
          {sourceErrors.map((e, i) => (
            <li key={i}>
              <span className="font-medium">{e.label}:</span> {e.message}
            </li>
          ))}
        </ul>
      )}
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

          {pending.metaConflicts.length > 0 && (
            <div className="flex flex-col gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                Your attachments disagree on {pending.metaConflicts.length === 1 ? "this field" : "these fields"} —
                pick which value to keep.
              </p>
              {pending.metaConflicts.map((conflict) => (
                <div key={conflict.field} className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold capitalize text-amber-900 dark:text-amber-200">
                    {META_FIELD_LABELS[conflict.field]}
                  </p>
                  <div className="flex flex-col gap-1">
                    {conflict.candidates.map((candidate, i) => (
                      <label
                        key={`${candidate.source}-${i}`}
                        className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300"
                      >
                        <input
                          type="radio"
                          name={`meta-conflict-${conflict.field}`}
                          checked={pending.meta[conflict.field] === candidate.value}
                          onChange={() => updateMetaField(conflict.field, candidate.value)}
                        />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{candidate.value}</span>
                        <span className="text-zinc-500 dark:text-zinc-400">— from {candidate.source}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(pending.meta).length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-violet-800 dark:text-violet-300">Contact info found</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {META_TEXT_FIELDS.filter((key) => pending.meta[key] !== undefined).map((key) => (
                  <label key={key} className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {key}
                    <input
                      className={inputClass}
                      value={(pending.meta[key] as string) ?? ""}
                      onChange={(e) => updateMetaField(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {pending.jobs.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">From: {item.source}</p>
              <JobEntryRow
                job={item.entry}
                onChange={(next) =>
                  updateList(
                    "jobs",
                    pending.jobs.map((j, ji) => (ji === i ? { ...j, entry: next } : j))
                  )
                }
                onRemove={() =>
                  updateList(
                    "jobs",
                    pending.jobs.filter((_, ji) => ji !== i)
                  )
                }
              />
            </div>
          ))}

          {pending.projects.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">From: {item.source}</p>
              <ProjectEntryRow
                project={item.entry}
                onChange={(next) =>
                  updateList(
                    "projects",
                    pending.projects.map((p, pi) => (pi === i ? { ...p, entry: next } : p))
                  )
                }
                onRemove={() =>
                  updateList(
                    "projects",
                    pending.projects.filter((_, pi) => pi !== i)
                  )
                }
              />
            </div>
          ))}

          {pending.education.map((item, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">From: {item.source}</p>
              <EducationEntryRow
                education={item.entry}
                onChange={(next) =>
                  updateList(
                    "education",
                    pending.education.map((e, ei) => (ei === i ? { ...e, entry: next } : e))
                  )
                }
                onRemove={() =>
                  updateList(
                    "education",
                    pending.education.filter((_, ei) => ei !== i)
                  )
                }
              />
            </div>
          ))}

          {pending.certifications.map((item, i) => (
            <div key={item.entry.id} className="flex flex-col gap-1">
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">From: {item.source}</p>
              <CertificationRow
                certification={item.entry}
                onChange={(next) =>
                  updateList(
                    "certifications",
                    pending.certifications.map((c, ci) => (ci === i ? { ...c, entry: next } : c))
                  )
                }
                onRemove={() =>
                  updateList(
                    "certifications",
                    pending.certifications.filter((_, ci) => ci !== i)
                  )
                }
              />
            </div>
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
