/**
 * The only Better Auth endpoints served over HTTP. Everything else Better
 * Auth implements (sign-up, account linking, profile and password changes,
 * username availability, …) answers 404: account creation and changes go
 * through ORYN's own audited server code instead.
 */
const ALLOWED: Record<string, (path: string) => boolean> = {
  GET: (p) => p === "/get-session" || p === "/ok" || p === "/error" || /^\/reset-password\/[A-Za-z0-9_-]+$/.test(p),
  POST: (p) => ["/sign-in/email", "/sign-in/username", "/sign-out", "/request-password-reset", "/reset-password"].includes(p),
};

export const AUTH_BASE_PATH = "/api/auth";

export function isAllowedAuthRequest(method: string, pathname: string): boolean {
  if (!pathname.startsWith(`${AUTH_BASE_PATH}/`)) return false;
  const path = pathname.slice(AUTH_BASE_PATH.length).replace(/\/+$/, "");
  return ALLOWED[method.toUpperCase()]?.(path) ?? false;
}

export async function handleAuthRequest(auth: { handler: (req: Request) => Promise<Response> }, req: Request): Promise<Response> {
  if (!isAllowedAuthRequest(req.method, new URL(req.url).pathname)) {
    return Response.json({ code: "NOT_FOUND", message: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return auth.handler(req);
}
