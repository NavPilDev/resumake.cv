"use client";

import { useState } from "react";
import { humanizeSkillCategory, slugifySkillCategory } from "@/lib/technicalSkillCategory";
import type { TechnicalSkillEntry, TechnicalSkills } from "@/lib/types";

interface TechnicalSkillsSectionProps {
  technicalSkills: TechnicalSkills;
  onChange: (technicalSkills: TechnicalSkills) => void;
}

const inputClass =
  "rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const addButtonClass =
  "self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800";

export default function TechnicalSkillsSection({ technicalSkills, onChange }: TechnicalSkillsSectionProps) {
  const [skillDrafts, setSkillDrafts] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState("");

  const categories = Object.keys(technicalSkills);

  function addSkill(category: string) {
    const draft = (skillDrafts[category] ?? "").trim();
    if (!draft) return;
    const existing = technicalSkills[category] ?? [];
    if (existing.some((s) => s.skill.toLowerCase() === draft.toLowerCase())) {
      setSkillDrafts((prev) => ({ ...prev, [category]: "" }));
      return;
    }
    const entry: TechnicalSkillEntry = { skill: draft, source: "manual" };
    onChange({ ...technicalSkills, [category]: [...existing, entry] });
    setSkillDrafts((prev) => ({ ...prev, [category]: "" }));
  }

  function removeSkill(category: string, index: number) {
    onChange({ ...technicalSkills, [category]: (technicalSkills[category] ?? []).filter((_, i) => i !== index) });
  }

  function removeCategory(category: string) {
    const next = { ...technicalSkills };
    delete next[category];
    onChange(next);
  }

  function addCategory() {
    const key = slugifySkillCategory(newCategory);
    if (!key) return;
    if (!technicalSkills[key]) onChange({ ...technicalSkills, [key]: [] });
    setNewCategory("");
  }

  return (
    <div className="flex flex-col gap-4">
      {categories.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No skill categories yet — add one below (e.g. &quot;Languages&quot;, &quot;Frameworks &amp; Tools&quot;).
        </p>
      )}

      {categories.map((category) => {
        const skills = technicalSkills[category] ?? [];
        return (
          <div key={category} id={`exp-skill-cat-${category}`} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{humanizeSkillCategory(category)}</p>
              <button
                onClick={() => removeCategory(category)}
                className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove category
              </button>
            </div>

            {skills.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {skills.map((s, si) => (
                  <span
                    key={`${s.skill}-${si}`}
                    className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                  >
                    {s.skill}
                    <button
                      onClick={() => removeSkill(category, si)}
                      className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                      aria-label={`Remove ${s.skill}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                className={`${inputClass} w-56`}
                placeholder="Add a skill and press Enter"
                value={skillDrafts[category] ?? ""}
                onChange={(e) => setSkillDrafts((prev) => ({ ...prev, [category]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSkill(category);
                  }
                }}
              />
              <button onClick={() => addSkill(category)} className={addButtonClass}>
                + Add skill
              </button>
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <input
          className={`${inputClass} w-56`}
          placeholder="New category (e.g. Languages)"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCategory();
            }
          }}
        />
        <button onClick={addCategory} className={addButtonClass}>
          + Add category
        </button>
      </div>
    </div>
  );
}
