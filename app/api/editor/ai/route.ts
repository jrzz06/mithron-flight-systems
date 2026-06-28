import { NextResponse } from "next/server";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { requirePermission } from "@/services/auth";
import type { EditorAiAction } from "@/lib/editor/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTION_PROMPTS: Record<EditorAiAction, string> = {
  improve: "Improve the writing while preserving meaning.",
  rewrite: "Rewrite the text with fresh phrasing while preserving meaning.",
  expand: "Expand the text with useful detail.",
  shorten: "Shorten the text while preserving key facts.",
  professional: "Rewrite in a professional enterprise tone.",
  marketing: "Rewrite in persuasive marketing copy.",
  technical: "Rewrite in precise technical language.",
  translate: "Translate to clear English."
};

export async function POST(request: Request) {
  try {
    const { userId } = await requirePermission("cms.write");
    const limit = await checkDistributedRateLimit(`editor-ai:${userId}`, 20, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    const body = (await request.json()) as { action?: EditorAiAction; text?: string };
    const action = body.action;
    const text = body.text?.trim();

    if (!action || !text) {
      return NextResponse.json({ error: "Action and selected text are required." }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI assistance is not configured. Set OPENAI_API_KEY to enable editor AI actions." },
        { status: 503 }
      );
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
            content: "You edit selected passages for a drone commerce CMS. Return only the rewritten passage with no preamble."
          },
          {
            role: "user",
            content: `${ACTION_PROMPTS[action]}\n\nText:\n${text}`
          }
        ]
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json({ error: `AI provider error: ${detail}` }, { status: 502 });
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const rewritten = payload.choices?.[0]?.message?.content?.trim();
    if (!rewritten) {
      return NextResponse.json({ error: "AI provider returned an empty response." }, { status: 502 });
    }

    return NextResponse.json({ text: rewritten });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed.";
    const status = message.includes("Authentication") || message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
