"use client";

import { useEffect, useRef } from "react";
import { hydrateEditorAtomBlocks } from "@/lib/editor/hydrate-rendered-content";
import { cn } from "@/lib/utils";

export function EditorRenderedContent({
  html,
  className
}: {
  html: string;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;
    hydrateEditorAtomBlocks(rootRef.current);
  }, [html]);

  return (
    <div
      ref={rootRef}
      className={cn("editor-rendered-content", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
