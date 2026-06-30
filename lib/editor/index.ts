export { sanitizeEditorHtml, sanitizeProductHtml } from "@/lib/editor/sanitize";
export {
  prepareEditorHtmlForDisplay,
  prepareEditorHtmlForSave,
  editorHtmlToPlainText,
  decodeEscapedEditorHtml,
  cleanupEditorHtmlMarkup
} from "@/lib/editor/prepare-html";
export { processEditorSubmission, editorJsonToHtml, parseEditorJson, emptyEditorDocument, htmlToEditorDocument, extractMediaAssetIds } from "@/lib/editor/serialize";
export { readEditorDocumentFields, readRichTextHtmlField } from "@/lib/editor/read-form-content";
export { syncEditorMediaReferences, markRemovedEditorMediaOrphaned } from "@/lib/editor/media-lifecycle";
export type { EditorDocument, EditorRole, EditorAiAction, RichTextEditorFeatures, EditorDocumentRef, ProcessedEditorContent } from "@/lib/editor/types";
