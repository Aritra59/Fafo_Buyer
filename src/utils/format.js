export function formatCurrencyInr(amount) {
  const n = Number(amount);
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toFixed(0)}`;
}

export function formatDistanceKm(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** @param {string} raw */
export function digitsOnly(raw) {
  return String(raw || "").replace(/\D/g, "");
}

/** @param {string} input */
export function normalizeIndiaPhone(input) {
  const d = String(input).replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.startsWith("91") && d.length === 12) return `+${d}`;
  if (String(input).trim().startsWith("+")) {
    const rest = String(input).trim().slice(1).replace(/\D/g, "");
    return rest ? `+${rest}` : "";
  }
  return d ? `+${d}` : "";
}

/**
 * E.164-style phone check for guest checkout (India +91 and generic international).
 * @param {string} input
 */
export function isValidGuestPhone(input) {
  const e = normalizeIndiaPhone(String(input).trim());
  if (!e || e.length < 8) return false;
  if (!/^\+\d{8,16}$/.test(e)) return false;
  if (e.startsWith("+91")) {
    return e.length === 13;
  }
  return true;
}
