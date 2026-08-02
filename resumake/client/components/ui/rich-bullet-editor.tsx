"use client";

import { useEffect, useRef } from "react";
import { rawToHtml, htmlToRaw } from "@/lib/bulletRichText";
import { cn } from "@/lib/utils";

interface RichBulletEditorProps {
  value: string;
  onChange: (nextRaw: string) => void;
  bulletId: string;
  title?: string;
  className?: string;
}

/** ContentEditable bullet field: shows real bold/italic/underline instead of
 * the raw \textbf{}/\textit{}/\underline{} commands the Ctrl+B/Ctrl+I/Ctrl+U
 * shortcuts insert (those stay visible only in the LaTeX view) — see
 * lib/bulletRichText.ts for the HTML<->raw-text conversion. Only re-syncs
 * its innerHTML from the `value` prop when that value didn't originate from
 * this element's own last onInput, so the caret doesn't jump mid-keystroke. */
export function RichBulletEditor({ value, onChange, bulletId, title, className }: RichBulletEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (value !== lastEmittedRef.current) {
      ref.current.innerHTML = rawToHtml(value);
      lastEmittedRef.current = value;
    }
  }, [value]);

  function handleInput() {
    if (!ref.current) return;
    const nextRaw = htmlToRaw(ref.current);
    lastEmittedRef.current = nextRaw;
    onChange(nextRaw);
  }

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      data-bullet-id={bulletId}
      title={title}
      className={cn(
        "min-h-[3rem] overflow-y-auto whitespace-pre-wrap break-words outline-none",
        className
      )}
    />
  );
}
