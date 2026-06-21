"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const CmsVisualWorkspace = dynamic(
  () => import("@/features/admin/cms/cms-visual-workspace").then((module) => module.CmsVisualWorkspace),
  {
    loading: () => (
      <div className="rounded-xl border border-slate-800 bg-[#10151d] px-4 py-10 text-sm text-slate-400">
        Loading advanced CMS editor…
      </div>
    )
  }
);

export function CmsVisualWorkspaceLoader(props: ComponentProps<typeof CmsVisualWorkspace>) {
  return <CmsVisualWorkspace {...props} />;
}
