import {
  getShopOpenUiState,
  resolveShopOpenNow as resolveShopOpenNowFromSeller,
} from "./shopOpenStatus";

/**
 * @param {unknown} t "HH:mm" or "H:mm"
 * @returns {number | null} minutes from midnight
 */
export function parseTimeToMinutes(t) {
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
 * Legacy same-day exclusive end / overnight half-open window.
 * Prefer `computeShopOpenNowFromHours` in shopOpenStatus.js for seller-aligned inclusive rules.
 */
export function isShopOpenBySchedule(seller, now = new Date()) {
  const open = parseTimeToMinutes(seller?.openingTime ?? seller?.openTime);
  const close = parseTimeToMinutes(seller?.closingTime ?? seller?.closeTime);
  if (open == null || close == null) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  if (open < close) return cur >= open && cur < close;
  if (open > close) return cur >= open || cur < close;
  return false;
}

/**
 * @deprecated Use `resolveShopOpenNow` or `getShopOpenUiState` from `./shopOpenStatus.js`
 * @returns {boolean} null resolved as false for backward compatibility
 */
export function isShopOpenForBuyer(seller, now = new Date()) {
  const r = resolveShopOpenNowFromSeller(seller, now);
  return r === true;
}

/** @param {unknown} trialEnd */
function trialEndMs(trialEnd) {
  if (trialEnd == null) return null;
  if (typeof trialEnd.toMillis === "function") return trialEnd.toMillis();
  if (typeof trialEnd === "number") return trialEnd;
  if (typeof trialEnd === "object" && typeof trialEnd.seconds === "number") {
    return trialEnd.seconds * 1000;
  }
  return null;
}

/**
 * Trial still active (seller can operate during trial window).
 * @param {Record<string, unknown> | null | undefined} seller
 */
export function isTrialActive(seller) {
  const end = trialEndMs(seller?.trialEnd);
  if (end == null) return false;
  return Date.now() < end;
}

/**
 * Slots available for taking orders, or trial bypass.
 * @param {Record<string, unknown> | null | undefined} seller
 */
export function hasSlotsOrTrial(seller) {
  if (isTrialActive(seller)) return true;
  const s =
    seller?.slots ??
    seller?.availableSlots ??
    seller?.orderSlots ??
    seller?.remainingSlots;
  const n = Number(s);
  if (Number.isFinite(n)) return n > 0;
  if (s === true) return true;
  return false;
}

/**
 * Home / discovery: not blocked, live OR trial, slots OR trial.
 * @param {Record<string, unknown> | null | undefined} seller
 */
export function sellerPassesDiscoveryFilters(seller) {
  if (!seller) return false;
  if (seller.blocked === true || seller.isBlocked === true) return false;
  const live = seller.isLive === true;
  if (!live && !isTrialActive(seller)) return false;
  if (!hasSlotsOrTrial(seller)) return false;
  return true;
}

/** @deprecated use sellerPassesDiscoveryFilters */
export function sellerPassesShopListFilters(seller) {
  return sellerPassesDiscoveryFilters(seller);
}

/**
 * @param {Record<string, unknown> | null | undefined} seller
 */
export function formatSellerHoursDisplay(seller) {
  const aRaw = seller?.openingTime ?? seller?.openTime;
  const bRaw = seller?.closingTime ?? seller?.closeTime;
  const a = aRaw != null ? String(aRaw).trim() : "";
  const b = bRaw != null ? String(bRaw).trim() : "";
  if (!a && !b) return "Timings not set";
  if (a && b) return `${a} – ${b}`;
  return a || b;
}

/**
 * Short open–close line for the menu header, e.g. "12–4" (12h, no :00 if on the hour).
 * @param {Record<string, unknown> | null | undefined} seller
 * @returns {string | null}
 */
export function formatSellerHoursCompact(seller) {
  const aRaw = seller?.openingTime ?? seller?.openTime;
  const bRaw = seller?.closingTime ?? seller?.closeTime;
  const a = aRaw != null ? String(aRaw).trim() : "";
  const b = bRaw != null ? String(bRaw).trim() : "";
  if (!a || !b) return null;
  const aMin = parseTimeToMinutes(a);
  const bMin = parseTimeToMinutes(b);
  if (aMin == null || bMin == null) return null;
  const fmt = (m) => {
    const h24 = Math.floor(m / 60) % 24;
    const min = m % 60;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    if (min > 0) return `${h12}:${String(min).padStart(2, "0")}`;
    return String(h12);
  };
  return `${fmt(aMin)}–${fmt(bMin)}`;
}

/**
 * When the shop is closed, friendly line for the storefront (e.g. "Opens at 7:00 PM").
 * @param {Record<string, unknown> | null | undefined} seller
 * @param {Date} [now]
 * @returns {string | null}
 */
export function formatSellerOpensAtMessage(seller, now = new Date()) {
  if (!seller) return null;
  if (getShopOpenUiState(seller, now) === "open") return null;
  const openM = parseTimeToMinutes(seller.openingTime ?? seller.openTime);
  if (openM == null) return null;
  const h = Math.floor(openM / 60) % 24;
  const mi = openM % 60;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = mi > 0 ? `:${String(mi).padStart(2, "0")}` : "";
  return `Opens at ${h12}${mm} ${period}`;
}
