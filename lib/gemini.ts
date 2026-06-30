import "server-only";

const DEFAULT_TEXT_MODEL = "gemini-2.5-flash";
const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";

export function getGeminiApiKey(env: Record<string, string | undefined> = process.env) {
  return env.GEMINI_API_KEY?.trim() || env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || "";
}

export function getGeminiTextModel(env: Record<string, string | undefined> = process.env) {
  return env.GEMINI_TEXT_MODEL?.trim() || DEFAULT_TEXT_MODEL;
}

export function getGeminiImageModel(env: Record<string, string | undefined> = process.env) {
  return env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> };
  }>;
  error?: { message?: string };
};

export async function generateGeminiText(input: {
  system: string;
  prompt: string;
  temperature?: number;
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
        systemInstruction: { parts: [{ text: input.system }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: { temperature: input.temperature ?? 0.4 }
      })
    }
  );

  const payload = (await response.json()) as GeminiGenerateContentResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini text request failed (${response.status}).`);
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) {
    throw new Error("Gemini returned an empty text response.");
  }

  return text;
}

export async function generateGeminiImage(input: {
  prompt: string;
  env?: Record<string, string | undefined>;
}) {
  const env = input.env ?? process.env;
  const apiKey = getGeminiApiKey(env);
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = getGeminiImageModel(env);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] }
      })
    }
  );

  const payload = (await response.json()) as GeminiGenerateContentResponse & {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Gemini image request failed (${response.status}).`);
  }

  const inlineData = payload.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)?.inlineData;
  if (!inlineData?.data) {
    throw new Error("Gemini returned no image data.");
  }

  return {
    base64: inlineData.data,
    mimeType: inlineData.mimeType ?? "image/png"
  };
}
