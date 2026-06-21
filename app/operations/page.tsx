import { ControlShell } from "@/components/admin/control-shell";
import { EnterpriseRealtimePanel } from "@/components/admin/enterprise-realtime-panel";
import { DataList, OperationalFeedback, StatusBadge } from "@/components/admin/module-panel";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";
import { getOperationsSnapshot } from "@/services/admin";
import { createOperationsNotificationFormAction } from "./actions";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function feedbackPath(status: "success" | "error" | "warning", message: string) {
  return `/operations?operation_status=${status}&operation_message=${encodeURIComponent(message)}`;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : "The operations notification action failed.";
}

function recordStatus(record: Record<string, unknown>, fallback: string) {
  return String(record.status ?? fallback);
}

function recordTimestamp(record: Record<string, unknown>) {
  return String(record.updated_at ?? record.created_at ?? "");
}

function notificationTargetHref(notification: Record<string, unknown>) {
  const table = String(notification.entity_table ?? "");
  const id = String(notification.entity_id ?? "");
  if (table === "orders") return `/operations/orders?q=${encodeURIComponent(id)}`;
  if (table === "deployment_requests") return "/operations/deployments";
  if (table === "staff_tasks") return "/operations/tasks";
  if (table === "shipments") return "/operations/orders";
  return "/operations";
}

async function createOperationsNotificationWithFeedback(formData: FormData) {
  "use server";
  try {
    await createOperationsNotificationFormAction(formData);
  } catch (error) {
    redirect(feedbackPath("error", messageFromError(error)));
  }
  redirect(feedbackPath("success", "Notification persisted or safely deduplicated."));
}

export default async function OperationsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const snapshot = await getOperationsSnapshot();
  const params = searchParams ? await searchParams : {};
  const operationStatus = searchValue(params, "operation_status");
  const operationMessage = searchValue(params, "operation_message");
  const unreadNotifications = snapshot.data.notifications.filter((notification) => recordStatus(notification, "unread") === "unread");
  const readNotifications = snapshot.data.notifications.filter((notification) => recordStatus(notification, "unread") === "read");
  const unresolvedAlerts = snapshot.data.notifications.filter((notification) => (
    recordStatus(notification, "unread") === "unread"
    && /high|critical/.test(String(notification.priority ?? "normal"))
  ));
  const pendingOperationsCount = snapshot.data.requests.filter((request) => /pending|triaged/.test(recordStatus(request, "pending"))).length
    + snapshot.data.tasks.filter((task) => recordStatus(task, "open") === "open").length;
  const activeDeploymentsCount = snapshot.data.requests.filter((request) => /approved|scheduled|deployed/.test(recordStatus(request, "pending"))).length;
  const blockedWorkCount = snapshot.data.requests.filter((request) => /blocked|escalated|rejected|rolled_back/.test(recordStatus(request, "pending"))).length
    + snapshot.data.tasks.filter((task) => recordStatus(task, "open") === "blocked").length;
  const shipmentRows = snapshot.data.shipments.slice(0, 6).map((shipment) => ({
    label: String(shipment.shipment_number ?? shipment.id ?? "shipment"),
    value: String(shipment.shipment_status ?? shipment.status ?? "pending"),
    detail: `${String(shipment.carrier_name ?? "carrier pending")} | tracking ${String(shipment.tracking_number ?? "n/a")} | updated ${recordTimestamp(shipment) || "n/a"}`
  }));
  const notificationCategoryRows = ["orders", "shipments", "deployment_requests", "staff_tasks"].map((table) => ({
    label: table,
    value: String(snapshot.data.notifications.filter((notification) => String(notification.entity_table ?? "") === table).length),
    detail: "Operations event category volume"
  }));
  const notificationRows = snapshot.data.notifications.slice(0, 8).map((notification) => ({
    label: String(notification.title ?? notification.id ?? "notification"),
    value: String(notification.status ?? "unread"),
    detail: `${String(notification.priority ?? "normal")} | ${String(notification.entity_table ?? "operations")}:${String(notification.entity_id ?? "n/a")} | ${String(notification.created_at ?? "no timestamp")}`
  }));
  const activityRows = snapshot.data.activity.slice(0, 8).map((activity) => ({
    label: String(activity.action ?? "activity_logs"),
    value: String(activity.severity ?? "info"),
    detail: `${String(activity.entity_table ?? "entity")} | ${String(activity.entity_id ?? "n/a")} | ${String(activity.created_at ?? "no timestamp")}`
  }));
  const timelineRows = [
    ...snapshot.data.activity.map((activity) => ({
      type: String(activity.action ?? "activity"),
      value: String(activity.severity ?? "info"),
      timestamp: recordTimestamp(activity),
      detail: `${String(activity.entity_table ?? "entity")} ${String(activity.entity_id ?? "n/a")}`
    })),
    ...snapshot.data.notifications.map((notification) => ({
      type: String(notification.title ?? "notification"),
      value: String(notification.priority ?? "normal"),
      timestamp: recordTimestamp(notification),
      detail: `${String(notification.entity_table ?? "operations")} ${String(notification.entity_id ?? "n/a")}`
    })),
    ...snapshot.data.requests.map((request) => ({
      type: `deployment_request.${recordStatus(request, "pending")}`,
      value: String(request.priority ?? "normal"),
      timestamp: recordTimestamp(request),
      detail: `${String(request.requester_email ?? "requester")} ${String(request.region ?? "region")}`
    })),
    ...snapshot.data.tasks.map((task) => ({
      type: `staff_task.${recordStatus(task, "open")}`,
      value: String(task.priority ?? "normal"),
      timestamp: recordTimestamp(task),
      detail: `${String(task.title ?? "task")} assigned ${String(task.assigned_to ?? "unassigned")}`
    }))
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 10).map((event) => ({
    label: event.type,
    value: event.value,
    detail: `${event.timestamp || "no timestamp"} | ${event.detail}`
  }));

  return (
    <div data-operations-route>
      <ControlShell
      scope="operations"
      eyebrow="Operations"
      title="Deployment workflows."
      description={snapshot.blockedReason ?? "Admins can monitor deployment requests, assigned tasks, and field work without exposing this surface as a separate role."}
      metrics={[
        { label: "Routes", value: String(snapshot.data.routes.length) },
        { label: "Requests", value: String(snapshot.data.requests.length) },
        { label: "Tasks", value: String(snapshot.data.tasks.length) }
      ]}
      actions={[
        { label: "Orders", href: "/operations/orders" },
        { label: "Deployments", href: "/operations/deployments" },
        { label: "Tasks", href: "/operations/tasks" },
        { label: "Notifications", href: "/operations/notifications" }
      ]}
      >
      <div className="grid gap-8">
        <EnterpriseRealtimePanel scope="operations" />

        <OperationalFeedback
          status={operationStatus}
          message={operationMessage}
          context="Operations"
          idle="Notification, request, and task workflow results appear here."
        />

        <section data-operations-command-center className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Operations command center</p>
          <div className="grid gap-2 md:grid-cols-4">
            <div data-pending-operations-count className="rounded-xl border border-white/10 bg-black/18 p-3">
              <StatusBadge status="pending" />
              <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{pendingOperationsCount}</p>
              <p className="mt-1 text-xs text-white/42">Open task and request workload</p>
            </div>
            <div data-active-deployments-count className="rounded-xl border border-white/10 bg-black/18 p-3">
              <StatusBadge status="deployed" />
              <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{activeDeploymentsCount}</p>
              <p className="mt-1 text-xs text-white/42">Approved, scheduled, or deployed requests</p>
            </div>
            <div data-unresolved-alerts-count className="rounded-xl border border-white/10 bg-black/18 p-3">
              <StatusBadge status={unresolvedAlerts.length || blockedWorkCount ? "warning" : "verified"} />
              <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{unresolvedAlerts.length + blockedWorkCount}</p>
              <p className="mt-1 text-xs text-white/42">Unread critical alerts and blocked work</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/18 p-3">
              <StatusBadge status="live" />
              <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{snapshot.data.shipments.length}</p>
              <p className="mt-1 text-xs text-white/42">Shipment rows visible to operations</p>
            </div>
          </div>
        </section>

        <section data-operations-notification-center className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Notification center</p>
          <div className="grid gap-2 md:grid-cols-3">
            <div data-notification-unread-state className="rounded-xl border border-white/10 bg-black/18 p-3">
              <StatusBadge status="unread" />
              <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{unreadNotifications.length}</p>
            </div>
            <div data-notification-read-state className="rounded-xl border border-white/10 bg-black/18 p-3">
              <StatusBadge status="read" />
              <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{readNotifications.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/18 p-3">
              <StatusBadge status="critical" />
              <p className="mt-3 font-[var(--type-display)] text-2xl font-semibold text-white">{unresolvedAlerts.length}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-8 lg:grid-cols-2">
          <section data-notification-event-categories className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Event categories</p>
            <DataList rows={notificationCategoryRows} />
          </section>
          <section data-notification-related-links className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Related entity links</p>
            <div className="grid gap-2">
              {snapshot.data.notifications.slice(0, 6).map((notification) => (
                <Link
                  key={String(notification.id ?? notification.title ?? notification.created_at)}
                  href={notificationTargetHref(notification)}
                  className="rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/72 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {String(notification.title ?? "notification")} {"->"} {String(notification.entity_table ?? "operations")}
                </Link>
              ))}
              {!snapshot.data.notifications.length ? <p className="text-sm text-white/42">No notification links yet.</p> : null}
            </div>
          </section>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Notifications</p>
            <DataList rows={notificationRows.length ? notificationRows : [{ label: "notifications", value: "0", detail: "No operational notifications yet." }]} />
          </section>
          <section className="grid gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Activity logs</p>
            <DataList rows={activityRows.length ? activityRows : [{ label: "activity_logs", value: "0", detail: "No operational activity rows yet." }]} />
          </section>
        </div>

        <section data-operations-shipment-monitoring className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Shipment monitoring</p>
          <DataList rows={shipmentRows.length ? shipmentRows : [{ label: "shipments", value: "0", detail: "No shipment rows are currently visible to operations." }]} />
        </section>

        <section data-operational-timeline className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7ce7c9]">Operational timeline</p>
          <DataList rows={timelineRows.length ? timelineRows : [{ label: "operations.timeline", value: "0", detail: "No operational events yet." }]} />
        </section>

        <form action={createOperationsNotificationWithFeedback} data-operations-notification-actions data-notifications-table="notifications" className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Title</span>
              <input name="title" defaultValue="" placeholder="Deployment escalated" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Channel</span>
              <input name="channel" defaultValue="operations" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Priority</span>
              <select name="priority" defaultValue="normal" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none">
                <option value="low">low</option>
                <option value="normal">normal</option>
                <option value="high">high</option>
                <option value="critical">critical</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Recipient ID</span>
              <input name="recipient_id" defaultValue="" placeholder="optional user uuid" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Entity table</span>
              <input name="entity_table" defaultValue="deployment_requests" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none" />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-white/70">Entity ID</span>
              <input name="entity_id" defaultValue="" placeholder="related row id" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
            </label>
          </div>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Body</span>
            <input name="body" defaultValue="" placeholder="Critical field deployment needs approval." className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Delivery details</span>
            <textarea name="payload" defaultValue="{}" rows={4} className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 font-mono text-xs text-white outline-none" />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="text-white/70">Change summary</span>
            <input name="change_summary" defaultValue="" placeholder="Create operations notification" className="rounded-xl border border-white/10 bg-white/[0.055] px-3 py-2 text-white outline-none placeholder:text-white/30" />
          </label>
          <OperationalSubmitButton pendingLabel="Creating notification">
            Create notification
          </OperationalSubmitButton>
        </form>
      </div>
      </ControlShell>
    </div>
  );
}
