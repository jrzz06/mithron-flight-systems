import type { JSONContent } from "@tiptap/core";

export type EditorDocument = JSONContent;

export type EditorRole = "admin" | "supplier" | "warehouse";

export type EditorAiAction =
  | "improve"
  | "rewrite"
  | "expand"
  | "shorten"
  | "professional"
  | "marketing"
  | "technical"
  | "translate"
  | "normalize_structure";

export type RichTextEditorFeatures = {
  ai?: boolean;
  media?: boolean;
  fullscreen?: boolean;
  tables?: boolean;
  blocks?: boolean;
};

export type EditorDocumentRef = {
  documentType: string;
  documentId: string;
};

export type ProcessedEditorContent = {
  json: EditorDocument;
  html: string;
  mediaAssetIds: string[];
};
