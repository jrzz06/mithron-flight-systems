"use client";

import { LoginForm } from "./login-form";

export function LoginFormClient({
  nextPath,
  auditToken
}: {
  nextPath: string;
  auditToken?: string | null;
}) {
  return (
    <LoginForm
      nextPath={nextPath}
      auditToken={auditToken}
    />
  );
}
