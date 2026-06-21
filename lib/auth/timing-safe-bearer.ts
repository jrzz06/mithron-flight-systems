import { timingSafeEqual } from "node:crypto";

export function safeBearerEquals(request: Request, envSecret: string | undefined): boolean {
  const secret = envSecret?.trim() ?? "";
  if (!secret) return false;

  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? "";
  if (!candidate) return false;

  const secretBuffer = Buffer.from(secret);
  const candidateBuffer = Buffer.from(candidate);
  if (secretBuffer.length !== candidateBuffer.length) return false;
  return timingSafeEqual(secretBuffer, candidateBuffer);
}
