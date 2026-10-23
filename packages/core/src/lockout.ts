// Progressive lockout: 15 min, doubling per lock, capped at 24 h (BR-1).
export const MAX_FAILED_ATTEMPTS = 5;
export const CAPTCHA_AFTER = 3;

export function lockMinutes(previousLocks: number): number {
  return Math.min(15 * 2 ** previousLocks, 24 * 60);
}
