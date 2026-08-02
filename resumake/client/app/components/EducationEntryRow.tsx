"use client";

import type { EducationEntry } from "@/lib/types";

interface EducationEntryRowProps {
  education: EducationEntry;
  onChange: (education: EducationEntry) => void;
  onRemove: () => void;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

export default function EducationEntryRow({ education, onChange, onRemove }: EducationEntryRowProps) {
  function set<K extends keyof EducationEntry>(key: K, value: EducationEntry[K]) {
    onChange({ ...education, [key]: value });
  }

  const details = education.details ?? [];

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={education.included !== false}
            onChange={(e) => set("included", e.target.checked)}
          />
          Include in tailored resume
        </label>
        <button
          onClick={onRemove}
          className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Remove education
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          School
          <input
            className={inputClass}
            value={education.institution}
            onChange={(e) => set("institution", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Location
          <input
            className={inputClass}
            value={education.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Degree level
          <input
            className={inputClass}
            value={education.degree_level ?? ""}
            onChange={(e) => set("degree_level", e.target.value || undefined)}
            placeholder="Bachelor's / Master's / Diploma"
          />
        </label>
        <label className={labelClass}>
          Major
          <input
            className={inputClass}
            value={education.major ?? ""}
            onChange={(e) => set("major", e.target.value || undefined)}
          />
        </label>
        <label className={labelClass}>
          Credential (display text)
          <input
            className={inputClass}
            value={education.credential}
            onChange={(e) => set("credential", e.target.value)}
            placeholder="Bachelor of Science - Computer Science"
          />
        </label>
        <label className={labelClass}>
          GPA (if applicable)
          <input
            className={inputClass}
            value={education.gpa ?? ""}
            onChange={(e) => set("gpa", e.target.value || undefined)}
            placeholder="3.8/4.0"
          />
        </label>
        <label className={labelClass}>
          Dates (display text)
          <input
            className={inputClass}
            value={education.dates}
            onChange={(e) => set("dates", e.target.value)}
            placeholder="Aug 2022 - Jul 2026"
          />
        </label>
        <label className={labelClass}>
          Graduation date (month/year)
          <input
            type="month"
            className={inputClass}
            value={education.graduation_date ?? ""}
            onChange={(e) => set("graduation_date", e.target.value || undefined)}
          />
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Details (courses, honors, etc.)
        </p>
        <div className="flex flex-col gap-2">
          {details.map((detail, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputClass}
                value={detail}
                onChange={(e) =>
                  set(
                    "details",
                    details.map((d, di) => (di === i ? e.target.value : d))
                  )
                }
              />
              <button
                onClick={() =>
                  set(
                    "details",
                    details.filter((_, di) => di !== i)
                  )
                }
                className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={() => set("details", [...details, ""])}
            className="self-start rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            + Add detail
          </button>
        </div>
      </div>
    </div>
  );
}
