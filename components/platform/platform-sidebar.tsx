import Link from "next/link";
import { PlatformNav } from "@/components/platform/platform-nav";
import type { PlatformNavGroup, PlatformScope } from "@/components/platform/types";

type PlatformSidebarProps = {
  scope: PlatformScope;
  groups: PlatformNavGroup[];
  scopeBadge?: string;
  accentClass?: string;
  homeHref?: string;
};

export function PlatformSidebar({
  scope,
  groups,
  scopeBadge,
  accentClass,
  homeHref = "/"
}: PlatformSidebarProps) {
  return (
    <aside className="border-b border-[var(--platform-border)] bg-[var(--platform-surface)] px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:h-screen lg:w-[240px] lg:overflow-y-auto lg:overscroll-contain lg:border-b-0 lg:border-r">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={homeHref}
          className="text-base font-semibold tracking-tight text-[var(--platform-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600/40"
        >
          Mithron
        </Link>
        {scopeBadge ? (
          <span className="rounded-full border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--platform-text-muted)]">
            {scopeBadge}
          </span>
        ) : null}
      </div>
      <div className="mt-5">
        <PlatformNav groups={groups} accentClass={accentClass} />
      </div>
    </aside>
  );
}
