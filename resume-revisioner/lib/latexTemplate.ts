import { escapeLatex } from "./latexEscape";
import type { Certification, EducationEntry, GenerateResumeSectionInput, TechnicalSkills } from "./types";

// Preamble copied verbatim from latex-resumes/master-resume.tex — that file
// is the template this generator is meant to follow, so keep this in sync if
// the template's packages/custom commands ever change.
const PREAMBLE = String.raw`\documentclass[letterpaper,11pt]{article}

\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\usepackage{fontawesome5}
\usepackage{multicol}
\setlength{\multicolsep}{-3.0pt}
\setlength{\columnsep}{-1pt}
\input{glyphtounicode}
\usepackage[margin=1.4cm]{geometry}


\pagestyle{fancy}
\fancyhf{} % clear all header and footer fields
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

% Adjust margins
\addtolength{\oddsidemargin}{-0.15in}
 \addtolength{\textwidth}{0.3in}

\urlstyle{same}

\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

% Sections formatting
\titleformat{\section}{
  \vspace{-4pt}\scshape\raggedright\large\bfseries
}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]

% Ensure that generate pdf is machine readable/ATS parsable
\pdfgentounicode=1

%-------------------------
% Custom commands
\newcommand{\resumeItem}[1]{
  \item\small{
    {#1 \vspace{0pt}}
  }
}

\newcommand{\classesList}[4]{
    \item\small{
        {#1 #2 #3 #4 \vspace{-2pt}}
  }
}

\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{1.0\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & \textbf{\small #2} \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubSubheading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \textit{\small#1} & \textit{\small #2} \\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{1.001\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & \textbf{\small #2}\\
    \end{tabular*}\vspace{-7pt}
}

\newcommand{\resumeSubItem}[1]{\resumeItem{#1}\vspace{-4pt}}

\renewcommand\labelitemi{$\vcenter{\hbox{\tiny$\bullet$}}$}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}

\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}\vspace{0pt}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}
`;

const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  ai_ml_and_robotics: "AI/ML \\& Robotics",
};

function humanizeCategory(key: string): string {
  if (CATEGORY_LABEL_OVERRIDES[key]) return CATEGORY_LABEL_OVERRIDES[key];
  return key
    .split("_")
    .map((w) => (w === "and" ? "\\&" : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function linkDisplayText(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

interface Meta {
  name: string;
  email: string;
  linkedin: string;
  github: string;
  website: string;
}

/** Each contact segment is only included when its field is non-empty, so a
 * saved resume can selectively omit email/linkedin/github/website via its
 * ResumeSelection.contact toggles without leaving a dangling "~" separator
 * or an empty \href. Name (and the hardcoded "US Citizen" line) always show. */
function buildHeader(meta: Meta): string {
  const segments = [
    String.raw`$\bullet$\ \underline{\textbf{US Citizen}}`,
    meta.email && String.raw`{\faEnvelope\  \underline{${escapeLatex(meta.email)}}}`,
    meta.linkedin &&
      String.raw`{\faLinkedin\ \underline{\href{${meta.linkedin}}{${escapeLatex(linkDisplayText(meta.linkedin))}}}}`,
    meta.github &&
      String.raw`{\faGithub\ \underline{\href{${meta.github}}{${escapeLatex(linkDisplayText(meta.github))}}}}`,
    meta.website &&
      String.raw`{\faBriefcase\ \underline{\href{${meta.website}}{${escapeLatex(linkDisplayText(meta.website))}}}}`,
  ].filter((s): s is string => Boolean(s));

  return String.raw`\begin{center}
    {\Large \scshape ${escapeLatex(meta.name)}} \\[2mm]
    \footnotesize
    ${segments.join(" ~\n    ")}
\end{center}`;
}

function buildEducation(education: EducationEntry[]): string {
  if (education.length === 0) return "";
  const entries = education
    .map(
      (e) => String.raw`    \resumeSubheading
      {${escapeLatex(e.institution)}}{${escapeLatex(e.location ?? "")}}
      {${escapeLatex(e.credential)}}{${escapeLatex(e.dates)}}`
    )
    .join("\n");

  return String.raw`%-----------EDUCATION-----------
\section{Education}
  \resumeSubHeadingListStart
${entries}
  \resumeSubHeadingListEnd`;
}

function buildExperience(jobs: GenerateResumeSectionInput[]): string {
  if (jobs.length === 0) return "";
  const entries = jobs
    .map((job) => {
      const bullets = job.bullets
        .map((b) => `                    \\resumeItem{${escapeLatex(b.text)}}`)
        .join("\n");
      return String.raw`                \resumeSubheading{${escapeLatex(job.company ?? "")}}{${escapeLatex(job.dates)}}{${escapeLatex(job.role ?? "")}}{${escapeLatex(job.location ?? "")}}
                \resumeItemListStart
${bullets}
                    \resumeItemListEnd`;
    })
    .join("\n");

  return String.raw`%-----------Experience---------------
\section{Work Experience}
    \resumeSubHeadingListStart
${entries}
    \resumeSubHeadingListEnd
    \vspace{-12pt}`;
}

function buildProjects(projects: GenerateResumeSectionInput[]): string {
  if (projects.length === 0) return "";
  const entries = projects
    .map((project) => {
      const linkStr = (project.links ?? [])
        .map((l) => `\\href{${l.href}}{${escapeLatex(l.name)}}`)
        .join(" $|$ ");
      const titleLine = `\\textbf{{${escapeLatex(project.label)}}}` + (linkStr ? ` $|$ \\emph{${linkStr}}` : "");
      const bullets = project.bullets
        .map((b) => `                \\resumeItem{${escapeLatex(b.text)}}`)
        .join("\n");
      return String.raw`        \resumeProjectHeading
            {${titleLine}}{${escapeLatex(project.dates)}}
            \resumeItemListStart
${bullets}
            \resumeItemListEnd`;
    })
    .join("\n\n");

  return String.raw`%-----------PROJECTS-----------
\section{Projects}
    \vspace{-5pt}
    \resumeSubHeadingListStart

${entries}

    \resumeSubHeadingListEnd
 \vspace{-12pt}`;
}

function buildCertifications(certifications: Certification[]): string {
  if (certifications.length === 0) return "";
  const entries = certifications
    .map((c) => {
      const meta = [c.issuer, c.date]
        .filter((x): x is string => Boolean(x))
        .map(escapeLatex)
        .join(" -- ");
      return String.raw`    \resumeSubItem{\textbf{${escapeLatex(c.name)}}${meta ? ` (${meta})` : ""}}`;
    })
    .join("\n");

  return String.raw`%-----------CERTIFICATIONS-----------
\section{Certifications}
  \resumeSubHeadingListStart
${entries}
  \resumeSubHeadingListEnd`;
}

function buildSkills(technicalSkills: TechnicalSkills): string {
  const entries = Object.entries(technicalSkills).filter(
    ([, entries]) => Array.isArray(entries) && entries.length > 0
  );
  if (entries.length === 0) return "";
  const lines = entries
    .map(([category, entries]) => {
      const skillList = entries.map((e) => escapeLatex(e.skill)).join(", ");
      return `     \\textbf{${humanizeCategory(category)}}{: ${skillList}} \\\\[1mm]`;
    })
    .join("\n");

  return String.raw`  %-----------PROGRAMMING SKILLS-----------
\section{Technical Skills}
 \begin{itemize}[leftmargin=0.15in, label={}]
    \small{\item{
${lines}
    }}
 \end{itemize}
 \vspace{-16pt}`;
}

export interface BuildResumeTexInput {
  meta: Meta;
  education: EducationEntry[];
  technicalSkills: TechnicalSkills;
  jobs: GenerateResumeSectionInput[];
  projects: GenerateResumeSectionInput[];
  /** Optional — existing callers (e.g. the JD-tailoring flow) that don't
   * pass this render no certifications section, unchanged from before. */
  certifications?: Certification[];
}

export function buildResumeTex(input: BuildResumeTexInput): string {
  const parts = [
    PREAMBLE,
    "",
    "\\begin{document}",
    "",
    buildHeader(input.meta),
    "",
    buildEducation(input.education),
    input.certifications?.length ? buildCertifications(input.certifications) : "",
    buildExperience(input.jobs),
    buildProjects(input.projects),
    buildSkills(input.technicalSkills),
    "",
    "\\end{document}",
    "",
  ];
  return parts.join("\n");
}
