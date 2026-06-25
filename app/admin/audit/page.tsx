import { DataList, ModulePanel } from "@/components/admin/module-panel";
import { connectivityMessage } from "@/lib/platform/copy";
import { getAuditObservabilitySnapshot } from "@/services/admin";

export const dynamic = "force-dynamic";

type AuditRow = Record<string, unknown>;

function formatDate(value: unknown) {
  return typeof value === "string" && value ? new Date(value).toLocaleString() : "not recorded";
}

function detailFromMetadata(row: AuditRow) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
    ? row.metadata as Record<string, unknown>
    : {};
  const actorRole = metadata.actor_role ? `role ${String(metadata.actor_role)}` : null;
  const reason = metadata.denial_reason ? `reason ${String(metadata.denial_reason)}` : null;
  const summary = metadata.change_summary ? `summary ${String(metadata.change_summary)}` : null;
  return [actorRole, reason, summary, formatDate(row.created_at)].filter(Boolean).join(" | ");
}

function listRows(rows: AuditRow[], fallback: string) {
  if (!rows.length) {
    return [{ label: fallback, value: "0", detail: "No rows loaded for this feed yet." }];
  }

  return rows.slice(0, 8).map((row) => ({
    label: String(row.action ?? row.event_type ?? row.title ?? row.entity_table ?? "audit event"),
    value: String(row.severity ?? row.status ?? row.priority ?? "recorded"),
    detail: detailFromMetadata(row)
  }));
}

export default async function AuditPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const snapshot = await getAuditObservabilitySnapshot();
  const params = searchParams ? await searchParams : {};
  const severityFilter = typeof params.severity === "string" ? params.severity : "";
  const securityEvents = severityFilter
    ? snapshot.data.securityEvents.filter((row) => String(row.severity ?? "") === severityFilter)
    : snapshot.data.securityEvents;
  const metric = (table: string) => snapshot.data.metrics.find((item) => item.table === table);

  return (
    <div data-admin-audit-route>
      <ModulePanel
        eyebrow="System diagnostics"
        title="System Diagnostics"
        description={connectivityMessage(snapshot.blockedReason) || "Security events, auth activity, denied actions, and audit records for technical review."}
        status={snapshot.status}
        metrics={[
          { label: "Audit rows", value: String(metric("audit_logs")?.count ?? 0) },
          { label: "Activity rows", value: String(metric("activity_logs")?.count ?? 0) },
          { label: "Security events", value: String(metric("security_events")?.count ?? 0) }
        ]}
      >
        <div className="grid gap-5 xl:grid-cols-2">
        <section data-security-events-feed className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Security events</h2>
            <form className="flex items-center gap-2">
              <select name="severity" defaultValue={severityFilter} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-xs text-white">
                <option value="">All severities</option>
                <option value="info">info</option>
                <option value="warning">warning</option>
                <option value="critical">critical</option>
              </select>
              <button type="submit" className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white/80">Filter</button>
            </form>
          </div>
          <div className="mt-4">
            <DataList rows={listRows(securityEvents, "security_events")} />
          </div>
        </section>

        <section data-auth-events-feed className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Auth events</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.authEvents, "auth activity")} />
          </div>
        </section>

        <section data-denied-action-feed className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Denied action feed</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.deniedActions, "denied actions")} />
          </div>
        </section>

        <section data-rest-rls-denials-feed className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">REST/RLS denials</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.restDenials, "REST/RLS denials")} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Privilege escalation attempts</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.privilegeEscalations, "privilege escalation attempts")} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Realtime anomalies</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.realtimeAnomalies, "realtime anomalies")} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Auth anomaly feed</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.authAnomalies, "auth anomalies")} />
          </div>
        </section>

        <section data-governance-timeline-feed className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Governance timeline</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.governanceTimeline, "governance timeline")} />
          </div>
        </section>

        <section data-product-activity-feed className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Product activity</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.productActivity, "product activity")} />
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-black/18 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-white/68">Notification evidence</h2>
          <div className="mt-4">
            <DataList rows={listRows(snapshot.data.notifications, "notifications")} />
          </div>
        </section>
        </div>
      </ModulePanel>
    </div>
  );
}
