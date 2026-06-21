import { sanitizeProductPreviewText } from "@/lib/product-preview-text";

const SPEC_TOKEN_PATTERN = /(?:UAV Type|UAV Category|Endurance|Range|Maximum|Operating|Wind Resistance|All-Up-Weight|Payload|Battery|Flight Time)/i;

const KNOWN_SPEC_LABELS = [
  "Operating Altitude",
  "Maximum Operating Altitude",
  "Maximum All-Up-Weight",
  "Maximum Takeoff Weight",
  "Wind Resistance",
  "Maximum Speed",
  "Range (LoS)",
  "Range",
  "Endurance",
  "UAV Category",
  "UAV Type",
  "Payload Capacity",
  "Payload",
  "Battery Capacity",
  "Battery",
  "Flight Time",
  "Dimensions",
  "Weight"
];

const SPEC_DISPLAY_ORDER = [
  "UAV Type",
  "UAV Category",
  "Endurance",
  "Range (LoS)",
  "Range",
  "Maximum All-Up-Weight",
  "Maximum Takeoff Weight",
  "Wind Resistance",
  "Maximum Speed",
  "Operating Altitude",
  "Maximum Operating Altitude",
  "Payload Capacity",
  "Payload",
  "Battery Capacity",
  "Battery",
  "Flight Time",
  "Dimensions",
  "Weight"
];

function canonicalSpecLabel(label: string) {
  const match = KNOWN_SPEC_LABELS.find((known) => known.toLowerCase() === label.trim().toLowerCase());
  return match ?? label.trim();
}

function insertKnownSpecBoundaries(text: string) {
  let normalized = text;
  const labels = [...KNOWN_SPEC_LABELS].sort((left, right) => right.length - left.length);

  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    normalized = normalized.replace(new RegExp(`([a-z0-9)])(?=${escaped}:)`, "i"), "$1 ");
  }

  return normalized.replace(/\s+/g, " ").trim();
}

function parseGenericSpecPairs(normalized: string) {
  const pattern = /([A-Z][A-Za-z0-9\s\-\/\(\)]{1,40}):\s*/g;
  const matches = [...normalized.matchAll(pattern)];
  if (matches.length < 2) return {};

  const pairs: Record<string, string> = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = canonicalSpecLabel(match[1] ?? "");
    if (!key) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? normalized.length) : normalized.length;
    const value = normalized.slice(start, end).trim();
    if (value) pairs[key] = value;
  }

  return pairs;
}

export function formatAvailability(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "In stock";
  if (/^instock$/i.test(trimmed.replace(/\s+/g, ""))) return "In stock";
  if (/^outofstock$/i.test(trimmed.replace(/\s+/g, ""))) return "Out of stock";
  return trimmed;
}

export function isSpecLikeBlob(text: string) {
  const clean = sanitizeProductPreviewText(text);
  if (!clean) return false;

  const colonMatches = clean.match(/[A-Za-z][A-Za-z0-9\s\-\/\(\)]{0,48}:\s*/g) ?? [];
  if (colonMatches.length >= 3) return true;

  return SPEC_TOKEN_PATTERN.test(clean) && colonMatches.length >= 2;
}

export function parseInlineSpecPairs(text: string) {
  const normalized = insertKnownSpecBoundaries(sanitizeProductPreviewText(text));
  if (!normalized) return {};

  const labels = [...KNOWN_SPEC_LABELS].sort((left, right) => right.length - left.length);
  const pattern = new RegExp(
    `(${labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}):\\s*`,
    "gi"
  );

  const matches = [...normalized.matchAll(pattern)];
  if (!matches.length) return parseGenericSpecPairs(normalized);

  const pairs: Record<string, string> = {};
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const key = canonicalSpecLabel(match[1] ?? "");
    if (!key) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? normalized.length) : normalized.length;
    const value = normalized.slice(start, end).trim();
    if (value) pairs[key] = value;
  }

  return Object.keys(pairs).length ? pairs : parseGenericSpecPairs(normalized);
}

export function sortSpecEntries(entries: Array<[string, string]>) {
  const rank = (key: string) => {
    const normalized = key.trim().toLowerCase();
    const ordered = SPEC_DISPLAY_ORDER.findIndex((item) => item.toLowerCase() === normalized);
    return ordered >= 0 ? ordered : SPEC_DISPLAY_ORDER.length + normalized.charCodeAt(0);
  };

  return [...entries].sort(([leftKey], [rightKey]) => rank(leftKey) - rank(rightKey));
}
