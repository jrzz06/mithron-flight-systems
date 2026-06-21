import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

/** @deprecated Use formatINR instead. */
export const formatUsd = formatINR;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
