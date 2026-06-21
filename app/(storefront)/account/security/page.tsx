import {
  defaultPathForRole,
  isControlPanelRole,
  workspaceLabelForRole
} from "@/lib/auth/access-control";
import { getCurrentAuthContext } from "@/services/auth";
import { SecurityPanel } from "./security-panel";

export default async function AccountSecurityPage() {
  const context = await getCurrentAuthContext();
  const role = context.role ?? "user";
  const isStaff = isControlPanelRole(role);
  const workspaceHref = isStaff ? defaultPathForRole(role) : null;
  const workspaceLabel = workspaceLabelForRole(role);

  return (
    <SecurityPanel
      workspaceHref={workspaceHref}
      workspaceLabel={workspaceLabel}
      isStaff={isStaff}
    />
  );
}
