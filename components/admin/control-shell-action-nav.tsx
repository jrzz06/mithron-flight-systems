"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ControlShellAction = {
  label: string;
  href: string;
};

function isActivePath(pathname: string, href: string) {
  const baseHref = href.split("#")[0] || href;
  return pathname === baseHref || pathname.startsWith(`${baseHref}/`);
}

export function ControlShellActionNav({ actions }: { actions: ControlShellAction[] }) {
  const pathname = usePathname();
  if (!actions.length) return null;

  return (
    <nav data-control-shell-action-nav className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const active = isActivePath(pathname, action.href);
        return (
          <Link
            key={action.href}
            href={action.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "border-slate-700 bg-[#151c26] text-slate-100"
                : "border-slate-800 bg-[#10151d] text-slate-300 hover:bg-[#151c26] hover:text-slate-100"
            }`}
          >
            {action.label}
          </Link>
        );
      })}
    </nav>
  );
}
