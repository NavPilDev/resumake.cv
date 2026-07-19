"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ResumeFileBrowser } from "@/app/components/ResumeFileBrowser";
import { ResumeSaveLocationModal } from "@/app/components/ResumeSaveLocationModal";
import { humanizeSkillCategory } from "@/lib/technicalSkillCategory";
import { cn } from "@/lib/utils";
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
  return { jobs: {}, projects: {}, education: [], certifications: [], technicalSkillCategories: [] };
}

const sectionCardClass =
  "flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950";

export default function ResumesBuilder() {
  const [experience, setExperience] = useState<ExperienceData>(EMPTY_EXPERIENCE);
  const [experienceLoading, setExperienceLoading] = useState(true);
  const [experienceError, setExperienceError] = useState<string | null>(null);

  const [tree, setTree] = useState<ResumeTreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);

  const [mode, setMode] = useState<"browse" | "create" | "edit">("browse");
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

  if (experienceLoading || treeLoading) {
    return <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading…</p>;
  }

  if (experienceError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{experienceError}</p>;
  }

  const certifications = experience.certifications ?? [];

  return (
    <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800" style={{ minHeight: 640 }}>
      <div className="h-[70vh] w-64 shrink-0">
        <ResumeFileBrowser
          tree={tree}
          selectedId={resumeId}
          onOpenResume={openResume}
          onCreateFolder={handleCreateFolder}
          onCreateResume={startCreate}
        />
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {mode === "browse" && (
          <div className="flex h-full items-center justify-center text-center text-sm text-zinc-500 dark:text-zinc-400">
            Select a saved resume on the left, or click the new-resume button to create one.
          </div>
        )}

        {mode !== "browse" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Work Experience</h3>
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
                              {job.bullets.map((b) => {
                                const checked = selection.jobs[job.id!]?.bulletIds.includes(b.id) ?? false;
                                return (
                                  <div key={b.id} className="flex flex-col gap-1">
                                    <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                      <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        checked={checked}
                                        onChange={() => toggleJobBullet(job.id!, b.id)}
                                      />
                                      <span>{b.text}</span>
                                    </label>
                                    {checked && (
                                      <textarea
                                        value={textOverrides[b.id] ?? b.text}
                                        onChange={(e) => setOverride(b.id, e.target.value)}
                                        rows={2}
                                        className="ml-6 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Projects</h3>
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
                              {project.bullets.map((b) => {
                                const checked = selection.projects[project.id!]?.bulletIds.includes(b.id) ?? false;
                                return (
                                  <div key={b.id} className="flex flex-col gap-1">
                                    <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                                      <input
                                        type="checkbox"
                                        className="mt-0.5"
                                        checked={checked}
                                        onChange={() => toggleProjectBullet(project.id!, b.id)}
                                      />
                                      <span>{b.text}</span>
                                    </label>
                                    {checked && (
                                      <textarea
                                        value={textOverrides[b.id] ?? b.text}
                                        onChange={(e) => setOverride(b.id, e.target.value)}
                                        rows={2}
                                        className="ml-6 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Education</h3>
                <div className="flex flex-col gap-2">
                  {experience.education.map(
                    (edu) =>
                      edu.id && (
                        <label
                          key={edu.id}
                          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                        >
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

              {certifications.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Certifications</h3>
                  <div className="flex flex-col gap-2">
                    {certifications.map((cert) => (
                      <label
                        key={cert.id}
                        className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                      >
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
              )}

              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Technical Skills</h3>
                <div className="flex flex-col gap-2">
                  {Object.keys(experience.technical_skills).map((category) => (
                    <label
                      key={category}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200"
                    >
                      <input
                        type="checkbox"
                        checked={selection.technicalSkillCategories.includes(category)}
                        onChange={() => toggleArrayMember("technicalSkillCategories", category)}
                      />
                      {humanizeSkillCategory(category)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <aside className="sidebar-scroll flex flex-col gap-3 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
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
                    src={`/api/resumes/${resumeId}/pdf?t=${encodeURIComponent(lastCompileAt)}`}
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
          </div>
        )}
      </div>

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
