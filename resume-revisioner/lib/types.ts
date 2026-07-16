export interface Bullet {
  id: string;
  text: string;
  tags: string[];
  has_metric: boolean;
}

export interface JobEntry {
  company: string;
  role: string;
  dates: string;
  date_confidence: string;
  bullets: Bullet[];
}

export interface ProjectLink {
  name: string;
  href: string;
}

export interface ProjectEntry {
  name: string;
  dates: string;
  date_confidence: string;
  links?: ProjectLink[];
  bullets: Bullet[];
}

export interface ExperienceData {
  meta: {
    name: string;
    email: string;
    linkedin: string;
    github: string;
    website: string;
  };
  jobs: JobEntry[];
  projects: ProjectEntry[];
}

export interface Section {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
  bullets: Bullet[];
}

export interface ScoredBullet extends Bullet {
  score: number;
  matchedKeywords: string[];
}

export interface RankedSection {
  id: string;
  kind: "job" | "project";
  label: string;
  dates: string;
  totalBullets: number;
  shownBullets: ScoredBullet[];
}

export interface GapKeyword {
  keyword: string;
  frequency: number;
}

export interface AnalyzeResponse {
  sections: RankedSection[];
  gaps: GapKeyword[];
}

export interface AnalyzeRequest {
  jdText: string;
  maxBullets: number;
}
