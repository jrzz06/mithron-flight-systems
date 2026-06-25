"use client";

import { useState } from "react";

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
      setMessage(typeof payload.error === "string" ? payload.error : "Return request failed.");
      return;
    }
    setStatus("done");
    setMessage("Return request submitted. We will email you when it is reviewed.");
    setReason("");
  }

  if (disabled) {
    return <p className="text-sm text-white/50">Returns are available after delivery.</p>;
  }

  if (status === "done") {
    return <p className="text-sm text-emerald-400">{message}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <label className="grid gap-2 text-sm text-white/70">
        Reason for return
        <textarea
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3 text-white"
          placeholder="Describe the issue or reason for return"
        />
      </label>
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex h-10 w-fit items-center justify-center rounded-xl border border-white/15 px-4 text-sm text-white transition hover:bg-white/5 disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Request return"}
      </button>
      {status === "error" && message ? <p className="text-sm text-red-400">{message}</p> : null}
    </form>
  );
}
