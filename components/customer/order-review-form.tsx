"use client";

import { useState } from "react";

export function OrderReviewForm({
  orderId,
  productSlug,
  productName,
  disabled,
  existingStatus
}: {
  orderId: string;
  productSlug: string;
  productName: string;
  disabled?: boolean;
  existingStatus?: string | null;
}) {
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  if (existingStatus) {
    return (
      <p className="text-sm text-white/60">
        Review submitted ({existingStatus.replaceAll("_", " ")}).
      </p>
    );
  }

  if (disabled) {
    return <p className="text-sm text-white/50">Reviews unlock after delivery.</p>;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("loading");
    setMessage(null);
    const formData = new FormData();
    formData.set("orderId", orderId);
    formData.set("productSlug", productSlug);
    formData.set("rating", String(rating));
    formData.set("body", body);
    const response = await fetch("/api/account/reviews", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus("error");
      setMessage(typeof payload.error === "string" ? payload.error : "Review submission failed.");
      return;
    }
    setStatus("done");
    setMessage(`Thanks for reviewing ${productName}. Your review is pending moderation.`);
  }

  if (status === "done") {
    return <p className="text-sm text-emerald-400">{message}</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 border-t border-[var(--surface-border)] pt-4">
      <p className="text-sm font-medium text-white/80">Review {productName}</p>
      <label className="grid gap-2 text-sm text-white/70">
        Rating
        <select
          value={rating}
          onChange={(event) => setRating(Number(event.target.value))}
          className="w-24 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-3 py-2 text-white"
        >
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>{value} stars</option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm text-white/70">
        Your review
        <textarea
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-page)] px-4 py-3 text-white"
        />
      </label>
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex h-10 w-fit items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-medium text-black disabled:opacity-60"
      >
        {status === "loading" ? "Submitting…" : "Submit review"}
      </button>
      {status === "error" && message ? <p className="text-sm text-red-400">{message}</p> : null}
    </form>
  );
}
