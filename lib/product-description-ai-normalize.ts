import {
  descriptionNormalizePlainText,
  isUnstructuredDescription,
  normalizeProductDescriptionHtml
} from "./product-description-normalize.ts";

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";

const PRODUCT_NORMALIZE_PROMPT = `Refine this product description into clean structured plain text.
Rules:
- Preserve every fact, value, and specification exactly.
- Do not add marketing language or invent specifications.
- Remove malformed characters, duplicate lines, and broken encoding.
- Use one spec per line as Label: Value.
- Use section headers on their own line ending with a colon (Sensors:, Package Contents:, Warranty:, Notes:).
- Use "- item" lines under list sections.
- Keep intro paragraphs as plain prose when present.
- Return plain text only, no HTML or markdown.`;

const PRODUCT_NORMALIZE_SYSTEM =
  "You edit product catalog descriptions for a drone commerce store. Preserve specifications exactly. Return only the rewritten passage with no preamble.";

export type ProductDescriptionNormalizeResult = {
  html: string | null;
  geminiUsed: boolean;
};

function getGeminiApiKey(env: Record<string, string | undefined> = process.env) {
  return env.GEMINI_API_KEY?.trim() || env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || "";
}

function getGeminiTextModel(env: Record<string, string | undefined> = process.env) {
  return env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}

async function generateGeminiNormalizeText(input: {
  text: string;
  env?: Record<string, string | undefined>;
}) {
  const env = input.env ?? process.env;
  const apiKey = getGeminiApiKey(env);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = getGeminiTextModel(env);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PRODUCT_NORMALIZE_SYSTEM }] },
        contents: [{
          role: "user",
          parts: [{ text: `${PRODUCT_NORMALIZE_PROMPT}\n\nText:\n${input.text}` }]
        }],
        generationConfig: { temperature: 0.2 }
      })
    }
  );

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini text request failed (${response.status}).`);
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned an empty text response.");
  }

  return text;
}

function shouldUseGeminiFallback(env: Record<string, string | undefined> = process.env) {
  return env.PRODUCT_DESCRIPTION_GEMINI_FALLBACK === "1" || env.PRODUCT_DESCRIPTION_GEMINI_FALLBACK === "true";
}

export async function normalizeProductDescriptionWithAiFallback(
  raw: string | null | undefined,
  options?: { useGemini?: boolean; env?: Record<string, string | undefined> }
): Promise<ProductDescriptionNormalizeResult> {
  const env = options?.env ?? process.env;
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return { html: null, geminiUsed: false };

  const deterministic = normalizeProductDescriptionHtml(trimmed);
  const deterministicPlain = descriptionNormalizePlainText(deterministic ?? trimmed);
  const stillUnstructured = isUnstructuredDescription(deterministicPlain, deterministic ?? trimmed);

  if (!stillUnstructured) {
    return { html: deterministic, geminiUsed: false };
  }

  const useGemini = options?.useGemini ?? shouldUseGeminiFallback(env);
  if (!useGemini || !getGeminiApiKey(env)) {
    return { html: deterministic, geminiUsed: false };
  }

  try {
    const sourcePlain = descriptionNormalizePlainText(trimmed);
    const rewritten = await generateGeminiNormalizeText({ text: sourcePlain, env });
    const geminiHtml = normalizeProductDescriptionHtml(rewritten) ?? normalizeProductDescriptionHtml(trimmed);
    const geminiPlain = descriptionNormalizePlainText(geminiHtml ?? rewritten);

    if (geminiHtml && !isUnstructuredDescription(geminiPlain, geminiHtml)) {
      return { html: geminiHtml, geminiUsed: true };
    }

    if (geminiHtml && isUnstructuredDescription(deterministicPlain, deterministic ?? undefined)) {
      return { html: geminiHtml, geminiUsed: true };
    }
  } catch (error) {
    console.warn("[product-description-ai-normalize] Gemini fallback failed.", error);
  }

  return { html: deterministic, geminiUsed: false };
}

export async function normalizeProductDescriptionForSave(
  raw: string | null | undefined,
  env: Record<string, string | undefined> = process.env
) {
  const result = await normalizeProductDescriptionWithAiFallback(raw, { env });
  return result.html;
}
