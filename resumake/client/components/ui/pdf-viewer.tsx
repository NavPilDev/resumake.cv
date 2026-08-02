"use client";

import { useEffect, useRef, useState } from "react";
import type { ResumeAnchor } from "@/lib/types";

export interface PdfNavigateResult {
  anchor: ResumeAnchor | null;
  line: number | null;
}

interface PdfViewerProps {
  resumeId: string;
  pdfUrl: string;
  /** Called on every double-click with the SyncTeX-resolved result — both
   * fields can independently be null (e.g. a click on whitespace resolves
   * no line at all; a click on preamble/boilerplate resolves a line but no
   * anchor comment precedes it). */
  onNavigate: (result: PdfNavigateResult) => void;
  className?: string;
}

/** Custom pdf.js-based PDF preview, replacing the native browser PDF viewer
 * (a plain <iframe src="...pdf">) so double-clicks can be mapped back to a
 * PDF-space (page, x, y) point — something impossible against the native
 * viewer, which is an opaque non-scriptable embedded application.
 *
 * Renders every page as its own canvas, stacked vertically inside a
 * scrolling viewport sized to exactly one page's aspect ratio (matching the
 * prior iframe's sizing so the rest of the layout — the resizable panel's
 * min-width floor, the aside's flex sizing — is unaffected), the same way
 * the native viewer showed one page-height at a time with vertical scroll
 * for the rest. */
export function PdfViewer({ resumeId, pdfUrl, onNavigate, className }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    setError(null);

    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      try {
        const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
        if (cancelled) return;

        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
          const page = await doc.getPage(pageNumber);
          if (cancelled) return;

          const unscaledViewport = page.getViewport({ scale: 1 });
          const pageWrapper = document.createElement("div");
          pageWrapper.className = "relative w-full";
          if (pageNumber > 1) pageWrapper.style.marginTop = "8px";

          const canvas = document.createElement("canvas");
          canvas.className = "block";
          pageWrapper.appendChild(canvas);
          container.appendChild(pageWrapper);

          const cssWidth = container.clientWidth;
          const scale = cssWidth / unscaledViewport.width;
          const outputScale = window.devicePixelRatio || 1;
          const viewport = page.getViewport({ scale });

          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;

          await page.render({
            canvas,
            viewport,
            transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          }).promise;
          if (cancelled) return;

          canvas.addEventListener("dblclick", async (e) => {
            const rect = canvas.getBoundingClientRect();
            const cssClickX = e.clientX - rect.left;
            const cssClickY = e.clientY - rect.top;
            const pdfX = cssClickX / scale;
            const pdfY = cssClickY / scale;
            try {
              const url = `/api/resumes/${resumeId}/synctex?page=${pageNumber}&x=${pdfX}&y=${pdfY}`;
              const res = await fetch(url);
              const data = await res.json();
              onNavigate({ anchor: data.anchor ?? null, line: data.line ?? null });
            } catch {
              onNavigate({ anchor: null, line: null });
            }
          });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load PDF.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, resumeId, onNavigate]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-red-600 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? "h-full w-full overflow-y-auto"}
    />
  );
}
