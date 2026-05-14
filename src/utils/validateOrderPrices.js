import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { getProductOfferMeta } from "./pricing";
import { isComboUnavailable, isProductUnavailable } from "./menuSections";
import {
  buildDefaultComboVariantPicks,
  findVariantOnProduct,
  formatLineDisplayName,
  getComboVariantPickRequirements,
  normalizeComboItemEntries,
  productHasSelectableVariants,
} from "./productVariants";

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
      if (isComboUnavailable(c)) {
        throw new Error(`"${String(c.name || "Combo")}" is currently unavailable. Remove it from the cart.`);
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
      const comboDoc = /** @type {Record<string, unknown>} */ ({ id: rawId, ...c });
      const productIds = new Set();
      for (const e of normalizeComboItemEntries(comboDoc)) {
        if (e.productId) productIds.add(e.productId);
      }
      /** @type {Map<string, Record<string, unknown>>} */
      const pmap = new Map();
      for (const pid of productIds) {
        const psnap = await getDoc(doc(db, "products", String(pid)));
        if (psnap.exists()) pmap.set(String(pid), { id: psnap.id, ...psnap.data() });
      }
      const reqs = getComboVariantPickRequirements(comboDoc, pmap);
      /** @type {{ productId: string, variantId: string, variantLabel: string, subLabel: string }[]} */
      let picks = Array.isArray(line.comboVariantPicks) ? [...line.comboVariantPicks] : [];
      for (const d of buildDefaultComboVariantPicks(comboDoc, pmap)) {
        if (!picks.some((x) => x && String(x.productId) === String(d.productId))) picks.push(d);
      }
      for (const r of reqs) {
        const pr = pmap.get(r.productId);
        if (!pr || !productHasSelectableVariants(pr)) continue;
        if (r.requiresPick) {
          const pick = picks.find((x) => x && String(x.productId) === r.productId);
          if (!pick || !String(pick.variantId || "").trim()) {
            throw new Error(
              `Combo "${String(c.name || "Combo")}" needs a size choice for ${r.productName}. Remove it from the cart and add it again.`
            );
          }
          const v = findVariantOnProduct(pr, String(pick.variantId));
          if (!v) {
            throw new Error(
              `Combo "${String(c.name || "Combo")}" has an invalid choice for ${r.productName}. Remove it from the cart.`
            );
          }
        } else if (r.fixedVariantId) {
          const v = findVariantOnProduct(pr, r.fixedVariantId);
          if (!v) {
            throw new Error(`Combo "${String(c.name || "Combo")}" is misconfigured. Contact the shop.`);
          }
          const pick = picks.find((x) => x && String(x.productId) === r.productId);
          if (pick && String(pick.variantId) !== String(r.fixedVariantId)) {
            throw new Error(
              `Combo "${String(c.name || "Combo")}" options do not match the menu. Remove it from the cart.`
            );
          }
        }
      }
      if (picks.length > 0) row.comboVariantPicks = picks;
      items.push(row);
    } else {
      const pid =
        String(line.productId || "")
          .trim() ||
        String(line.id || "")
          .split("__v__")[0]
          .trim();
      const snap = await getDoc(doc(db, "products", pid));
      if (!snap.exists()) {
        throw new Error(`Item "${line.name || pid}" is no longer on the menu. Remove it from the cart.`);
      }
      const p = { id: snap.id, ...snap.data() };
      if (String(p.sellerId || "") !== String(sellerId)) {
        throw new Error("Cart has items from another shop. Clear the cart and try again.");
      }
      if (isProductUnavailable(p)) {
        throw new Error(`"${String(p.name || "Item")}" is currently unavailable. Remove it from the cart.`);
      }
      const variantId = line.variantId != null ? String(line.variantId).trim() : "";
      if (variantId) {
        const v = findVariantOnProduct(p, variantId);
        if (!v) {
          throw new Error(`"${String(p.name || "Item")}" variant is unavailable. Remove it from the cart.`);
        }
        const unit = Number(v.price) || 0;
        const orig = Number(v.originalPrice) || 0;
        const hasStrike = orig > unit;
        const base = hasStrike ? orig : unit;
        subtotal += base * qty;
        if (hasStrike) {
          savings += (orig - unit) * qty;
        }
        const cartPrice = Number(line.price);
        if (Math.abs(cartPrice - unit) > 0.5) {
          throw new Error(`Prices have changed for "${String(p.name || "Item")}". Remove it from the cart and try again.`);
        }
        const useDiscount = (line.kind && line.kind === "discount") || hasStrike;
        const kind = useDiscount ? "discount" : "product";
        const displayName = formatLineDisplayName(String(p.name || line.name || "Item"), v.label);
        const row = {
          productId: p.id,
          name: displayName,
          price: unit,
          qty,
          kind: kind === "discount" ? "discount" : "product",
          variantId: v.id,
          variantLabel: v.label,
          subLabel: v.subLabel || "",
        };
        if (line.notes && String(line.notes).trim()) row.notes = String(line.notes).trim();
        if (hasStrike) row.originalPrice = orig;
        items.push(row);
      } else {
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
  }

  if (items.length === 0) {
    throw new Error("No valid line items in cart.");
  }

  const total = items.reduce((s, it) => s + Number(it.price) * Number(it.qty), 0);

  return { items, total, subtotal, savings };
}
