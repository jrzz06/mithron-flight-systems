export { sanitizeEditorHtml, sanitizeProductHtml } from "@/lib/editor/sanitize";
export { processEditorSubmission, editorJsonToHtml, parseEditorJson, emptyEditorDocument, htmlToEditorDocument, extractMediaAssetIds } from "@/lib/editor/serialize";
export { syncEditorMediaReferences, markRemovedEditorMediaOrphaned } from "@/lib/editor/media-lifecycle";
export type { EditorDocument, EditorRole, EditorAiAction, RichTextEditorFeatures, EditorDocumentRef, ProcessedEditorContent } from "@/lib/editor/types";
