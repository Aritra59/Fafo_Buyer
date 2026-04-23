/**
 * Whether seller can receive UPI (Firestore + business rules).
 * @param {Record<string, unknown> | null | undefined} s
 * @returns {boolean}
 */
export function sellerAcceptsUpi(s) {
  if (!s) return false;
  const upi = String(s.upiId || s.upi_id || "").trim();
  if (!upi) return false;
  if (s.acceptsUpi === false || s.upiEnabled === false) return false;
  const modes = s.paymentMethods || s.paymentModes;
  if (Array.isArray(modes) && modes.length) {
    return modes
      .map((x) => String(x).toLowerCase().replace(/\s+/g, ""))
      .some((m) => m === "upi" || m === "phonepe" || m === "gpay");
  }
  if (String(s.preferredPayment || "").toLowerCase() === "cod" && s.allowUpi !== true) {
    return false;
  }
  return true;
}

/**
 * @param {Record<string, unknown> | null | undefined} s
 * @returns {boolean}
 */
export function sellerAcceptsCod(s) {
  if (!s) return true;
  if (s.cashOnDelivery === false || s.codEnabled === false) return false;
  const modes = s.paymentMethods || s.paymentModes;
  if (Array.isArray(modes) && modes.length) {
    return modes
      .map((x) => String(x).toLowerCase().replace(/\s+/g, ""))
      .some((m) => m === "cod" || m === "cash" || m === "cashondelivery");
  }
  if (String(s.preferredPayment || "").toLowerCase() === "upi" && s.allowCod === false) {
    return false;
  }
  return true;
}
