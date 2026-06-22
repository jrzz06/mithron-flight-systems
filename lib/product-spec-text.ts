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

const HIGHLIGHT_VALUE_MAX = 56;

function dedupeSpecEntries(entries: Array<[string, string]>) {
  const seen = new Map<string, string>();
  for (const [key, value] of entries) {
    const normalizedKey = canonicalSpecLabel(key);
    const trimmedValue = value.trim();
    if (!normalizedKey || !trimmedValue) continue;
    if (!seen.has(normalizedKey) || seen.get(normalizedKey)!.length < trimmedValue.length) {
      seen.set(normalizedKey, trimmedValue);
    }
  }
  return [...seen.entries()];
}

function extractLeadingMetrics(text: string): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  const flightTime = text.match(/\b(\d+\s*mins?)\b/i);
  if (flightTime) pairs.push(["Flight Time", flightTime[1]]);
  const speed = text.match(/(?:speeds? up to|up to)\s*(\d+(?:\.\d+)?\s*km\/h)/i);
  if (speed) pairs.push(["Maximum Speed", speed[1]]);
  const battery = text.match(/(\d+\s*x\s*\d+\s*mAh(?:\s*batteries?)?)/i);
  if (battery) pairs.push(["Battery", battery[1]]);
  const storage = text.match(/(\d+\s*GB\s*SD(?:\s*slot)?)/i);
  if (storage) pairs.push(["Storage", storage[1]]);
  const warranty = text.match(/(\d+[\s-]*Year(?:s)?\s+Warranty)/i);
  if (warranty) pairs.push(["Warranty", warranty[1]]);
  return pairs;
}

function parseMarketingFeatureSections(text: string): Array<[string, string]> {
  const pattern = /([A-Z][A-Za-z0-9\s\-/&]+):\s*/g;
  const matches = [...text.matchAll(pattern)];
  if (matches.length < 2) return [];

  const sections: Array<[string, string]> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const label = canonicalSpecLabel(match[1] ?? "");
    if (!label || label.length < 3 || label.length > 48) continue;

    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    let body = text.slice(start, end).trim();
    body = body.replace(/^[.,\s]+/, "").replace(/[.,\s]+$/, "");
    if (body.length < 8) continue;
    sections.push([label, body]);
  }

  return sections;
}

function shouldExpandSpecValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > HIGHLIGHT_VALUE_MAX || isSpecLikeBlob(trimmed) || parseMarketingFeatureSections(trimmed).length >= 2;
}

function isKnownSpecLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  return KNOWN_SPEC_LABELS.some((known) => known.toLowerCase() === normalized);
}

export function expandSpecEntries(entries: Array<[string, string]>) {
  const expanded: Array<[string, string]> = [];

  for (const [key, rawValue] of entries) {
    const value = sanitizeProductPreviewText(rawValue).trim();
    if (!value) continue;

    const inline = parseInlineSpecPairs(value);
    const inlineEntries = Object.entries(inline);
    if (inlineEntries.length >= 2 && inlineEntries.every(([label]) => isKnownSpecLabel(label))) {
      expanded.push(...inlineEntries);
      continue;
    }

    const marketing = parseMarketingFeatureSections(value);
    if (marketing.length >= 2 || (inlineEntries.length >= 2 && !inlineEntries.every(([label]) => isKnownSpecLabel(label)))) {
      expanded.push(...extractLeadingMetrics(value));
      expanded.push(...(marketing.length >= 2 ? marketing : inlineEntries));
      continue;
    }

    if (shouldExpandSpecValue(value)) {
      const metrics = extractLeadingMetrics(value);
      if (metrics.length) {
        expanded.push(...metrics);
      }

      const intro = value.split(/[A-Z][A-Za-z0-9\s\-/&]+:/)[0]?.trim().replace(/[.,\s]+$/, "");
      if (intro && intro.length > 20 && intro !== value) {
        const introMetrics = extractLeadingMetrics(intro);
        if (introMetrics.length) {
          for (const metric of introMetrics) {
            if (!expanded.some(([existingKey]) => existingKey.toLowerCase() === metric[0].toLowerCase())) {
              expanded.push(metric);
            }
          }
        }
      }

      if (marketing.length === 1) {
        expanded.push(...marketing);
      } else if (!metrics.length) {
        expanded.push([canonicalSpecLabel(key), value]);
      }
      continue;
    }

    expanded.push([canonicalSpecLabel(key), value]);
  }

  return dedupeSpecEntries(expanded);
}

export function isHighlightSpecValue(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= HIGHLIGHT_VALUE_MAX;
}
