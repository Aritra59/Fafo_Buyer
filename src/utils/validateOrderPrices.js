import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { getProductOfferMeta } from "./pricing";

/**
 * @param {string} sellerId
 * @param {unknown[]} lines
 * @returns {Promise<{ items: Record<string, unknown>[], total: number, subtotal: number, savings: number }>}
 */
export async function validateAndPriceOrderLines(sellerId, lines) {
  if (!lines.length) {
    throw new Error("Your cart is empty.");
  }
  const items = [];
  let subtotal = 0;
  let savings = 0;
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    if (qty === 0) continue;

    const isCombo = line.kind === "combo" || String(line.productId || "").startsWith("combo_");
    if (isCombo) {
      const rawId = String(line.productId).replace(/^combo_/, "");
      const snap = await getDoc(doc(db, "combos", rawId));
      if (!snap.exists()) {
        throw new Error(`Combo "${line.name || rawId}" is no longer on the menu. Remove it from the cart.`);
      }
      const c = snap.data() || {};
      if (String(c.sellerId || "") !== String(sellerId)) {
        throw new Error("Cart has items from another shop. Clear the cart and try again.");
      }
      const price = Number(c.price) || 0;
      const origRaw = c.originalPrice ?? c.compareAtPrice ?? c.mrp;
      const orig = Number(origRaw) || 0;
      const hasStrike = orig > price;
      const base = hasStrike ? orig : price;
      subtotal += base * qty;
      if (hasStrike) {
        savings += (orig - price) * qty;
      }
      let comboText = "";
      const raw = c.items ?? c.itemList ?? c.comboItems;
      if (Array.isArray(raw)) {
        comboText = raw
          .map((x) =>
            typeof x === "string" ? x : x?.name || x?.title || x?.label || ""
          )
          .filter(Boolean)
          .join(" · ");
      } else if (typeof raw === "string" && raw.trim()) {
        comboText = raw.trim();
      }
      const row = {
        productId: `combo_${rawId}`,
        name: String(c.name || line.name || "Combo"),
        price,
        qty,
        kind: "combo",
      };
      if (comboText) row.comboItems = comboText;
      if (line.notes && String(line.notes).trim()) row.notes = String(line.notes).trim();
      if (hasStrike) row.originalPrice = orig;
      items.push(row);
    } else {
      const pid = String(line.productId || line.id);
      const snap = await getDoc(doc(db, "products", pid));
      if (!snap.exists()) {
        throw new Error(`Item "${line.name || pid}" is no longer on the menu. Remove it from the cart.`);
      }
      const p = { id: snap.id, ...snap.data() };
      if (String(p.sellerId || "") !== String(sellerId)) {
        throw new Error("Cart has items from another shop. Clear the cart and try again.");
      }
      const meta = getProductOfferMeta(p);
      const orig = Number(meta.originalPrice) || 0;
      const unit = Number(meta.price) || 0;
      const hasStrike = orig > unit;
      const base = hasStrike ? orig : unit;
      subtotal += base * qty;
      if (hasStrike) {
        savings += (orig - unit) * qty;
      }
      const useDiscount =
        (line.kind && line.kind === "discount") || meta.hasDiscount;
      const kind = useDiscount ? "discount" : "product";
      const row = {
        productId: p.id,
        name: String(p.name || line.name || "Item"),
        price: unit,
        qty,
        kind: kind === "discount" ? "discount" : "product",
      };
      if (line.notes && String(line.notes).trim()) row.notes = String(line.notes).trim();
      if (hasStrike) row.originalPrice = orig;
      items.push(row);
    }
  }

  if (items.length === 0) {
    throw new Error("No valid line items in cart.");
  }

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);

  return { items, total, subtotal, savings };
}
