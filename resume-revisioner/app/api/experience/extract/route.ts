import { extractExperienceFragment } from "@/lib/experienceExtraction";
import { extractTextFromUpload } from "@/lib/textExtract";
import type { ExtractExperienceResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Accepts multipart/form-data so uploads and pasted text share one parsing
 * path: a `file` field for uploads, or `text` + `sourceLabel` fields for
 * text pasted directly into the UI. */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = form.get("file");
  const pastedText = form.get("text");
  const ollamaModel = form.get("ollamaModel");
  const ollamaHost = form.get("ollamaHost");

  let rawText: string;
  let sourceLabel: string;
  const warnings: string[] = [];

  try {
    if (file instanceof File) {
      const extracted = await extractTextFromUpload(file);
      rawText = extracted.text;
      sourceLabel = file.name;
      if (extracted.truncated) {
        warnings.push(`"${file.name}" was long — only the first part of the text was used.`);
      }
    } else if (typeof pastedText === "string" && pastedText.trim()) {
      rawText = pastedText.trim();
      sourceLabel = "pasted text";
    } else {
      return Response.json({ error: "Provide a file or pasted text." }, { status: 400 });
    }
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to read the upload." },
      { status: 400 }
    );
  }

  if (!rawText.trim()) {
    return Response.json({ error: "No extractable text found in the upload." }, { status: 400 });
  }

  const model = typeof ollamaModel === "string" && ollamaModel.trim() ? ollamaModel.trim() : "llama3.2:3b";
  const host = typeof ollamaHost === "string" && ollamaHost.trim() ? ollamaHost.trim() : undefined;

  try {
    const fragment = await extractExperienceFragment(rawText, sourceLabel, { model, host });
    const payload: ExtractExperienceResponse = {
      fragment,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
    return Response.json(payload);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Ollama extraction request failed." },
      { status: 502 }
    );
  }
}
