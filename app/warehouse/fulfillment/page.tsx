import Link from "next/link";
import { AdminSection } from "@/components/admin/module-panel";

export const dynamic = "force-dynamic";

const stages = [
  { id: "pick", label: "Pick", description: "Collect items from stock locations.", href: "/warehouse/picking" },
  { id: "pack", label: "Pack", description: "Verify and prepare orders for shipping.", href: "/warehouse/packing" },
  { id: "ship", label: "Ship", description: "Hand off packages to carriers.", href: "/warehouse/dispatch" }
];

export default function FulfillmentPage() {
  return (
    <div className="grid gap-5">
      <AdminSection title="Fulfillment pipeline" description="Move orders through each stage of warehouse fulfillment.">
        <div className="grid gap-3 md:grid-cols-3">
          {stages.map((stage, index) => (
            <Link
              key={stage.id}
              href={stage.href}
              className="mithron-elevated-card mithron-elevated-card--interactive rounded-[var(--platform-radius)] border border-[var(--platform-border)] bg-[var(--platform-surface-muted)] p-4 transition hover:bg-[var(--platform-surface)]"
            >
              <p className="text-xs font-medium text-[var(--platform-text-muted)]">Step {index + 1}</p>
              <p className="mt-1 text-base font-semibold text-[var(--platform-text-primary)]">{stage.label}</p>
              <p className="mt-2 text-sm text-[var(--platform-text-secondary)]">{stage.description}</p>
            </Link>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
