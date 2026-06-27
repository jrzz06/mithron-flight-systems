import { processEditorSubmission } from "@/lib/editor/serialize";
import { sanitizeEditorHtml } from "@/lib/editor/sanitize";

function readOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  if (value === null) return undefined;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
}

export function readEditorDocumentFields(formData: FormData, jsonField: string, htmlField: string) {
  const jsonRaw = readOptionalString(formData, jsonField);
  if (jsonRaw) {
    const processed = processEditorSubmission(jsonRaw);
    return {
      json: processed.json,
      html: processed.html,
      mediaAssetIds: processed.mediaAssetIds
    };
  }

  const html = readOptionalString(formData, htmlField);
  if (html !== undefined) {
    return {
      json: null,
      html: html ? sanitizeEditorHtml(html) : "",
      mediaAssetIds: [] as string[]
    };
  }

  return null;
}
