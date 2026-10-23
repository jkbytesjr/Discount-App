// Errors carry an HTTP status and a stable code; the web layer renders problem+json (RFC 9457).
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}
