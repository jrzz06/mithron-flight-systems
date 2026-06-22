type FeedbackBannerProps = {
  status?: string | null;
  message?: string | null;
  context?: string;
  idle?: string;
};

export function FeedbackBanner({
  status,
  message,
  context = "Update",
  idle = "Changes and validation messages will appear here."
}: FeedbackBannerProps) {
  const normalizedStatus =
    status === "success" || status === "error" || status === "warning" || status === "conflict"
      ? status === "conflict"
        ? "warning"
        : status
      : "idle";
  const tone =
    normalizedStatus === "success"
      ? "border-teal-200 bg-teal-50 text-teal-900"
      : normalizedStatus === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : normalizedStatus === "error"
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-[var(--platform-border)] bg-[var(--platform-surface-muted)] text-[var(--platform-text-muted)]";

  return (
    <div
      aria-live="polite"
      role={normalizedStatus === "idle" ? "status" : "alert"}
      data-operational-feedback={normalizedStatus}
      className={`rounded-[var(--platform-radius)] border px-4 py-3 text-sm ${tone}`}
    >
      {normalizedStatus === "idle" ? (
        idle
      ) : (
        <>
          <span className="font-semibold">
            {status === "conflict"
              ? "Conflict detected"
              : normalizedStatus === "success"
                ? "Saved"
                : normalizedStatus === "warning"
                  ? "Needs review"
                  : "Something went wrong"}
          </span>
          {message ? <span className="ml-2">{context}: {message}</span> : null}
        </>
      )}
    </div>
  );
}
