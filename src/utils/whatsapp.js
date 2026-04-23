import { digitsOnly } from "./format";

/**
 * @param {string} phoneRaw
 * @param {string} message
 */
export function openWhatsAppOrder(phoneRaw, message) {
  const digits = digitsOnly(phoneRaw);
  if (!digits) {
    throw new Error("Seller phone is missing. Contact support.");
  }
  const text = encodeURIComponent(message);
  const url = `https://wa.me/${digits}?text=${text}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * @param {{ name: string, price: number, qty: number, kind?: string }[]} items
 * @param {number} total
 */
export function formatOrderWhatsAppText(items, total) {
  const lines = items.map((i) => {
    const tag =
      i.kind === "combo"
        ? "[Combo] "
        : i.kind === "discount"
          ? "[Offer] "
          : "";
    return `${tag}${i.name} x${i.qty} - ₹${Number(i.price).toFixed(0)}`;
  });
  return `Order Details:\n${lines.join("\n")}\nTotal: ₹${Number(total).toFixed(0)}`;
}
