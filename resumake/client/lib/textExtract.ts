import type { ExperienceSourceKind } from "./types";

/** Soft cap on extracted text so a huge PDF can't blow out the Ollama
 * prompt/context window or the request timeout. */
const MAX_CHARS = 20_000;

export interface UploadedFileLike {
  name: string;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

export interface ExtractedUploadText {
  text: string;
  sourceKind: ExperienceSourceKind;
  truncated: boolean;
}

function capText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_CHARS), truncated: true };
}

/** Extracts raw text from an uploaded PDF/Markdown/JSON file, ahead of
 * Ollama structured extraction. Branches on file extension rather than
 * browser-supplied MIME type, which is unreliable for .md files. */
export async function extractTextFromUpload(file: UploadedFileLike): Promise<ExtractedUploadText> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());

  if (ext === "md" || ext === "txt") {
    const { text, truncated } = capText(buffer.toString("utf8"));
    return { text, sourceKind: "markdown", truncated };
  }

  if (ext === "json") {
    const { text, truncated } = capText(buffer.toString("utf8"));
    return { text, sourceKind: "json", truncated };
  }

  if (ext === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      const { text, truncated } = capText(result.text);
      return { text, sourceKind: "pdf", truncated };
    } finally {
      await parser.destroy();
    }
  }

  throw new Error(`Unsupported file type ".${ext || "?"}" — upload a PDF, Markdown, or JSON file.`);
}
