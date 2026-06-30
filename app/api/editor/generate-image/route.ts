import { NextResponse } from "next/server";
import { generateGeminiImage, getGeminiApiKey } from "@/lib/gemini";
import { checkDistributedRateLimit } from "@/lib/rate-limit-redis";
import { requirePermission } from "@/services/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { userId } = await requirePermission("cms.write");
    const limit = await checkDistributedRateLimit(`editor-ai-image:${userId}`, 10, 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }

    if (!getGeminiApiKey()) {
      return NextResponse.json(
        { error: "Image generation is not configured. Set GEMINI_API_KEY to enable it." },
        { status: 503 }
      );
    }

    const body = (await request.json()) as { prompt?: string };
    const prompt = body.prompt?.trim();
    if (!prompt) {
      return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
    }

    const image = await generateGeminiImage({ prompt });
    return NextResponse.json({
      mimeType: image.mimeType,
      dataUrl: `data:${image.mimeType};base64,${image.base64}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed.";
    const status = message.includes("Authentication") || message.includes("Unauthorized") ? 401 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
