import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutForm } from "@/components/auth/logout-form";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import {
  defaultPathForRole,
  isControlPanelRole,
  workspaceLabelForRole
} from "@/lib/auth/access-control";
import { getCurrentAuthContext } from "@/services/auth";

export const dynamic = "force-dynamic";

const customerLinks = [
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/enquiries", label: "Enquiries" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/security", label: "Security" }
];

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const context = await getCurrentAuthContext();
  if (!context.userId) redirect("/login?next=/account");

  const role = context.role ?? "user";
  const userId = context.userId;
  const isStaff = isControlPanelRole(role);
  const workspaceHref = isStaff ? defaultPathForRole(role) : null;
  const hubLabel = workspaceLabelForRole(role);
  const navLinks = isStaff
    ? [{ href: "/account/security", label: "Security" }]
    : customerLinks;

  return (
    <main className="surface-page min-h-screen px-6 py-28 md:px-16">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="type-meta text-white/50">{isStaff ? "Workspace access" : "Account"}</p>
            <h1 className="type-section mt-2">{hubLabel}</h1>
            {isStaff ? (
              <p className="mt-2 max-w-2xl text-sm text-white/60">
                Signed in as {role}. Use your workspace for day-to-day operations. This area is only for security settings.
              </p>
            ) : null}
          </div>
          {userId ? <NotificationBell recipientId={userId} href={workspaceHref ?? "/account"} /> : null}
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="grid h-fit gap-2 rounded-[24px] border border-[var(--surface-border)] bg-[var(--surface-card)] p-4">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="rounded-xl px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5">
                {link.label}
              </Link>
            ))}
            {workspaceHref ? (
              <Button asChild className="mt-2">
                <Link href={workspaceHref}>Open workspace</Link>
              </Button>
            ) : null}
            <LogoutForm
              buttonClassName="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-[var(--surface-border)] bg-transparent px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/5"
            />
          </aside>
          <section>{children}</section>
        </div>
      </div>
    </main>
  );
}
