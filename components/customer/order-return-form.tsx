"use client";

import { useState } from "react";
import { AccountField, AccountTextarea } from "@/components/account";
import { Button } from "@/components/ui/button";

export function OrderReturnForm({ orderId, orderItemId, disabled }: { orderId: string; orderItemId?: string; disabled?: boolean }) {
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    if (orderItemId) formData.set("orderItemId", orderItemId);
    formData.set("reason", reason);
    const response = await fetch("/api/account/returns", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(typeof payload.error === "string" ? payload.error : "We couldn't submit your return request. Please try again.");
      return;
    }
    setStatus("done");
    setMessage("Your return request has been submitted. We'll email you when it's reviewed.");
    setReason("");
  }

  if (disabled) {
    return <p className="text-sm text-[var(--account-ink-muted)]">Returns are available after delivery.</p>;
  }

  if (status === "done") {
    return <p className="text-sm text-[var(--account-accent)]">{message}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <AccountField label="Reason for return">
        <AccountTextarea
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          placeholder="Tell us why you'd like to return this order"
        />
      </AccountField>
      <Button type="submit" disabled={status === "loading"} variant="outline" size="sm">
        {status === "loading" ? "Submitting…" : "Request return"}
      </Button>
      {status === "error" && message ? <p className="text-sm text-[var(--account-danger)]">{message}</p> : null}
    </form>
  );
}
