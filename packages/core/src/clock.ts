// All code reads time from a Clock, never Date.now() (TD-2).
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

// Fixed clock for tests and the test-only X-Test-Now header.
export function fixedClock(iso: string): Clock {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ISO date: ${iso}`);
  return { now: () => new Date(d) };
}
