import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("operations operational UX maturity", () => {
  it("turns the operations dashboard into a command center with live operational visibility", () => {
    const operationsPage = source("app/operations/page.tsx");
    const adminService = source("services/admin.ts");
    const shell = source("components/admin/control-shell.tsx");

    expect(shell).toContain("data-control-plane");
    expect(shell).toContain("data-control-shell-header");
    expect(operationsPage).toContain("data-operations-command-center");
    expect(operationsPage).toContain("data-pending-operations-count");
    expect(operationsPage).toContain("data-active-deployments-count");
    expect(operationsPage).toContain("data-unresolved-alerts-count");
    expect(operationsPage).toContain("data-operations-shipment-monitoring");
    expect(operationsPage).toContain("data-operational-timeline");
    expect(operationsPage).toContain("EnterpriseRealtimePanel");
    expect(adminService).toContain("shipments: [] as AdminRow[]");
    expect(adminService).toContain("orders: [] as AdminRow[]");
  });

  it("makes staff tasks actionable with task status, priority, assignment, and reopen controls", () => {
    const tasksPage = source("app/operations/tasks/page.tsx");
    const forms = source("services/enterprise-admin-forms.ts");
    const actions = source("app/operations/actions.ts");

    expect(tasksPage).toContain("AdminFormSection");
    expect(tasksPage).toContain("AdminStickyActionFooter");
    expect(tasksPage).toContain("data-task-dashboard");
    expect(tasksPage).toContain("data-pending-tasks");
    expect(tasksPage).toContain("data-in-progress-tasks");
    expect(tasksPage).toContain("data-completed-tasks");
    expect(tasksPage).toContain("data-overdue-tasks");
    expect(tasksPage).toContain("data-task-priority-indicators");
    expect(tasksPage).toContain("data-task-action-controls");
    expect(tasksPage).toContain("data-task-metadata-grid");
    expect(tasksPage).toContain("data-task-reopen-option");
    expect(forms).toContain("STAFF_TASK_STATUSES");
    expect(actions).toContain("assertStaffTaskStatus");
  });

  it("makes deployment approvals visible with requested enterprise lifecycle states", () => {
    const deploymentsPage = source("app/operations/deployments/page.tsx");
    const forms = source("services/enterprise-admin-forms.ts");
    const actions = source("app/operations/actions.ts");

    expect(deploymentsPage).toContain("data-deployment-command-workflow");
    expect(deploymentsPage).toContain("data-deployment-approval-actions");
    expect(deploymentsPage).toContain("data-deployment-audit-visibility");
    expect(deploymentsPage).toContain("data-deployment-status-pending");
    expect(deploymentsPage).toContain("data-deployment-status-approved");
    expect(deploymentsPage).toContain("data-deployment-status-rejected");
    expect(deploymentsPage).toContain("data-deployment-status-deployed");
    expect(deploymentsPage).toContain("data-deployment-status-rolled-back");
    expect(deploymentsPage).toContain("approver");
    expect(forms).toContain("DEPLOYMENT_REQUEST_STATUSES");
    expect(actions).toContain("assertDeploymentRequestTransition");
  });

  it("couples operations events to notifications without duplicate event spam", () => {
    const operationsPage = source("app/operations/page.tsx");
    const actions = source("app/operations/actions.ts");

    expect(operationsPage).toContain("data-operations-notification-actions");
    expect(operationsPage).toContain("data-notification-unread-state");
    expect(operationsPage).toContain("data-notification-read-state");
    expect(operationsPage).toContain("data-notification-event-categories");
    expect(operationsPage).toContain("data-notification-related-links");
    expect(actions).toContain("createOperationsEventNotification");
    expect(actions).toContain("operations.notification_duplicate");
  });
});
