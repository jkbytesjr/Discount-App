import { AppError, XLSX_TYPE, authenticate, requireFullAuth, type AuthContext, type AuthDeps, type Meta } from "@moz/core";
import { ZodError } from "zod";
import { getDeps, isSecure } from "./server";

export const COOKIE = isSecure ? "__Host-moz_session" : "moz_session";
const MAX_BODY = 64 * 1024;

export function problem(status: number, code: string, title: string, extra: Record<string, unknown> = {}, headers: HeadersInit = {}) {
  return new Response(JSON.stringify({ type: `about:blank#${code}`, title, status, code, ...extra }), {
    status, headers: { "Content-Type": "application/problem+json", "Cache-Control": "no-store", ...headers },
  });
}

export function json(data: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });
}

export function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSec: number) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isSecure ? "; Secure" : ""}`;
}

export function metaOf(req: Request): Meta {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: fwd || req.headers.get("x-real-ip") || null,
    userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    requestId: req.headers.get("x-vercel-id") ?? crypto.randomUUID(),
  };
}

export async function readJson(req: Request): Promise<unknown> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new AppError(413, "BODY_TOO_LARGE", "Request body too large");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError(400, "BAD_JSON", "Body must be valid JSON");
  }
}

export interface Ctx { req: Request; deps: AuthDeps; meta: Meta }

// Wraps a handler: builds deps, maps errors to problem+json. Never echoes submitted values back.
export function handle(fn: (c: Ctx) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const meta = metaOf(req);
    try {
      return await fn({ req, deps: getDeps(req), meta });
    } catch (e) {
      if (e instanceof ZodError) {
        return problem(422, "VALIDATION_FAILED", "Invalid request", { errors: e.issues.map((i) => ({ path: i.path.join("."), code: i.code })) });
      }
      if (e instanceof AppError) return problem(e.status, e.code, e.message, e.extra);
      console.error(`[api] unhandled requestId=${meta.requestId}`, e);
      return problem(500, "INTERNAL", "Something went wrong", { requestId: meta.requestId });
    }
  };
}

export async function authed(c: Ctx, opts: { allowMfaPending?: boolean } = {}): Promise<AuthContext> {
  const auth = c.req.headers.get("authorization");
  const ctx = await authenticate(c.deps, {
    cookieToken: readCookie(c.req, COOKIE),
    bearer: auth?.startsWith("Bearer ") ? auth.slice(7) : null,
    csrfHeader: c.req.headers.get("x-csrf-token"),
    method: c.req.method,
  });
  return opts.allowMfaPending ? ctx : requireFullAuth(ctx);
}

export const query = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);

// For routes with a dynamic [id] segment (Next 16 passes params as a Promise).
export function handleWithId(fn: (c: Ctx, id: string) => Promise<Response>) {
  return async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    return handle((c) => fn(c, id))(req);
  };
}

/** Excel download (BR-3, BR-10, BR-12). The file name carries no personal data. */
export function xlsxResponse(file: Buffer, name: string, extra: Record<string, string> = {}) {
  return new Response(new Uint8Array(file), { status: 200, headers: { "Content-Type": XLSX_TYPE, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store", ...extra } });
}

// Best-effort per-instance limit for the public discovery endpoints (DEC-040): 300 requests per minute per client IP.
const publicHits = new Map<string, { n: number; at: number }>();
export function publicLimit(c: Ctx, perMinute = 300): void {
  const ip = c.meta.ip ?? "unknown";
  const now = performance.now(); // monotonic: an in-memory throttle, not business time
  const h = publicHits.get(ip);
  if (!h || now - h.at > 60_000) { publicHits.set(ip, { n: 1, at: now }); if (publicHits.size > 5000) publicHits.clear(); return; }
  if (++h.n > perMinute) throw new AppError(429, "RATE_LIMITED", "Too many requests");
}
