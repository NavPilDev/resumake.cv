"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { ResumeFileBrowser } from "@/app/components/ResumeFileBrowser";
import { ResumeSaveLocationModal } from "@/app/components/ResumeSaveLocationModal";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { humanizeSkillCategory } from "@/lib/technicalSkillCategory";
import { cn } from "@/lib/utils";
import { CONTACT_FIELDS } from "@/lib/contactFields";
import type {
  ResumeManifest,
  ResumeSelection,
  ResumeTreeNode,
  SectionSelection,
} from "@/lib/resumeFiles";
import type { ExperienceData, GetExperienceResponse } from "@/lib/types";

const EMPTY_EXPERIENCE: ExperienceData = {
  meta: { name: "", email: "", linkedin: "", github: "", website: "" },
  jobs: [],
  projects: [],
  education: [],
  certifications: [],
  technical_skills: {},
};

function emptySelection(): ResumeSelection {
  return {
    contact: [...CONTACT_FIELDS],
    jobs: {},
    projects: {},
    education: [],
    certifications: [],
    technicalSkillCategories: [],
  };
}

type SectionKey = "toc" | "contact" | "education" | "jobs" | "projects" | "certifications" | "skills";

const sectionLabels: Record<SectionKey, string> = {
  toc: "All Sections",
  contact: "Contact Info",
  education: "Education",
  jobs: "Work Experience",
  projects: "Projects",
  certifications: "Certifications",
  skills: "Technical Skills",
};

const sectionCardClass =
  "flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950";
const simpleRowClass =
  "flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200";
const textareaClass =
  "flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

function TocRow({ label, summary, onClick }: { label: string; summary: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
    >
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
      <span className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {summary}
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

function SectionHeader({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <button
        onClick={onBack}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <ChevronLeft className="h-4 w-4" /> All sections
      </button>
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{label}</h3>
    </div>
  );
}

type EditorView = "form" | "latex";

function ViewToggle({ value, onChange }: { value: EditorView; onChange: (v: EditorView) => void }) {
  return (
    <div className="relative flex shrink-0 items-center rounded-full border border-zinc-300 bg-zinc-100 p-0.5 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900">
      <span
        className={cn(
          "absolute top-0.5 bottom-0.5 left-0.5 w-14 rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-700",
          value === "latex" && "translate-x-14"
        )}
      />
      <button
        onClick={() => onChange("form")}
        className={cn(
          "relative z-10 w-14 rounded-full px-2 py-1 text-center",
          value === "form" ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
        )}
      >
        Form
      </button>
      <button
        onClick={() => onChange("latex")}
        className={cn(
          "relative z-10 w-14 rounded-full px-2 py-1 text-center",
          value === "latex" ? "text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
        )}
      >
        LaTeX
      </button>
    </div>
  );
}

export default function ResumesBuilder() {
  const [experience, setExperience] = useState<ExperienceData>(EMPTY_EXPERIENCE);
  const [experienceLoading, setExperienceLoading] = useState(true);
  const [experienceError, setExperienceError] = useState<string | null>(null);

  const [tree, setTree] = useState<ResumeTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);

  const [mode, setMode] = useState<"browse" | "create" | "edit">("browse");
  const [activeSection, setActiveSection] = useState<SectionKey>("toc");
  const [editorView, setEditorView] = useState<EditorView>("form");
  const [texContent, setTexContent] = useState<string | null>(null);
  const [texLoading, setTexLoading] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selection, setSelection] = useState<ResumeSelection>(emptySelection());
  const [textOverrides, setTextOverrides] = useState<Record<string, string>>({});
  const [lastCompileAt, setLastCompileAt] = useState<string | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);

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
        if (payload.idsBackfilled) {
          // Persist the newly-assigned job/project/education ids once,
          // invisibly, via the existing (already-validated) save route.
          fetch("/api/experience/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ experience: payload.experience }),
          }).catch(() => {});
        }
      } catch (err) {
        if (!cancelled) setExperienceError(err instanceof Error ? err.message : "Failed to load experience.yaml");
      } finally {
        if (!cancelled) setExperienceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshTree() {
    setTreeLoading(true);
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      setTree(data.tree as ResumeTreeNode[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load saved resumes");
    } finally {
      setTreeLoading(false);
    }
  }

  useEffect(() => {
    refreshTree();
  }, []);

  function startCreate() {
    setMode("create");
    setActiveSection("toc");
    setEditorView("form");
    setTexContent(null);
    setResumeId(null);
    setTitle("");
    setSelection(emptySelection());
    setTextOverrides({});
    setLastCompileAt(null);
    setSaveError(null);
    setDirty(true);
  }

  async function openResume(id: string) {
    setSaveError(null);
    try {
      const res = await fetch(`/api/resumes/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      const manifest = data as ResumeManifest;
      setMode("edit");
      setActiveSection("toc");
      setEditorView("form");
      setTexContent(null);
      setResumeId(manifest.id);
      setTitle(manifest.title);
      setSelection(manifest.selection);
      setTextOverrides(manifest.textOverrides);
      setLastCompileAt(manifest.lastCompile?.compiledAt ?? manifest.updatedAt);
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load resume");
    }
  }

  async function handleCreateFolder(parentPath: string, name: string) {
    try {
      const res = await fetch("/api/resumes/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentPath, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
      await refreshTree();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create folder");
    }
  }

  function toggleContact(key: string) {
    setSelection((prev) => {
      const has = prev.contact.includes(key);
      return { ...prev, contact: has ? prev.contact.filter((k) => k !== key) : [...prev.contact, key] };
    });
    setDirty(true);
  }

  function toggleJob(jobId: string, allBulletIds: string[]) {
    setSelection((prev) => {
      const current = prev.jobs[jobId];
      const nextIncluded = !(current?.included ?? false);
      const next: SectionSelection = {
        included: nextIncluded,
        bulletIds: current?.bulletIds ?? (nextIncluded ? allBulletIds : []),
      };
      return { ...prev, jobs: { ...prev.jobs, [jobId]: next } };
    });
    setDirty(true);
  }

  function toggleJobBullet(jobId: string, bulletId: string) {
    setSelection((prev) => {
      const current = prev.jobs[jobId] ?? { included: true, bulletIds: [] };
      const has = current.bulletIds.includes(bulletId);
      const next: SectionSelection = {
        included: current.included,
        bulletIds: has ? current.bulletIds.filter((id) => id !== bulletId) : [...current.bulletIds, bulletId],
      };
      return { ...prev, jobs: { ...prev.jobs, [jobId]: next } };
    });
    setDirty(true);
  }

  function toggleProject(projectId: string, allBulletIds: string[]) {
    setSelection((prev) => {
      const current = prev.projects[projectId];
      const nextIncluded = !(current?.included ?? false);
      const next: SectionSelection = {
        included: nextIncluded,
        bulletIds: current?.bulletIds ?? (nextIncluded ? allBulletIds : []),
      };
      return { ...prev, projects: { ...prev.projects, [projectId]: next } };
    });
    setDirty(true);
  }

  function toggleProjectBullet(projectId: string, bulletId: string) {
    setSelection((prev) => {
      const current = prev.projects[projectId] ?? { included: true, bulletIds: [] };
      const has = current.bulletIds.includes(bulletId);
      const next: SectionSelection = {
        included: current.included,
        bulletIds: has ? current.bulletIds.filter((id) => id !== bulletId) : [...current.bulletIds, bulletId],
      };
      return { ...prev, projects: { ...prev.projects, [projectId]: next } };
    });
    setDirty(true);
  }

  function toggleArrayMember(key: "education" | "certifications" | "technicalSkillCategories", id: string) {
    setSelection((prev) => {
      const arr = prev[key];
      const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
      return { ...prev, [key]: next };
    });
    setDirty(true);
  }

  function setOverride(bulletId: string, text: string) {
    setTextOverrides((prev) => ({ ...prev, [bulletId]: text }));
    setDirty(true);
  }

  async function doSave(finalTitle: string, folderPath?: string) {
    setSaving(true);
    setSaveError(null);
    try {
      if (!resumeId) {
        const res = await fetch("/api/resumes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: finalTitle, folderPath: folderPath ?? "", selection, textOverrides }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
        const manifest = data as ResumeManifest;
        setResumeId(manifest.id);
        setTitle(manifest.title);
        setMode("edit");
        setLastCompileAt(manifest.lastCompile?.compiledAt ?? manifest.updatedAt);
        setDirty(false);
        setShowSaveModal(false);
        toast.success("Resume saved");
        await refreshTree();
      } else {
        const res = await fetch(`/api/resumes/${resumeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: finalTitle, selection, textOverrides }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
        const manifest = data as ResumeManifest;
        setTitle(manifest.title);
        setLastCompileAt(manifest.lastCompile?.compiledAt ?? manifest.updatedAt);
        setDirty(false);
        toast.success("Resume saved");
        await refreshTree();
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save resume");
    } finally {
      setSaving(false);
    }
  }

  function handleSave() {
    if (saving || !dirty) return;
    if (!resumeId) {
      setShowSaveModal(true);
      return;
    }
    doSave(title);
  }

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (editorView !== "latex" || !resumeId) return;
    let cancelled = false;
    setTexLoading(true);
    setTexContent(null);
    (async () => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}/tex`);
        if (!res.ok) return;
        const text = await res.text();
        if (!cancelled) setTexContent(text);
      } finally {
        if (!cancelled) setTexLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editorView, resumeId, lastCompileAt]);

  if (experienceLoading || treeLoading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>;
  }

  if (experienceError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{experienceError}</p>;
  }

  const certifications = experience.certifications ?? [];
  const skillCategories = Object.keys(experience.technical_skills);
  const jobsIncludedCount = experience.jobs.filter((j) => j.id && selection.jobs[j.id]?.included).length;
  const projectsIncludedCount = experience.projects.filter((p) => p.id && selection.projects[p.id]?.included).length;

  function renderBulletRow(bulletId: string, sourceText: string, checked: boolean, onToggle: () => void) {
    return (
      <div key={bulletId} className="flex items-start gap-2">
        <input type="checkbox" className="mt-2" checked={checked} onChange={onToggle} />
        <textarea
          value={textOverrides[bulletId] ?? sourceText}
          onChange={(e) => setOverride(bulletId, e.target.value)}
          rows={2}
          className={textareaClass}
        />
      </div>
    );
  }

  function renderToc() {
    return (
      <div className="flex flex-col gap-2">
        <TocRow
          label="Contact Info"
          summary={`${selection.contact.length}/${CONTACT_FIELDS.length} fields`}
          onClick={() => setActiveSection("contact")}
        />
        <TocRow
          label="Education"
          summary={`${selection.education.length}/${experience.education.length} included`}
          onClick={() => setActiveSection("education")}
        />
        <TocRow
          label="Work Experience"
          summary={`${jobsIncludedCount}/${experience.jobs.length} included`}
          onClick={() => setActiveSection("jobs")}
        />
        <TocRow
          label="Projects"
          summary={`${projectsIncludedCount}/${experience.projects.length} included`}
          onClick={() => setActiveSection("projects")}
        />
        {certifications.length > 0 && (
          <TocRow
            label="Certifications"
            summary={`${selection.certifications.length}/${certifications.length} included`}
            onClick={() => setActiveSection("certifications")}
          />
        )}
        <TocRow
          label="Technical Skills"
          summary={`${selection.technicalSkillCategories.length}/${skillCategories.length} categories`}
          onClick={() => setActiveSection("skills")}
        />
      </div>
    );
  }

  function renderContactSection() {
    const fieldLabels: Record<(typeof CONTACT_FIELDS)[number], string> = {
      email: "Email",
      linkedin: "LinkedIn",
      github: "GitHub",
      website: "Website",
    };
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Contact Info" onBack={() => setActiveSection("toc")} />
        <p className={simpleRowClass}>
          <span className="font-medium">Name:</span> {experience.meta.name || "(not set)"}{" "}
          <span className="text-xs text-zinc-500 dark:text-zinc-400">— always included</span>
        </p>
        {CONTACT_FIELDS.map((key) => (
          <label key={key} className={simpleRowClass}>
            <input
              type="checkbox"
              checked={selection.contact.includes(key)}
              onChange={() => toggleContact(key)}
            />
            <span className="font-medium">{fieldLabels[key]}:</span>{" "}
            {(experience.meta[key] as string) || "(not set)"}
          </label>
        ))}
      </div>
    );
  }

  function renderEducationSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Education" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {experience.education.map(
            (edu) =>
              edu.id && (
                <label key={edu.id} className={simpleRowClass}>
                  <input
                    type="checkbox"
                    checked={selection.education.includes(edu.id)}
                    onChange={() => toggleArrayMember("education", edu.id!)}
                  />
                  {edu.institution || edu.credential || "(untitled)"}
                </label>
              )
          )}
        </div>
      </div>
    );
  }

  function renderJobsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Work Experience" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {experience.jobs.map(
            (job) =>
              job.id && (
                <div key={job.id} className={sectionCardClass}>
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selection.jobs[job.id]?.included ?? false}
                      onChange={() => toggleJob(job.id!, job.bullets.map((b) => b.id))}
                    />
                    {job.company || "(untitled)"} — {job.role}
                  </label>
                  {selection.jobs[job.id]?.included && (
                    <div className="flex flex-col gap-2 pl-6">
                      {job.bullets.map((b) =>
                        renderBulletRow(
                          b.id,
                          b.text,
                          selection.jobs[job.id!]?.bulletIds.includes(b.id) ?? false,
                          () => toggleJobBullet(job.id!, b.id)
                        )
                      )}
                    </div>
                  )}
                </div>
              )
          )}
        </div>
      </div>
    );
  }

  function renderProjectsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Projects" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {experience.projects.map(
            (project) =>
              project.id && (
                <div key={project.id} className={sectionCardClass}>
                  <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    <input
                      type="checkbox"
                      checked={selection.projects[project.id]?.included ?? false}
                      onChange={() => toggleProject(project.id!, project.bullets.map((b) => b.id))}
                    />
                    {project.name || "(untitled)"}
                  </label>
                  {selection.projects[project.id]?.included && (
                    <div className="flex flex-col gap-2 pl-6">
                      {project.bullets.map((b) =>
                        renderBulletRow(
                          b.id,
                          b.text,
                          selection.projects[project.id!]?.bulletIds.includes(b.id) ?? false,
                          () => toggleProjectBullet(project.id!, b.id)
                        )
                      )}
                    </div>
                  )}
                </div>
              )
          )}
        </div>
      </div>
    );
  }

  function renderCertificationsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Certifications" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {certifications.map((cert) => (
            <label key={cert.id} className={simpleRowClass}>
              <input
                type="checkbox"
                checked={selection.certifications.includes(cert.id)}
                onChange={() => toggleArrayMember("certifications", cert.id)}
              />
              {cert.name || "(untitled)"}
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderSkillsSection() {
    return (
      <div className="flex flex-col gap-4">
        <SectionHeader label="Technical Skills" onBack={() => setActiveSection("toc")} />
        <div className="flex flex-col gap-2">
          {skillCategories.map((category) => {
            const entries = experience.technical_skills[category] ?? [];
            return (
              <label key={category} className={cn(simpleRowClass, "items-start")}>
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={selection.technicalSkillCategories.includes(category)}
                  onChange={() => toggleArrayMember("technicalSkillCategories", category)}
                />
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{humanizeSkillCategory(category)}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entries.length > 0 ? entries.map((e) => e.skill).join(", ") : "No skills listed"}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
      style={{ height: "calc(100vh - 220px)", minHeight: 560 }}
    >
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={18} minSize={12} maxSize={32}>
          <ResumeFileBrowser
            tree={tree}
            selectedId={resumeId}
            onOpenResume={openResume}
            onCreateFolder={handleCreateFolder}
            onCreateResume={startCreate}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {mode === "browse" ? (
          <ResizablePanel defaultSize={82} minSize={30}>
            <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500 dark:text-zinc-400">
              Select a saved resume on the left, or click the new-resume button to create one.
            </div>
          </ResizablePanel>
        ) : (
          <>
            <ResizablePanel defaultSize={54} minSize={30}>
              <div className="flex h-full flex-col">
                <div className="flex shrink-0 items-center justify-between gap-4 border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
                  <span className="truncate text-sm text-zinc-700 dark:text-zinc-300">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {title || "New resume"}
                    </span>
                    <span className="mx-1.5 text-zinc-400 dark:text-zinc-600">/</span>
                    {sectionLabels[activeSection]}
                  </span>
                  <ViewToggle value={editorView} onChange={setEditorView} />
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-6">
                  {editorView === "latex" ? (
                    !resumeId ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        Save this resume to generate its LaTeX source.
                      </p>
                    ) : texLoading ? (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
                    ) : texContent ? (
                      <pre className="overflow-x-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                        {texContent}
                      </pre>
                    ) : (
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        This resume hasn&apos;t been compiled yet — save to generate LaTeX.
                      </p>
                    )
                  ) : (
                    <>
                      {activeSection === "toc" && renderToc()}
                      {activeSection === "contact" && renderContactSection()}
                      {activeSection === "education" && renderEducationSection()}
                      {activeSection === "jobs" && renderJobsSection()}
                      {activeSection === "projects" && renderProjectsSection()}
                      {activeSection === "certifications" && renderCertificationsSection()}
                      {activeSection === "skills" && renderSkillsSection()}
                    </>
                  )}
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={28} minSize={20}>
              <aside className="flex h-full flex-col gap-3 overflow-y-auto p-6">
                <div className="flex items-center gap-2">
                  {resumeId ? (
                    <input
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        setDirty(true);
                      }}
                      className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm font-medium text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    />
                  ) : (
                    <p className="flex-1 text-sm text-zinc-500 dark:text-zinc-400">New resume (unsaved)</p>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className={cn(
                      "shrink-0 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50",
                      dirty ? "bg-emerald-600 hover:bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-700"
                    )}
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                </div>

                {saveError && <p className="text-sm text-red-600 dark:text-red-400">{saveError}</p>}

                <div className="aspect-[8.5/11] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
                  {resumeId && lastCompileAt ? (
                    <iframe
                      src={`/api/resumes/${resumeId}/pdf?t=${encodeURIComponent(lastCompileAt)}#toolbar=0&navpanes=0`}
                      className="h-full w-full"
                      title="Resume preview"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Save to generate a preview.
                    </div>
                  )}
                </div>

                {resumeId && (
                  <div className="flex gap-4 text-sm">
                    <a
                      href={`/api/resumes/${resumeId}/pdf?download=1`}
                      className="text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      Download PDF
                    </a>
                    <a
                      href={`/api/resumes/${resumeId}/tex`}
                      className="text-zinc-700 underline hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                    >
                      Download .tex
                    </a>
                  </div>
                )}
              </aside>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {showSaveModal && (
        <ResumeSaveLocationModal
          tree={tree}
          submitting={saving}
          error={saveError}
          onCancel={() => setShowSaveModal(false)}
          onConfirm={(t, folderPath) => doSave(t, folderPath)}
        />
      )}
    </div>
  );
}
