import { AdminRecordConflictError } from "@/services/admin-actions";

export const RECORD_CONFLICT_RELOAD_HINT =
  "Reload the page to fetch the latest values, then save again.";

export function readExpectedUpdatedAt(formData: FormData, fallback?: string | null) {
  const value = formData.get("expected_updated_at");
  const fromForm = typeof value === "string" && value.trim() ? value.trim() : null;
  return fromForm ?? fallback ?? null;
}

export function readOptionalExpectedUpdatedAt(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isRecordConflictError(error: unknown): error is AdminRecordConflictError {
  return error instanceof AdminRecordConflictError;
}

export function recordConflictMessage(error: unknown) {
  if (!isRecordConflictError(error)) return null;
  return error.message.trim() || "This record was updated by someone else.";
}

export function operationalFeedbackFromActionError(error: unknown): {
  status: "error" | "warning";
  message: string;
} {
  const conflictMessage = recordConflictMessage(error);
  if (conflictMessage) {
    return {
      status: "warning",
      message: `${conflictMessage} ${RECORD_CONFLICT_RELOAD_HINT}`
    };
  }

  return {
    status: "error",
    message: error instanceof Error ? error.message : String(error)
  };
}

export function inventoryFeedbackQueryParams(error: unknown) {
  const feedback = operationalFeedbackFromActionError(error);
  return new URLSearchParams({
    inventory_status: feedback.status === "warning" ? "conflict" : "error",
    inventory_message: feedback.message.slice(0, 240)
  });
}
