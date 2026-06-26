"use client";

import type { Editor } from "@tiptap/react";
import type { EditorAiAction } from "@/lib/editor/types";

const AI_ACTIONS: Array<{ id: EditorAiAction; label: string }> = [
  { id: "improve", label: "Improve writing" },
  { id: "rewrite", label: "Rewrite" },
  { id: "expand", label: "Expand" },
  { id: "shorten", label: "Shorten" },
  { id: "professional", label: "Professional tone" },
  { id: "marketing", label: "Marketing tone" },
  { id: "technical", label: "Technical tone" },
  { id: "translate", label: "Translate" }
];

export async function runEditorAiAction(editor: Editor, action: EditorAiAction) {
  const { from, to } = editor.state.selection;
  const selectedText = editor.state.doc.textBetween(from, to, " ").trim();
  if (!selectedText) {
    window.alert("Select text before using AI assistance.");
    return;
  }

  const response = await fetch("/api/editor/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, text: selectedText })
  });

  const payload = (await response.json()) as { text?: string; error?: string };
  if (!response.ok || !payload.text) {
    window.alert(payload.error ?? "AI assistance is unavailable.");
    return;
  }

  editor.chain().focus().insertContentAt({ from, to }, payload.text).run();
}

export function EditorAiMenu({ editor }: { editor: Editor }) {
  return (
    <div className="flex flex-wrap gap-1 border-t border-[var(--platform-border)] px-2 py-2">
      {AI_ACTIONS.map((action) => (
        <button
          key={action.id}
          type="button"
          className="platform-btn-ghost platform-btn-sm"
          onClick={() => void runEditorAiAction(editor, action.id)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
