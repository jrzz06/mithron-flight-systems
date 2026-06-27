"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { LogoutForm } from "@/components/auth/logout-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type AccountNavLink = {
  href: string;
  label: string;
};

type AccountNavProps = {
  links: AccountNavLink[];
  workspaceHref?: string | null;
  workspaceLabel?: string;
  showLogout?: boolean;
  mode?: "desktop" | "mobile";
};

function isActivePath(pathname: string, href: string) {
  if (href === "/account") return pathname === "/account";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  links,
  pathname,
  workspaceHref,
  workspaceLabel,
  showLogout
}: {
  links: AccountNavLink[];
  pathname: string;
  workspaceHref?: string | null;
  workspaceLabel?: string;
  showLogout?: boolean;
}) {
  return (
    <nav aria-label="Account navigation" className="grid gap-1">
      {links.map((link) => {
        const active = isActivePath(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center rounded-xl border-l-2 px-4 py-2.5 text-sm font-medium transition",
              active
                ? "border-[var(--account-accent)] bg-[var(--account-surface-muted)] text-[var(--account-ink)]"
                : "border-transparent text-[var(--account-ink-muted)] hover:bg-[var(--account-surface-muted)] hover:text-[var(--account-ink)]"
            )}
          >
            {link.label}
          </Link>
        );
      })}
      {workspaceHref && workspaceLabel ? (
        <Button asChild className="mt-2">
          <Link href={workspaceHref}>Open {workspaceLabel}</Link>
        </Button>
      ) : null}
      {showLogout ? (
        <LogoutForm
          buttonClassName="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--account-border-strong)] bg-transparent px-3 py-2 text-sm font-medium text-[var(--account-ink-muted)] transition hover:bg-[var(--account-surface-muted)] hover:text-[var(--account-ink)]"
        />
      ) : null}
    </nav>
  );
}

export function AccountNav({
  links,
  workspaceHref,
  workspaceLabel,
  showLogout = true,
  mode = "desktop"
}: AccountNavProps) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (mode === "mobile") {
    return (
      <>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="account-mobile-nav"
          aria-label={open ? "Close account menu" : "Open account menu"}
          onClick={() => setOpen((value) => !value)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--account-border)] bg-[var(--account-surface)] text-[var(--account-ink)]"
        >
          {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
        </button>

        {open ? (
          <div className="fixed inset-0 z-50 lg:hidden" role="presentation">
            <button
              type="button"
              aria-label="Close account menu"
              className="absolute inset-0 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <aside
              id="account-mobile-nav"
              data-account-drawer
              className="absolute inset-y-0 left-0 w-[min(88vw,320px)] border-r border-[var(--account-border)] bg-[var(--account-surface)] p-4 shadow-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--account-ink)]">Menu</p>
                <button
                  type="button"
                  aria-label="Close account menu"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--account-border)]"
                >
                  <X className="size-5" aria-hidden />
                </button>
              </div>
              <NavLinks
                links={links}
                pathname={pathname}
                workspaceHref={workspaceHref}
                workspaceLabel={workspaceLabel}
                showLogout={showLogout}
              />
            </aside>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <aside className="hidden h-fit lg:sticky lg:top-24 lg:block">
      <div className="rounded-2xl border border-[var(--account-border)] bg-[var(--account-surface)] p-4">
        <NavLinks
          links={links}
          pathname={pathname}
          workspaceHref={workspaceHref}
          workspaceLabel={workspaceLabel}
          showLogout={showLogout}
        />
      </div>
    </aside>
  );
}
