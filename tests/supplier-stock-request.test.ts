import { describe, expect, it } from "vitest";
import { parseRequestedStockQuantity } from "@/lib/supplier/stock-request-validation";
import { assessStockRequestReviewFlags } from "@/services/supplier-stock-request-review";

describe("supplier stock request validation", () => {
  it("accepts non-negative integers only", () => {
    expect(parseRequestedStockQuantity("0")).toBe(0);
    expect(parseRequestedStockQuantity("42")).toBe(42);
  });

  it("rejects missing, decimal, and negative values", () => {
    expect(() => parseRequestedStockQuantity("")).toThrow("Enter the available stock quantity.");
    expect(() => parseRequestedStockQuantity("12.5")).toThrow("whole number");
    expect(() => parseRequestedStockQuantity("-1")).toThrow("whole number");
    expect(() => parseRequestedStockQuantity("abc")).toThrow("whole number");
  });
});

describe("stock request review flags", () => {
  it("flags large increases and unpublished products", () => {
    const flags = assessStockRequestReviewFlags({
      requestedQuantity: 500,
      liveQuantity: 10,
      snapshotQuantity: 10,
      workflowStatus: "pending_review"
    });

    expect(flags.some((flag) => flag.message.includes("workflow status"))).toBe(true);
    expect(flags.some((flag) => flag.message.includes("5×"))).toBe(true);
  });

  it("flags catalog stock drift since submission", () => {
    const flags = assessStockRequestReviewFlags({
      requestedQuantity: 20,
      liveQuantity: 8,
      snapshotQuantity: 12,
      workflowStatus: "published"
    });

    expect(flags.some((flag) => flag.message.includes("changed since submission"))).toBe(true);
  });
});
