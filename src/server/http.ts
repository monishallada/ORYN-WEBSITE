/** Small helpers for JSON route handlers. */
import { NextResponse } from "next/server";
import { DomainError } from "@/server/errors";

export function ok(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export async function readJson(req: Request, maxBytes = 2_000_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new DomainError("too_large", "Request body is too large.", 422);
  const text = await req.text();
  if (text.length > maxBytes) throw new DomainError("too_large", "Request body is too large.", 422);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new DomainError("invalid_json", "Request body must be valid JSON.", 400);
  }
}

export function searchParam(req: Request, name: string): string | undefined {
  const v = new URL(req.url).searchParams.get(name);
  return v === null || v === "" ? undefined : v;
}
