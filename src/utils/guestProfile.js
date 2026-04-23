const GUEST_KEY_LEGACY = "buyerGuestProfile";
export const GUEST_PROFILE_KEY = "guestBuyerProfile";
const RECENT_KEY = "fafo_recent_shops_v1";
const MAX_RECENT = 8;

function readGuestFromStorage() {
  if (typeof localStorage === "undefined") return null;
  for (const key of [GUEST_PROFILE_KEY, GUEST_KEY_LEGACY]) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const p = JSON.parse(raw);
      if (p && typeof p.name === "string" && typeof p.phone === "string") {
        return { name: p.name.trim(), phone: p.phone.trim() };
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * @returns {{ name: string, phone: string } | null}
 */
export function getGuestProfile() {
  return readGuestFromStorage();
}

/**
 * @param {{ name: string, phone: string }} p
 */
export function setGuestProfile(p) {
  if (typeof localStorage === "undefined") return;
  const name = String(p.name || "").trim();
  const phone = String(p.phone || "").trim();
  const data = JSON.stringify({ name, phone });
  localStorage.setItem(GUEST_PROFILE_KEY, data);
  localStorage.setItem(GUEST_KEY_LEGACY, data);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("fafo-guest-updated"));
  }
}

/**
 * @param {{ id: string, name?: string, code?: string, slug?: string }} shop
 */
export function addRecentShop(shop) {
  if (typeof localStorage === "undefined" || !shop?.id) return;
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    /** @type {Record<string, unknown>[]} */
    const list = raw ? JSON.parse(raw) : [];
    const next = [
      { id: shop.id, name: shop.name || "", code: shop.code || "", slug: shop.slug || "" },
      ...list.filter((s) => s && s.id !== shop.id),
    ].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Record<string, unknown>[]}
 */
export function getRecentShops() {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export const ORDER_SOURCE_SESSION = "fafo_order_source";
export const ORDER_SOURCE_QR = "qr_public";
/** Public /shop and /s links (preferred for new orders) */
export const ORDER_SOURCE_PUBLIC_LINK = "public_link";
export const ORDER_SOURCE_APP = "app";

/**
 * @returns {string}
 */
export function getOrderSourceFromSession() {
  if (typeof sessionStorage === "undefined") return ORDER_SOURCE_APP;
  return sessionStorage.getItem(ORDER_SOURCE_SESSION) || ORDER_SOURCE_APP;
}

/**
 * @param {string} source
 */
export function setOrderSourceSession(source) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ORDER_SOURCE_SESSION, source);
}
