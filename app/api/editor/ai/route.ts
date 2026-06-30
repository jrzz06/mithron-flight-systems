import { NextResponse } from "next/server";
import { generateGeminiText, getGeminiApiKey } from "@/lib/gemini";
import { buildEditorAiSystemPrompt, buildEditorAiUserPrompt } from "@/lib/editor/ai-prompts";
import type { EditorAiAction } from "@/lib/editor/types";
import { normalizeProductDescriptionHtml } from "@/lib/product-description-normalize";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { requireEditorAiPermission } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function rewriteWithOpenAi(input: {
  action: EditorAiAction;
  text: string;
  documentType?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AI assistance is not configured. Set GEMINI_API_KEY or OPENAI_API_KEY.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_EDITOR_MODEL ?? "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: buildEditorAiSystemPrompt(input.documentType)
        },
        {
          role: "user",
          content: buildEditorAiUserPrompt(input)
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI provider error: ${detail}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rewritten = payload.choices?.[0]?.message?.content?.trim();
  if (!rewritten) {
    throw new Error("OpenAI returned an empty response.");
  }
  return rewritten;
}

async function runEditorAi(input: {
  action: EditorAiAction;
  text: string;
  documentType?: string;
}) {
  const rewritten = getGeminiApiKey()
    ? await generateGeminiText({
        system: buildEditorAiSystemPrompt(input.documentType),
        prompt: buildEditorAiUserPrompt(input)
      })
    : await rewriteWithOpenAi(input);

  if (input.action === "normalize_structure") {
    const html = normalizeProductDescriptionHtml(rewritten) ?? normalizeProductDescriptionHtml(input.text);
    return { text: rewritten, html: html ?? undefined };
  }

  return { text: rewritten };
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireEditorAiPermission();
    const limit = await checkDistributedRateLimit(`editor-ai:${userId}`, 20, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const body = (await request.json()) as {
      action?: EditorAiAction;
      text?: string;
      documentType?: string;
    };
    const action = body.action;
    const text = body.text?.trim();
    const documentType = body.documentType?.trim() || undefined;

    if (!action || !text) {
      return NextResponse.json({ error: "Action and selected text are required." }, { status: 400 });
    }

    const result = await runEditorAi({ action, text, documentType });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed.";
    const status = message.includes("Authentication") || message.includes("Unauthorized")
      ? 401
      : message.includes("not configured")
        ? 503
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
