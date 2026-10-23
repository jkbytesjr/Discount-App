"use client";
// Browser API client: cookie session + CSRF header, problem+json errors.

export interface FieldError { path: string; code: string }

export class ApiError extends Error {
  constructor(public status: number, public code: string, public fields: FieldError[] = [], public extra: Record<string, unknown> = {}) {
    super(code);
  }
}

let csrf: string | undefined;
export const setCsrf = (t: string | undefined) => { csrf = t; };

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: opts.method ?? "GET",
      credentials: "same-origin",
      headers: { ...(opts.body !== undefined ? { "content-type": "application/json" } : {}), ...(csrf ? { "x-csrf-token": csrf } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "NETWORK");
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const { code, errors, ...extra } = (data ?? {}) as { code?: string; errors?: FieldError[] } & Record<string, unknown>;
    throw new ApiError(res.status, code ?? "INTERNAL", errors ?? [], extra);
  }
  return data as T;
}
