const PREFIX = "fafo_order_last_";
const COOLDOWN_MS = 45_000;

/**
 * Throttle by normalized phone (last order timestamp key).
 * @param {string} e164
 * @returns {{ ok: true } | { ok: false, waitSec: number }}
 */
export function canPlaceOrderByThrottle(e164) {
  if (typeof localStorage === "undefined") return { ok: true };
  const key = PREFIX + String(e164).replace(/\W/g, "");
  const last = Number(localStorage.getItem(key) || 0) || 0;
  const now = Date.now();
  if (now - last < COOLDOWN_MS) {
    return { ok: false, waitSec: Math.ceil((COOLDOWN_MS - (now - last)) / 1000) };
  }
  return { ok: true };
}

/**
 * @param {string} e164
 */
export function markOrderPlacedForThrottle(e164) {
  if (typeof localStorage === "undefined") return;
  const key = PREFIX + String(e164).replace(/\W/g, "");
  localStorage.setItem(key, String(Date.now()));
}
