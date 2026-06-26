"use client";

import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { Bold, Italic, Link2, Underline } from "lucide-react";

export function EditorBubbleMenu({ editor }: { editor: Editor }) {
  return (
    <BubbleMenu
      editor={editor}
      className="flex items-center gap-1 rounded-[10px] border border-[var(--platform-border)] bg-[var(--platform-surface-raised)] p-1 shadow-[var(--platform-shadow-md)]"
    >
      <button type="button" aria-label="Bold" className="platform-btn-ghost platform-btn-sm !min-h-8 !w-8 !px-0" onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Italic" className="platform-btn-ghost platform-btn-sm !min-h-8 !w-8 !px-0" onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button type="button" aria-label="Underline" className="platform-btn-ghost platform-btn-sm !min-h-8 !w-8 !px-0" onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label="Link"
        className="platform-btn-ghost platform-btn-sm !min-h-8 !w-8 !px-0"
        onClick={() => {
          const url = window.prompt("Enter link URL (https://)", "https://");
          if (!url?.trim()) return;
          if (!/^https?:\/\//i.test(url.trim())) {
            window.alert("Only http and https links are allowed.");
            return;
          }
          editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
        }}
      >
        <Link2 className="h-3.5 w-3.5" />
      </button>
    </BubbleMenu>
  );
}
