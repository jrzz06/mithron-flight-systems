import { generateHTML } from "@tiptap/html";
import type { JSONContent } from "@tiptap/core";
import { createEditorExtensions } from "@/lib/editor/extensions";
import { sanitizeEditorHtml } from "@/lib/editor/sanitize";

export function editorJsonToHtml(json: JSONContent | null | undefined) {
  if (!json) return "";
  const html = generateHTML(json, createEditorExtensions());
  return sanitizeEditorHtml(html);
}

export function parseEditorJson(value: string | JSONContent | null | undefined): JSONContent | null {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value) as JSONContent;
  } catch {
    return null;
  }
}

export function emptyEditorDocument(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

export function htmlToEditorDocument(html: string): JSONContent {
  const trimmed = html.trim();
  if (!trimmed) return emptyEditorDocument();
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: trimmed.replace(/<[^>]+>/g, " ") }]
      }
    ]
  };
}

export function extractMediaAssetIds(json: JSONContent | null | undefined): string[] {
  const ids = new Set<string>();

  function walk(node: JSONContent) {
    if (node.type === "image" && node.attrs?.mediaAssetId) {
      ids.add(String(node.attrs.mediaAssetId));
    }
    node.content?.forEach(walk);
  }

  if (json) walk(json);
  return Array.from(ids);
}

export function processEditorSubmission(
  jsonInput: string | JSONContent | null | undefined
): { json: JSONContent; html: string; mediaAssetIds: string[] } {
  const json = parseEditorJson(jsonInput) ?? emptyEditorDocument();
  const html = editorJsonToHtml(json);
  const mediaAssetIds = extractMediaAssetIds(json);
  return { json, html, mediaAssetIds };
}
