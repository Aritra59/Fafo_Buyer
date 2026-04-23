/**
 * Buyer open/closed matches seller `shopOpenManualMode` + hours fields.
 *
 * **Time basis:** device **local** time (same as typical seller app) until a
 * shared `seller.timezone` (IANA) exists in both apps.
 */

/**
 * @param {unknown} raw Firestore `shopOpenManualMode`
 * @returns {'auto' | 'open' | 'closed'}
 */
export function normalizeShopOpenManualMode(raw) {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "open" || s === "always_open" || s === "alwaysopen") return "open";
  if (s === "closed" || s === "always_closed" || s === "alwaysclosed") {
    return "closed";
  }
  if (
    s === "auto" ||
    s === "automatic" ||
    s === "" ||
    s === "null" ||
    s === "undefined"
  ) {
    return "auto";
  }
  return "auto";
}

/**
 * @param {unknown} t "HH:mm" or "H:mm" 24h
 * @returns {number | null} minutes from midnight
 */
function parseHHmm(t) {
  if (t == null) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Auto mode only. `openingTime ?? openTime`, `closingTime ?? closeTime`.
 * @param {Record<string, unknown> | null | undefined} seller
 * @param {Date} [now]
 * @returns {boolean | null} null if hours missing/invalid
 */
export function computeShopOpenNowFromHours(seller, now = new Date()) {
  if (!seller) return null;
  const openStr = seller.openingTime ?? seller.openTime;
  const closeStr = seller.closingTime ?? seller.closeTime;
  const openM = parseHHmm(openStr);
  const closeM = parseHHmm(closeStr);
  if (openM == null || closeM == null) return null;

  const cur = now.getHours() * 60 + now.getMinutes();

  if (closeM >= openM) {
    return cur >= openM && cur <= closeM;
  }
  return cur >= openM || cur <= closeM;
}

/**
 * Final open state from seller doc (recompute each snapshot; do not trust `shopOpenNow` alone).
 * @param {Record<string, unknown> | null | undefined} seller
 * @param {Date} [now]
 * @returns {boolean | null} true/false, or null when auto + invalid/missing hours
 */
export function resolveShopOpenNow(seller, now = new Date()) {
  if (!seller) return null;
  const mode = normalizeShopOpenManualMode(seller.shopOpenManualMode);
  if (mode === "open") return true;
  if (mode === "closed") return false;
  return computeShopOpenNowFromHours(seller, now);
}

/**
 * @param {boolean | null} resolved
 * @returns {'open' | 'closed' | 'unknown'}
 */
export function shopOpenUiStateFromResolved(resolved) {
  if (resolved === true) return "open";
  if (resolved === false) return "closed";
  return "unknown";
}

/**
 * @param {Record<string, unknown> | null | undefined} seller
 * @param {Date} [now]
 */
export function getShopOpenUiState(seller, now = new Date()) {
  return shopOpenUiStateFromResolved(resolveShopOpenNow(seller, now));
}

/**
 * Checkout: only explicitly open (manual open or inside valid auto window).
 * Unknown hours in auto mode → do not allow checkout.
 * @param {Record<string, unknown> | null | undefined} seller
 * @param {Date} [now]
 */
export function isShopOpenForCheckout(seller, now = new Date()) {
  return resolveShopOpenNow(seller, now) === true;
}
