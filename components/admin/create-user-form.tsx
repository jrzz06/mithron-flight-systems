"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { OperationalSubmitButton } from "@/components/admin/operational-submit-button";

export type CreateUserFormState = {
  status: "idle" | "success" | "error";
  message: string;
  email?: string;
  temporaryPassword?: string;
  passwordGenerated?: boolean;
};

const initialState: CreateUserFormState = { status: "idle", message: "" };

const roleOptions = [
  { value: "admin", label: "Admin" },
  { value: "warehouse", label: "Warehouse" },
  { value: "supplier", label: "Supplier" },
  { value: "user", label: "User" }
] as const;

function compactActionClass(tone: "default" | "success" = "default") {
  if (tone === "success") {
    return "inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-950/25 px-3 text-sm font-semibold text-emerald-200 hover:bg-emerald-950/45";
  }
  return "inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-[#10151d] px-3 text-sm font-semibold text-slate-100 hover:border-slate-600";
}

function feedbackClass(status: CreateUserFormState["status"]) {
  if (status === "success") return "border-emerald-500/30 bg-emerald-950/30 text-emerald-100";
  if (status === "error") return "border-rose-500/30 bg-rose-950/30 text-rose-100";
  return "";
}

export function CreateUserForm({
  action
}: {
  action: (prevState: CreateUserFormState, formData: FormData) => Promise<CreateUserFormState>;
}) {
  const router = useRouter();
  const feedbackRef = useRef<HTMLDivElement>(null);
  const [state, formAction] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "idle") return;
    feedbackRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} data-user-create-form className="grid gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-100">Create User</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">Add a user directly with one clear role.</p>
      </div>
      <input
        name="email"
        type="email"
        required
        autoComplete="off"
        placeholder="name@company.com"
        className="h-10 rounded-lg border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
      />
      <input
        name="display_name"
        autoComplete="off"
        placeholder="Display name (optional)"
        className="h-10 rounded-lg border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
      />
      <select
        name="role_key"
        defaultValue="warehouse"
        className="h-10 rounded-lg border border-slate-700 bg-[#0c1118] px-3 text-sm text-slate-100 outline-none focus:border-emerald-500/70"
      >
        {roleOptions.map((role) => (
          <option key={role.value} value={role.value}>{role.label}</option>
        ))}
      </select>
      <input
        name="temporary_password"
        type="text"
        minLength={8}
        autoComplete="new-password"
        placeholder="Temporary password (optional — auto-generated if empty)"
        className="h-10 rounded-lg border border-slate-700 bg-[#10151d] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
      />
      <p className="text-xs leading-5 text-slate-500">
        Share this exact password with the user for /login. If left empty, Mithron generates one and displays it after creation.
      </p>
      {state.status !== "idle" ? (
        <div
          ref={feedbackRef}
          role={state.status === "error" ? "alert" : "status"}
          data-user-create-feedback={state.status}
          className={`rounded-lg border px-3 py-2.5 text-sm leading-6 ${feedbackClass(state.status)}`}
        >
          {state.status === "success" ? "User created — " : "Could not create user — "}
          {state.message}
          {state.status === "success" && state.email && state.temporaryPassword ? (
            <div className="mt-3 rounded-lg border border-emerald-500/20 bg-black/20 p-3 text-xs leading-6 text-emerald-50">
              <p className="font-semibold uppercase tracking-[0.08em] text-emerald-200">Login credentials</p>
              <p className="mt-2"><span className="text-emerald-300/80">Email:</span> {state.email}</p>
              <p><span className="text-emerald-300/80">Password:</span> {state.temporaryPassword}</p>
              <p className="mt-2 text-emerald-300/70">
                {state.passwordGenerated ? "Auto-generated password — copy it now. It will not be shown again." : "Use this password at /login."}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      <OperationalSubmitButton pendingLabel="Creating" className={compactActionClass("success")}>
        Create user
      </OperationalSubmitButton>
    </form>
  );
}
