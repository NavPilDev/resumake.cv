"use client";

import BulletEditor from "@/app/components/BulletEditor";
import type { JobEntry } from "@/lib/types";

interface JobEntryRowProps {
  job: JobEntry;
  onChange: (job: JobEntry) => void;
  onRemove: () => void;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

export default function JobEntryRow({ job, onChange, onRemove }: JobEntryRowProps) {
  function set<K extends keyof JobEntry>(key: K, value: JobEntry[K]) {
    onChange({ ...job, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={job.included !== false}
            onChange={(e) => set("included", e.target.checked)}
          />
          Include in tailored resume
        </label>
        <button
          onClick={onRemove}
          className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Remove job
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Company
          <input className={inputClass} value={job.company} onChange={(e) => set("company", e.target.value)} />
        </label>
        <label className={labelClass}>
          Role / title
          <input className={inputClass} value={job.role} onChange={(e) => set("role", e.target.value)} />
        </label>
        <label className={labelClass}>
          Location
          <input
            className={inputClass}
            value={job.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
          />
        </label>
        <label className={labelClass}>
          Work mode
          <input
            className={inputClass}
            value={job.work_mode ?? ""}
            onChange={(e) => set("work_mode", e.target.value)}
            placeholder="Remote / Hybrid / On-site"
          />
        </label>
        <label className={labelClass}>
          Dates (display text)
          <input
            className={inputClass}
            value={job.dates}
            onChange={(e) => set("dates", e.target.value)}
            placeholder="Jan 2023 - Present"
          />
        </label>
        <label className={labelClass}>
          Hours per week
          <input
            type="number"
            min={0}
            max={168}
            className={inputClass}
            value={job.hours_per_week ?? ""}
            onChange={(e) => set("hours_per_week", e.target.value ? Number(e.target.value) : undefined)}
          />
        </label>
        <label className={labelClass}>
          Start date
          <input
            type="date"
            className={inputClass}
            value={job.start_date ?? ""}
            onChange={(e) => set("start_date", e.target.value || undefined)}
          />
        </label>
        <label className={labelClass}>
          End date
          <input
            type="date"
            className={inputClass}
            value={job.end_date && job.end_date !== "present" ? job.end_date : ""}
            onChange={(e) => set("end_date", e.target.value || undefined)}
            disabled={job.end_date === "present"}
          />
          <label className="mt-1 flex items-center gap-1.5 text-xs font-normal text-zinc-600 dark:text-zinc-400">
            <input
              type="checkbox"
              checked={job.end_date === "present"}
              onChange={(e) => set("end_date", e.target.checked ? "present" : undefined)}
            />
            Currently working here
          </label>
        </label>
      </div>

      <details className="rounded-md border border-zinc-100 p-2 text-sm dark:border-zinc-800">
        <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
          Government position details (pay plan / series / grade)
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={labelClass}>
            Pay plan
            <input
              className={inputClass}
              value={job.pay_plan ?? ""}
              onChange={(e) => set("pay_plan", e.target.value || undefined)}
            />
          </label>
          <label className={labelClass}>
            Series
            <input
              className={inputClass}
              value={job.pay_series ?? ""}
              onChange={(e) => set("pay_series", e.target.value || undefined)}
            />
          </label>
          <label className={labelClass}>
            Grade
            <input
              className={inputClass}
              value={job.pay_grade ?? ""}
              onChange={(e) => set("pay_grade", e.target.value || undefined)}
            />
          </label>
        </div>
      </details>

      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Bullets — what you did, the skills/tools used, and any measurable impact
        </p>
        <BulletEditor bullets={job.bullets} onChange={(bullets) => set("bullets", bullets)} />
      </div>
    </div>
  );
}
