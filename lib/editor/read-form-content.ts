import { processEditorSubmission } from "@/lib/editor/serialize";
import { prepareEditorHtmlForSave } from "@/lib/editor/prepare-html";

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
      html: html ? prepareEditorHtmlForSave(html) : "",
      mediaAssetIds: [] as string[]
    };
  }

  return null;
}

export function readRichTextHtmlField(
  formData: FormData,
  htmlKey: string,
  options?: { required?: boolean; label?: string }
) {
  const fromEditor = readEditorDocumentFields(formData, `${htmlKey}_json`, htmlKey);
  if (fromEditor) {
    if (options?.required && !fromEditor.html) {
      throw new Error(`${options.label ?? htmlKey} is required.`);
    }
    return fromEditor.html;
  }

  const value = formData.get(htmlKey);
  if (typeof value !== "string" || !value.trim()) {
    if (options?.required) {
      throw new Error(`${options.label ?? htmlKey} is required.`);
    }
    return "";
  }

  return prepareEditorHtmlForSave(value.trim());
}
