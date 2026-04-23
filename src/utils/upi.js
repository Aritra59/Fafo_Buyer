/**
 * Build UPI deep link (Indian UPI intent).
 * @param {{ pa: string, pn?: string, am?: number, tn?: string }} opts
 */
export function buildUpiPayUri({ pa, pn, am, tn }) {
  const id = String(pa || "").trim();
  if (!id) return "";
  const params = new URLSearchParams();
  params.set("pa", id);
  params.set("pn", String(pn || "Payee").trim().slice(0, 50) || "Payee");
  params.set("cu", "INR");
  if (am != null && Number.isFinite(Number(am)) && Number(am) > 0) {
    params.set("am", Number(am).toFixed(2));
  }
  if (tn && String(tn).trim()) {
    params.set("tn", String(tn).trim().slice(0, 80));
  }
  return `upi://pay?${params.toString()}`;
}

/**
 * @param {string} uri
 * @returns {boolean} whether navigation was attempted
 */
export function tryOpenUpiUri(uri) {
  if (!uri) return false;
  try {
    window.location.href = uri;
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} text
 */
export async function copyToClipboard(text) {
  const t = String(text || "");
  if (!t) return false;
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = t;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}
