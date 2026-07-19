"use client";

import { useState } from "react";
import AnimatedFileUpload from "@/app/components/ui/animated-file-upload";
import { JobVersionCompareModal, ProjectVersionCompareModal } from "@/app/components/ui/version-compare-modal";
import CertificationRow from "@/app/components/CertificationRow";
import EducationEntryRow from "@/app/components/EducationEntryRow";
import JobEntryRow from "@/app/components/JobEntryRow";
import ProjectEntryRow from "@/app/components/ProjectEntryRow";
import TechnicalSkillsSection from "@/app/components/TechnicalSkillsSection";
import type {
  Bullet,
  Certification,
  EducationEntry,
  ExperienceData,
  ExtractedExperienceFragment,
  ExtractExperienceResponse,
  JobEntry,
  Meta,
  ProjectEntry,
  ProjectLink,
  SocialLink,
  TechnicalSkills,
} from "@/lib/types";

interface ExperienceUploadPanelProps {
  experience: ExperienceData;
  onChange: (patch: Partial<ExperienceData>) => void;
  ollamaModel: string;
  ollamaHost: string;
}

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

/** Unions technical skills already saved with newly-extracted ones, deduping
 * by lowercased skill name within each category. */
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

const PLACEHOLDER_TAG_TOKENS = new Set(["short-kebab-case-skill", "..."]);

/** Filters out the extraction prompt's own JSON-shape example tokens, which
 * a small local model sometimes echoes back literally instead of a real
 * skill/tech tag. */
function normalizeTags(value: unknown): string[] {
  return normalizeStringArray(value).filter((tag) => !PLACEHOLDER_TAG_TOKENS.has(tag.trim().toLowerCase()));
}

function normalizeBullets(bullets: Partial<Bullet>[] | undefined): Bullet[] {
  if (!Array.isArray(bullets)) return [];
  return bullets.map((b) => ({
    id: makeId("bullet"),
    text: typeof b.text === "string" ? b.text : "",
    tags: normalizeTags(b.tags),
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

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_MONTH_RE = /^\d{4}-\d{2}$/;

/** JobEntryRow's <input type="date"> requires an exact YYYY-MM-DD string or
 * silently renders empty — a small local model fed month/year-only source
 * text often returns just "YYYY-MM", so pad it to the 1st of the month
 * rather than let the date picker silently fail to show what was found. */
function normalizeJobDate(value: string | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed === "present") return trimmed;
  if (ISO_DATE_RE.test(trimmed)) return trimmed;
  if (YEAR_MONTH_RE.test(trimmed)) return `${trimmed}-01`;
  return undefined;
}

const MONTH_NUMBERS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07", july: "07",
  aug: "08", august: "08", sep: "09", sept: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
};
const MONTH_YEAR_RE = /([A-Za-z]{3,9})\.?\s+(\d{4})/;
const PRESENT_RE = /present|current/i;

/** Best-effort fallback for when the model returns a free-text `dates`
 * string (e.g. "Mar 2023 - Nov 2023") but omits start_date/end_date
 * entirely — not a general date parser, just the common resume patterns
 * ("Mon YYYY - Mon YYYY", full month names, "Mon YYYY - Present"/"Current").
 * English month names only. Never guesses: returns {} if it can't
 * confidently find a month + year on the start side. */
function parseDatesFromDisplayString(dates: string): { start?: string; end?: string } {
  const [rawStart, rawEnd] = dates.split(/[–—-]/).map((s) => s.trim());
  if (!rawStart) return {};

  const startMatch = MONTH_YEAR_RE.exec(rawStart);
  const startMonth = startMatch && MONTH_NUMBERS[startMatch[1].toLowerCase()];
  if (!startMatch || !startMonth) return {};
  const start = `${startMatch[2]}-${startMonth}-01`;

  if (!rawEnd) return { start };
  if (PRESENT_RE.test(rawEnd)) return { start, end: "present" };

  const endMatch = MONTH_YEAR_RE.exec(rawEnd);
  const endMonth = endMatch && MONTH_NUMBERS[endMatch[1].toLowerCase()];
  if (!endMatch || !endMonth) return { start };
  return { start, end: `${endMatch[2]}-${endMonth}-01` };
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
  const dates = j.dates ?? "";
  const normalizedStart = normalizeJobDate(j.start_date);
  const normalizedEnd = normalizeJobDate(j.end_date);
  const fallback = !normalizedStart || !normalizedEnd ? parseDatesFromDisplayString(dates) : {};

  return {
    company: j.company ?? "",
    role: j.role ?? "",
    dates,
    start_date: normalizedStart ?? fallback.start,
    end_date: normalizedEnd ?? fallback.end,
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

/** Two or more versions of what looks like the same job/project, extracted
 * from different attachments — held back from the normal editable list until
 * the user picks one via the compare modal. */
interface EntryGroup<T> {
  key: string;
  versions: Sourced<T>[];
}

function jobDedupKey(job: JobEntry): string {
  const company = job.company.trim().toLowerCase();
  const role = job.role.trim().toLowerCase();
  if (!company && !role) return "";
  return `${company}|${role}`;
}

function projectDedupKey(project: ProjectEntry): string {
  return project.name.trim().toLowerCase();
}

/** Buckets sourced entries by an exact-match title key. A blank key (e.g. a
 * job with no company/role extracted) is never grouped — clustering unrelated
 * blank entries together would be a worse outcome than just listing them
 * separately. Groups of 1 come back as `resolved` (today's normal rendering);
 * groups of 2+ come back as `groups`, awaiting a compare-modal decision. */
function groupBySourceKey<T>(
  items: Sourced<T>[],
  keyFn: (entry: T) => string
): { resolved: Sourced<T>[]; groups: EntryGroup<T>[] } {
  const byKey = new Map<string, Sourced<T>[]>();
  const order: string[] = [];
  const resolved: Sourced<T>[] = [];

  for (const item of items) {
    const key = keyFn(item.entry);
    if (!key) {
      resolved.push(item);
      continue;
    }
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(item);
  }

  const groups: EntryGroup<T>[] = [];
  for (const key of order) {
    const versions = byKey.get(key)!;
    if (versions.length === 1) resolved.push(versions[0]);
    else groups.push({ key, versions });
  }
  return { resolved, groups };
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

/** What's left to resolve after an extraction — everything unambiguous is
 * merged straight into the live experience data; only genuine disagreements
 * between attachments (a contact field, or two versions of what looks like
 * the same job/project) wait here for a decision. */
interface PendingReview {
  metaConflicts: MetaFieldConflict[];
  jobGroups: EntryGroup<JobEntry>[];
  projectGroups: EntryGroup<ProjectEntry>[];
}

type CompareModalState =
  | { kind: "job"; group: EntryGroup<JobEntry> }
  | { kind: "project"; group: EntryGroup<ProjectEntry> }
  | null;

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";
const sectionClass =
  "flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950";
const addButtonClass =
  "self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

const META_FIELD_LABELS: Record<MetaTextField, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  linkedin: "linkedin",
  github: "github",
  website: "website",
};

export default function ExperienceUploadPanel({
  experience,
  onChange,
  ollamaModel,
  ollamaHost,
}: ExperienceUploadPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [dropzoneKey, setDropzoneKey] = useState(0);
  const [pastedText, setPastedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [currentSourceLabel, setCurrentSourceLabel] = useState<string | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractWarnings, setExtractWarnings] = useState<string[]>([]);
  const [sourceErrors, setSourceErrors] = useState<{ label: string; message: string }[]>([]);
  const [addedSummary, setAddedSummary] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [compareModal, setCompareModal] = useState<CompareModalState>(null);

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
    setAddedSummary(null);

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

    const allJobs = results.flatMap((r) =>
      (Array.isArray(r.fragment.jobs) ? r.fragment.jobs : []).map((j) => ({ entry: buildJobEntry(j), source: r.label }))
    );
    const allProjects = results.flatMap((r) =>
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

    const { resolved: jobs, groups: jobGroups } = groupBySourceKey(allJobs, jobDedupKey);
    const { resolved: projects, groups: projectGroups } = groupBySourceKey(allProjects, projectDedupKey);

    onChange({
      meta: { ...experience.meta, ...meta },
      jobs: [...experience.jobs, ...jobs.map((j) => j.entry)],
      projects: [...experience.projects, ...projects.map((p) => p.entry)],
      education: [...experience.education, ...education.map((e) => e.entry)],
      certifications: [...(experience.certifications ?? []), ...certifications.map((c) => c.entry)],
      technical_skills: mergeTechnicalSkills(experience.technical_skills, technical_skills),
    });

    const addedCount = jobs.length + projects.length + education.length + certifications.length;
    setAddedSummary(
      addedCount > 0
        ? `Added ${addedCount} item${addedCount === 1 ? "" : "s"} to your experience below.`
        : "Nothing new was extracted from that source."
    );

    setPending(
      conflicts.length > 0 || jobGroups.length > 0 || projectGroups.length > 0
        ? { metaConflicts: conflicts, jobGroups, projectGroups }
        : null
    );

    setFiles([]);
    setPastedText("");
    setDropzoneKey((k) => k + 1);
    setExtracting(false);
  }

  function resolveJobGroup(key: string, chosen: Sourced<JobEntry>) {
    onChange({ jobs: [...experience.jobs, chosen.entry] });
    setPending((prev) => (prev ? { ...prev, jobGroups: prev.jobGroups.filter((g) => g.key !== key) } : prev));
    setCompareModal(null);
  }

  function resolveProjectGroup(key: string, chosen: Sourced<ProjectEntry>) {
    onChange({ projects: [...experience.projects, chosen.entry] });
    setPending((prev) =>
      prev ? { ...prev, projectGroups: prev.projectGroups.filter((g) => g.key !== key) } : prev
    );
    setCompareModal(null);
  }

  function updateMetaConflictChoice(field: MetaTextField, value: string) {
    onChange({ meta: { ...experience.meta, [field]: value } });
  }

  function dismissConflicts() {
    setPending(null);
  }

  const certifications = experience.certifications ?? [];

  return (
    <>
    <section className={sectionClass}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Import from files or pasted text</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Upload one or more resume PDFs, Markdown/JSON exports, or paste text describing your experience. A
        local Ollama model extracts structured entries directly into the sections below — you&apos;ll only
        be asked here to resolve anything your attachments disagree on.
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
      {addedSummary && <p className="text-sm text-emerald-700 dark:text-emerald-400">{addedSummary}</p>}

      {pending && (
        <div className="mt-2 flex flex-col gap-4 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Your attachments disagreed on some things — resolve below (everything else was already added)
            </p>
            <button
              onClick={dismissConflicts}
              className="rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Dismiss
            </button>
          </div>

          {pending.metaConflicts.length > 0 && (
            <div className="flex flex-col gap-3">
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
                          checked={experience.meta[conflict.field] === candidate.value}
                          onChange={() => updateMetaConflictChoice(conflict.field, candidate.value)}
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

          {pending.jobGroups.map((group) => (
            <div
              key={group.key}
              className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-100/60 p-3 dark:border-amber-700 dark:bg-amber-950/50"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {group.versions[0].entry.company} — {group.versions[0].entry.role}
              </p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {group.versions.length} versions found (from: {group.versions.map((v) => v.source).join(", ")})
              </p>
              <button
                onClick={() => setCompareModal({ kind: "job", group })}
                className="self-start rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Compare versions
              </button>
            </div>
          ))}

          {pending.projectGroups.map((group) => (
            <div
              key={group.key}
              className="flex flex-col gap-1 rounded-md border border-amber-300 bg-amber-100/60 p-3 dark:border-amber-700 dark:bg-amber-950/50"
            >
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{group.versions[0].entry.name}</p>
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                {group.versions.length} versions found (from: {group.versions.map((v) => v.source).join(", ")})
              </p>
              <button
                onClick={() => setCompareModal({ kind: "project", group })}
                className="self-start rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Compare versions
              </button>
            </div>
          ))}
        </div>
      )}
    </section>

    <section id="exp-section-contact" className={sectionClass}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Contact info</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input
            className={inputClass}
            value={experience.meta.name}
            onChange={(e) => onChange({ meta: { ...experience.meta, name: e.target.value } })}
          />
        </label>
        <label className={labelClass}>
          Email
          <input
            className={inputClass}
            value={experience.meta.email}
            onChange={(e) => onChange({ meta: { ...experience.meta, email: e.target.value } })}
          />
        </label>
        <label className={labelClass}>
          Phone
          <input
            className={inputClass}
            value={experience.meta.phone ?? ""}
            onChange={(e) => onChange({ meta: { ...experience.meta, phone: e.target.value || undefined } })}
          />
        </label>
        <label className={labelClass}>
          LinkedIn
          <input
            className={inputClass}
            value={experience.meta.linkedin}
            onChange={(e) => onChange({ meta: { ...experience.meta, linkedin: e.target.value } })}
          />
        </label>
        <label className={labelClass}>
          GitHub
          <input
            className={inputClass}
            value={experience.meta.github}
            onChange={(e) => onChange({ meta: { ...experience.meta, github: e.target.value } })}
          />
        </label>
        <label className={labelClass}>
          Website
          <input
            className={inputClass}
            value={experience.meta.website}
            onChange={(e) => onChange({ meta: { ...experience.meta, website: e.target.value } })}
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
                  onChange({ meta: { ...experience.meta, social_links: links } });
                }}
              />
              <input
                className={`${inputClass} min-w-[12rem] flex-1`}
                placeholder="https://…"
                value={link.url}
                onChange={(e) => {
                  const links = [...(experience.meta.social_links ?? [])];
                  links[i] = { ...links[i], url: e.target.value };
                  onChange({ meta: { ...experience.meta, social_links: links } });
                }}
              />
              <button
                onClick={() => {
                  const links = (experience.meta.social_links ?? []).filter((_, li) => li !== i);
                  onChange({ meta: { ...experience.meta, social_links: links } });
                }}
                className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              onChange({
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

    <section id="exp-section-jobs" className={sectionClass}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Work experience</h2>
      <div className="flex flex-col gap-4">
        {experience.jobs.map((job, i) => (
          <div key={i} id={`exp-job-${i}`}>
            <JobEntryRow
              job={job}
              onChange={(next) => onChange({ jobs: experience.jobs.map((j, ji) => (ji === i ? next : j)) })}
              onRemove={() => onChange({ jobs: experience.jobs.filter((_, ji) => ji !== i) })}
            />
          </div>
        ))}
      </div>
      <button onClick={() => onChange({ jobs: [...experience.jobs, emptyJob()] })} className={addButtonClass}>
        + Add job
      </button>
    </section>

    <section id="exp-section-projects" className={sectionClass}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Projects</h2>
      <div className="flex flex-col gap-4">
        {experience.projects.map((project, i) => (
          <div key={i} id={`exp-project-${i}`}>
            <ProjectEntryRow
              project={project}
              onChange={(next) =>
                onChange({ projects: experience.projects.map((p, pi) => (pi === i ? next : p)) })
              }
              onRemove={() => onChange({ projects: experience.projects.filter((_, pi) => pi !== i) })}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange({ projects: [...experience.projects, emptyProject()] })}
        className={addButtonClass}
      >
        + Add project
      </button>
    </section>

    <section id="exp-section-education" className={sectionClass}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Education</h2>
      <div className="flex flex-col gap-4">
        {experience.education.map((education, i) => (
          <div key={i} id={`exp-edu-${i}`}>
            <EducationEntryRow
              education={education}
              onChange={(next) =>
                onChange({ education: experience.education.map((e, ei) => (ei === i ? next : e)) })
              }
              onRemove={() => onChange({ education: experience.education.filter((_, ei) => ei !== i) })}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange({ education: [...experience.education, emptyEducation()] })}
        className={addButtonClass}
      >
        + Add education
      </button>
    </section>

    <section id="exp-section-certifications" className={sectionClass}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Certifications</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Not yet included in generated resumes — tracked here for your records and future use.
      </p>
      <div className="flex flex-col gap-4">
        {certifications.map((cert, i) => (
          <div key={cert.id} id={`exp-cert-${cert.id}`}>
            <CertificationRow
              certification={cert}
              onChange={(next) => onChange({ certifications: certifications.map((c, ci) => (ci === i ? next : c)) })}
              onRemove={() => onChange({ certifications: certifications.filter((_, ci) => ci !== i) })}
            />
          </div>
        ))}
      </div>
      <button
        onClick={() => onChange({ certifications: [...certifications, emptyCertification()] })}
        className={addButtonClass}
      >
        + Add certification
      </button>
    </section>

    <section id="exp-section-skills" className={sectionClass}>
      <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Technical skills</h2>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Group your languages, frameworks, tools, and other skills into categories — these become the
        &quot;Technical Skills&quot; lines on your generated resume.
      </p>
      <TechnicalSkillsSection
        technicalSkills={experience.technical_skills}
        onChange={(technical_skills) => onChange({ technical_skills })}
      />
    </section>

    {compareModal?.kind === "job" && (
      <JobVersionCompareModal
        title={`${compareModal.group.versions[0].entry.company} — ${compareModal.group.versions[0].entry.role}`}
        versions={compareModal.group.versions}
        onSelect={(version) => resolveJobGroup(compareModal.group.key, version)}
        onClose={() => setCompareModal(null)}
      />
    )}
    {compareModal?.kind === "project" && (
      <ProjectVersionCompareModal
        title={compareModal.group.versions[0].entry.name}
        versions={compareModal.group.versions}
        onSelect={(version) => resolveProjectGroup(compareModal.group.key, version)}
        onClose={() => setCompareModal(null)}
      />
    )}
    </>
  );
}
