import { redirect } from "next/navigation";
import { ModulePanel } from "@/components/admin/module-panel";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { UserGovernanceFeedback } from "@/components/admin/user-governance-feedback";
import { type CreateUserFormState } from "@/components/admin/create-user-form";
import { normalizeCmsRole } from "@/lib/auth/permissions";
import { getUserGovernanceSnapshot } from "@/services/admin";
import {
  assignManagedUserRoleAction,
  createManagedUserAction,
  disableManagedUserAction,
  invalidateManagedInviteAction,
  inviteManagedUserAction,
  reactivateManagedUserAction,
  removeManagedUserAction,
  resetManagedUserPasswordAction
} from "@/app/admin/settings/actions";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ManagedRole = "admin" | "warehouse" | "supplier" | "user";

function searchValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function actionMessage(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 240);
}

function usersFeedbackUrl(status: "success" | "error" | "warning", message: string) {
  return `/admin/users?user_status=${status}&user_message=${encodeURIComponent(message)}`;
}

function normalizedRoleValue(value: unknown): ManagedRole {
  return normalizeCmsRole(value) ?? "user";
}

const hiddenOperatorEmailPatterns = [
  /^verifier\+/i,
  /^validation\+/i,
  /^audit\+/i,
  /@example\.com$/i,
  /@mithron\.test$/i
];

function isOperatorVisibleUser(user: { email: string }) {
  const email = user.email.toLowerCase();
  return !hiddenOperatorEmailPatterns.some((pattern) => pattern.test(email));
}

async function createUserFormAction(_prev: CreateUserFormState, formData: FormData): Promise<CreateUserFormState> {
  "use server";
  try {
    const created = await createManagedUserAction(formData);
    return {
      status: "success",
      message: `${created.email} was added with the ${created.role} role and login was verified.`,
      email: created.email,
      temporaryPassword: created.temporaryPassword,
      passwordGenerated: created.passwordGenerated
    };
  } catch (error) {
    return { status: "error", message: actionMessage(error) };
  }
}

async function resetPasswordWithFeedback(formData: FormData) {
  "use server";
  try {
    const reset = await resetManagedUserPasswordAction(formData);
    redirect(usersFeedbackUrl("success", `New password set for ${reset.email}. Share it with the user for /login.`));
  } catch (error) {
    redirect(usersFeedbackUrl("error", actionMessage(error)));
  }
}

async function inviteUserWithFeedback(formData: FormData) {
  "use server";
  try {
    await inviteManagedUserAction(formData);
  } catch (error) {
    redirect(usersFeedbackUrl("error", actionMessage(error)));
  }
  redirect(usersFeedbackUrl("success", "Invite sent."));
}

async function assignRoleWithFeedback(formData: FormData) {
  "use server";
  try {
    await assignManagedUserRoleAction(formData);
  } catch (error) {
    redirect(usersFeedbackUrl("error", actionMessage(error)));
  }
  redirect(usersFeedbackUrl("success", "User role updated."));
}

async function disableUserWithFeedback(formData: FormData) {
  "use server";
  try {
    await disableManagedUserAction(formData);
  } catch (error) {
    redirect(usersFeedbackUrl("error", actionMessage(error)));
  }
  redirect(usersFeedbackUrl("success", "User disabled."));
}

async function reactivateUserWithFeedback(formData: FormData) {
  "use server";
  try {
    await reactivateManagedUserAction(formData);
  } catch (error) {
    redirect(usersFeedbackUrl("error", actionMessage(error)));
  }
  redirect(usersFeedbackUrl("success", "User reactivated."));
}

async function removeUserWithFeedback(formData: FormData) {
  "use server";
  try {
    await removeManagedUserAction(formData);
  } catch (error) {
    redirect(usersFeedbackUrl("error", actionMessage(error)));
  }
  redirect(usersFeedbackUrl("success", "User removed."));
}

async function invalidateInviteWithFeedback(formData: FormData) {
  "use server";
  try {
    await invalidateManagedInviteAction(formData);
  } catch (error) {
    redirect(usersFeedbackUrl("error", actionMessage(error)));
  }
  redirect(usersFeedbackUrl("success", "Invite invalidated."));
}

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const access = await getUserGovernanceSnapshot();
  const params = searchParams ? await searchParams : {};
  const userStatus = searchValue(params, "user_status");
  const userMessage = searchValue(params, "user_message");
  const users = access.data.users
    .filter(isOperatorVisibleUser)
    .map((user) => {
      const role = normalizedRoleValue(user.roles[0] ?? user.default_role);
      return {
        id: user.id,
        email: user.email,
        name: user.display_name || user.email,
        role,
        status: user.status,
        lastLogin: user.last_sign_in_at,
        createdAt: user.created_at,
        bannedUntil: user.banned_until
      };
    });

  return (
    <ModulePanel
      eyebrow="Team access"
      title="Users."
      description={access.blockedReason ?? "Manage real Supabase Auth users, role assignment, account status, and invites."}
      status={access.status}
      metrics={[
        { label: "Team members", value: String(users.length) },
        { label: "Roles", value: "admin, warehouse, supplier, user" }
      ]}
    >
      <div data-user-management-shell className="grid gap-4">
        <UserGovernanceFeedback
          status={userStatus}
          message={userMessage}
        />
        <div data-user-operational-feedback className="sr-only" aria-hidden="true" />
        {!users.length ? (
          <div className="rounded-xl border border-slate-800 bg-[#10151d] p-4 text-sm text-slate-400">No team members yet</div>
        ) : null}
        <UserManagementPanel
          users={users}
          invites={access.data.invites.slice(0, 12)}
          activity={[]}
          createUserFormAction={createUserFormAction}
          inviteUserAction={inviteUserWithFeedback}
          resetPasswordAction={resetPasswordWithFeedback}
          assignRoleAction={assignRoleWithFeedback}
          disableUserAction={disableUserWithFeedback}
          reactivateUserAction={reactivateUserWithFeedback}
          removeUserAction={removeUserWithFeedback}
          invalidateInviteAction={invalidateInviteWithFeedback}
        />
      </div>
    </ModulePanel>
  );
}
