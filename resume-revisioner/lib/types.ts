export interface Bullet {
  id: string;
  text: string;
  tags: string[];
  has_metric: boolean;
}

export interface JobEntry {
  /** Stable identifier for referencing this job from outside experience.yaml
   * (e.g. a saved resume's section selection). Backfilled on read for
   * entries that predate this field — see GET /api/experience. */
  id?: string;
  company: string;
  role: string;
  dates: string;
  /** Structured "YYYY-MM-DD" alongside the free-text `dates` display string. */
  start_date?: string;
  /** Structured "YYYY-MM-DD", or "present". */
  end_date?: string;
  date_confidence: string;
  location?: string;
  work_mode?: string;
  hours_per_week?: number;
  /** Government positions only. */
  pay_plan?: string;
  pay_series?: string;
  pay_grade?: string;
  /** Whether this entry is offered to the tailoring pipeline. Absent/undefined
   * means included — only an explicit `false` excludes it, so existing
   * entries in hand-authored experience.yaml keep showing up unchanged. */
  included?: boolean;
  bullets: Bullet[];
}

export interface ProjectLink {
  name: string;
  href: string;
}

export interface ProjectEntry {
  /** Stable identifier — see JobEntry.id. */
  id?: string;
  name: string;
  dates: string;
  date_confidence: string;
  links?: ProjectLink[];
  included?: boolean;
  bullets: Bullet[];
}

export interface EducationEntry {
  /** Stable identifier — see JobEntry.id. */
  id?: string;
  institution: string;
  credential: string;
  /** Structured facets of `credential`, e.g. "Bachelor's" / "Computer Science". */
  degree_level?: string;
  major?: string;
  dates: string;
  /** Structured "YYYY-MM" graduation date alongside the free-text `dates`. */
  graduation_date?: string;
  /** String rather than number so "3.8/4.0" or honors wording both fit. */
  gpa?: string;
  date_confidence: string;
  location?: string;
  details?: string[];
  links?: ProjectLink[];
  included?: boolean;
}

export interface Certification {
  id: string;
  name: string;
  issuer?: string;
  /** "YYYY-MM" issue date. */
  date?: string;
  expiration_date?: string;
  credential_id?: string;
  links?: ProjectLink[];
  included?: boolean;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface TechnicalSkillEntry {
  skill: string;
  source: string;
}

export interface TechnicalSkills {
  [category: string]: TechnicalSkillEntry[];
}

export interface Meta {
  name: string;
  email: string;
  phone?: string;
  linkedin: string;
  github: string;
  website: string;
  /** Anything beyond linkedin/github/website above (Instagram, portfolio
   * mirrors, etc.) — reference metadata only, never fetched/scraped. */
  social_links?: SocialLink[];
}

export interface ExperienceData {
  meta: Meta;
  jobs: JobEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications?: Certification[];
  technical_skills: TechnicalSkills;
}

export interface Section {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
  bullets: Bullet[];
  /** Job-only, for the resume subheading's right-aligned location column. */
  location?: string;
  /** Split out from `label` for jobs so the LaTeX generator can lay out
   * company/role in separate table cells instead of re-parsing the string. */
  company?: string;
  role?: string;
  /** Project-only. */
  links?: ProjectLink[];
}

export interface ScoredBullet extends Bullet {
  /** 0-100 relevance score, always present in both modes. Keyword mode
   * normalizes its raw overlap count against the best bullet in the run;
   * Ollama mode asks the model directly for a 0-100 judgment. */
  score: number;
  /** Keyword-mode matched terms. Empty/absent in Ollama mode. */
  matchedKeywords?: string[];
  /** Ollama mode's justification for the score — more specific for low scores. Absent in keyword mode. */
  reason?: string;
}

export interface RankedSection {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
  location?: string;
  company?: string;
  role?: string;
  links?: ProjectLink[];
  totalBullets: number;
  shownBullets: ScoredBullet[];
}

export interface GapKeyword {
  keyword: string;
  /** Occurrence count in the JD. Absent for Ollama-sourced gaps. */
  frequency?: number;
}

export type AnalyzeMode = "keyword" | "ollama";

export interface AnalyzeResponse {
  mode: AnalyzeMode;
  sections: RankedSection[];
  gaps: GapKeyword[];
  /** Ollama-only short fit/strengths/gaps summary paragraph. */
  overview?: string;
  /** Non-fatal pipeline step failures (e.g. the gaps or overview call errored) — surfaced so a failure isn't mistaken for a clean result. */
  warnings?: string[];
}

export interface AnalyzeRequest {
  jdText: string;
  maxBullets: number;
  mode?: AnalyzeMode;
  ollamaModel?: string;
  ollamaHost?: string;
}

/** NDJSON progress events streamed by /api/analyze while mode=ollama. */
export type AnalyzeProgressEvent =
  | { type: "progress"; stage: "scoring" | "gaps" | "overview"; current?: number; total?: number; label?: string }
  | { type: "result"; data: AnalyzeResponse }
  | { type: "error"; message: string };

export interface GenerateResumeSectionInput {
  id: string;
  kind: "job" | "project";
  company?: string;
  role?: string;
  location?: string;
  /** Project name (kind="project"); ignored for jobs, which use company/role instead. */
  label: string;
  dates: string;
  links?: ProjectLink[];
  /** Final bullet text (post-override), best-first, already trimmed to the analysis's max-bullets-per-role setting. */
  bullets: { id: string; text: string; score: number }[];
}

export interface GenerateResumeRequest {
  filename: string;
  maxJobs: number;
  maxProjects: number;
  maxPages: number;
  sections: GenerateResumeSectionInput[];
  /** Set after the user has seen a "this file already exists" 409 and chosen to proceed anyway. */
  confirmOverwrite?: boolean;
}

export interface GenerateResumeResponse {
  texPath: string;
  pdfPath?: string;
  pagesUsed: number | null;
  trimmedItems: string[];
  warnings?: string[];
}

export interface ImproveRequest {
  bulletText: string;
  tags: string[];
  jdText: string;
  ollamaModel?: string;
  ollamaHost?: string;
}

export interface ImproveResponse {
  improvedText: string;
}

/** NDJSON progress events streamed by /api/generate-resume. */
export type GenerateProgressEvent =
  | {
      type: "progress";
      stage: "compiling" | "trimming" | "finalizing";
      attempt?: number;
      label?: string;
    }
  | { type: "needs_confirmation"; message: string }
  | { type: "result"; data: GenerateResumeResponse }
  | { type: "error"; message: string };

// ---------------------------------------------------------------------------
// "My Experience" tab: upload/paste -> Ollama extraction -> review -> save
// ---------------------------------------------------------------------------

export type ExperienceSourceKind = "pdf" | "markdown" | "json" | "text";

export interface ExtractExperienceRequest {
  /** Already-extracted plain text (PDF/MD/JSON/pasted text all normalized to
   * this before hitting the route). */
  rawText: string;
  /** Filename or "pasted text" — prompt context + UI attribution. */
  sourceLabel: string;
  ollamaModel?: string;
  ollamaHost?: string;
}

/** Everything here is optional/partial — the model may only find a subset of
 * fields, and the review UI is what turns this into complete entries. `id`
 * and `included` are deliberately absent: assigned/defaulted client-side
 * after the user accepts, never invented by the model. */
export interface ExtractedExperienceFragment {
  meta?: Partial<Omit<Meta, "social_links">> & { social_links?: SocialLink[] };
  jobs?: (Partial<Omit<JobEntry, "bullets">> & { bullets?: Partial<Bullet>[] })[];
  projects?: (Partial<Omit<ProjectEntry, "bullets">> & { bullets?: Partial<Bullet>[] })[];
  education?: Partial<EducationEntry>[];
  certifications?: Partial<Omit<Certification, "id">>[];
  technical_skills?: TechnicalSkills;
}

export interface ExtractExperienceResponse {
  fragment: ExtractedExperienceFragment;
  /** e.g. "PDF text was truncated to the first N characters". */
  warnings?: string[];
}

export interface SaveExperienceRequest {
  experience: ExperienceData;
}

export interface SaveExperienceResponse {
  path: string;
}

/** GET /api/experience response — `isNew` flags a brand-new user with no
 * experience.yaml on disk yet, so the UI can show an empty state instead of
 * an error. */
export interface GetExperienceResponse {
  experience: ExperienceData;
  isNew: boolean;
  /** True if any job/project/education entry was missing a stable `id` and
   * had one backfilled in-memory for this response — the frontend should
   * immediately re-save once to persist the backfilled ids to disk. */
  idsBackfilled: boolean;
}
