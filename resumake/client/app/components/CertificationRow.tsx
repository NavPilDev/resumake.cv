"use client";

import type { Certification } from "@/lib/types";

interface CertificationRowProps {
  certification: Certification;
  onChange: (certification: Certification) => void;
  onRemove: () => void;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";
const labelClass = "flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400";

export default function CertificationRow({ certification, onChange, onRemove }: CertificationRowProps) {
  function set<K extends keyof Certification>(key: K, value: Certification[K]) {
    onChange({ ...certification, [key]: value });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={certification.included !== false}
            onChange={(e) => set("included", e.target.checked)}
          />
          Include in tailored resume
        </label>
        <button
          onClick={onRemove}
          className="text-xs text-red-600 underline hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
        >
          Remove certification
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Name
          <input className={inputClass} value={certification.name} onChange={(e) => set("name", e.target.value)} />
        </label>
        <label className={labelClass}>
          Issuer
          <input
            className={inputClass}
            value={certification.issuer ?? ""}
            onChange={(e) => set("issuer", e.target.value || undefined)}
          />
        </label>
        <label className={labelClass}>
          Date earned
          <input
            type="month"
            className={inputClass}
            value={certification.date ?? ""}
            onChange={(e) => set("date", e.target.value || undefined)}
          />
        </label>
        <label className={labelClass}>
          Expiration date
          <input
            type="month"
            className={inputClass}
            value={certification.expiration_date ?? ""}
            onChange={(e) => set("expiration_date", e.target.value || undefined)}
          />
        </label>
        <label className={labelClass}>
          Credential ID
          <input
            className={inputClass}
            value={certification.credential_id ?? ""}
            onChange={(e) => set("credential_id", e.target.value || undefined)}
          />
        </label>
      </div>
    </div>
  );
}
