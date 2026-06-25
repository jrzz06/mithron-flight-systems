"use client";

import LinkExtension from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2, List, ListOrdered, Underline as UnderlineIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function toolbarButtonClass(active: boolean, variant: "light" | "dark") {
  if (variant === "light") {
    return cn(
      "rounded p-1.5 transition-colors",
      active ? "bg-slate-200 text-slate-900" : "text-slate-600 hover:bg-white"
    );
  }

  return cn(
    "rounded p-1.5 transition-colors",
    active ? "bg-[var(--platform-accent-soft)] text-[var(--platform-text-primary)]" : "text-[var(--platform-text-secondary)] hover:bg-[var(--platform-accent-soft)]"
  );
}

export function ProductSimpleRichText({
  name,
  defaultValue = "",
  placeholder = "Describe this product...",
  variant = "light",
  className = ""
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  variant?: "light" | "dark";
  className?: string;
}) {
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false
        }
      }),
      Underline,
      LinkExtension.configure({
        openOnClick: false,
        validate: (url) => /^https?:\/\//i.test(url),
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank"
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content: defaultValue,
    immediatelyRender: false,
    onUpdate: ({ editor: nextEditor }) => {
      setHtml(nextEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "min-h-[140px] max-h-[280px] overflow-y-auto px-3 py-2.5 text-sm leading-6 outline-none",
          "[&_p]:my-1 [&_ul]:my-2 [&_ol]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline",
          variant === "light"
            ? "text-slate-900 [&_.is-editor-empty:first-child::before]:text-slate-400"
            : "text-[var(--platform-text-primary)] [&_.is-editor-empty:first-child::before]:text-[var(--platform-text-muted)]"
        )
      }
    }
  });

  useEffect(() => {
    if (!editor || !defaultValue) return;
    const current = editor.getHTML();
    if (current === "<p></p>" || !current.trim()) {
      editor.commands.setContent(defaultValue, { emitUpdate: true });
    }
  }, [defaultValue, editor]);

  function setLink() {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter link URL", previousUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  if (!editor) {
    return (
      <div
        data-product-rich-text
        className={cn(
          "min-h-[180px] rounded-lg border",
          variant === "light" ? "border-slate-200 bg-white" : "bg-[var(--platform-surface)]",
          className
        )}
      />
    );
  }

  return (
    <div data-product-rich-text data-variant={variant} className={className}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1 rounded-t-[10px] px-2 py-1.5",
          variant === "light" ? "border border-b-0 border-slate-200 bg-slate-50" : "bg-[var(--platform-surface)]"
        )}
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={toolbarButtonClass(editor.isActive("bold"), variant)}
          aria-label="Bold"
          aria-pressed={editor.isActive("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={toolbarButtonClass(editor.isActive("italic"), variant)}
          aria-label="Italic"
          aria-pressed={editor.isActive("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={toolbarButtonClass(editor.isActive("underline"), variant)}
          aria-label="Underline"
          aria-pressed={editor.isActive("underline")}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={setLink}
          className={toolbarButtonClass(editor.isActive("link"), variant)}
          aria-label="Insert link"
          aria-pressed={editor.isActive("link")}
        >
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={toolbarButtonClass(editor.isActive("bulletList"), variant)}
          aria-label="Bulleted list"
          aria-pressed={editor.isActive("bulletList")}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={toolbarButtonClass(editor.isActive("orderedList"), variant)}
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={cn(
          "rounded-b-[10px] focus-within:ring-2 focus-within:ring-[var(--platform-focus-ring)]",
          variant === "light" ? "border border-slate-200 bg-white focus-within:border-slate-400" : "bg-[var(--platform-surface)] focus-within:bg-[var(--platform-accent-soft)]"
        )}
      >
        <EditorContent editor={editor} />
      </div>
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
