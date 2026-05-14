import { getProductOfferMeta } from "./pricing";

/**
 * @param {unknown} p
 * @returns {"fixed"|"variants"}
 */
export function getProductPricingMode(p) {
  const m = String(/** @type {Record<string, unknown>} */ (p)?.pricingMode ?? "")
    .toLowerCase()
    .trim();
  if (m === "variants") return "variants";
  return "fixed";
}

/**
 * @typedef {{ id: string, label: string, subLabel: string, price: number, originalPrice?: number }} NormalizedVariant
 */

/**
 * @param {unknown} p
 * @returns {NormalizedVariant[]}
 */
export function normalizeProductVariants(p) {
  const raw = /** @type {Record<string, unknown>} */ (p)?.variants;
  if (!Array.isArray(raw)) return [];
  /** @type {NormalizedVariant[]} */
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const v = raw[i];
    if (v == null || typeof v !== "object") continue;
    const o = /** @type {Record<string, unknown>} */ (v);
    const id = String(o.id ?? o.variantId ?? `v${i}`).trim() || `v${i}`;
    const label = String(o.label ?? o.name ?? o.title ?? "Option").trim() || "Option";
    const subLabel = String(o.subLabel ?? o.subtitle ?? o.sub ?? "").trim();
    const price = Number(o.price ?? o.amount ?? 0) || 0;
    const origRaw = o.originalPrice ?? o.compareAtPrice ?? o.mrp ?? o.listPrice;
    const orig = Number(origRaw) || 0;
    /** @type {NormalizedVariant} */
    const row = { id, label, subLabel, price };
    if (orig > price) row.originalPrice = orig;
    out.push(row);
  }
  return out;
}

/**
 * @param {unknown} p
 */
export function productHasSelectableVariants(p) {
  return getProductPricingMode(p) === "variants" && normalizeProductVariants(p).length > 0;
}

/**
 * @param {unknown} p
 */
export function getVariantGroupBadgeText(p) {
  return String(
    /** @type {Record<string, unknown>} */ (p)?.variantGroupLabel ??
      /** @type {Record<string, unknown>} */ (p)?.variantBadge ??
      /** @type {Record<string, unknown>} */ (p)?.variantGroupName ??
      ""
  ).trim();
}

/**
 * @param {string} productId
 * @param {string} variantId
 */
export function variantCartLineId(productId, variantId) {
  return `${String(productId)}__v__${String(variantId)}`;
}

/**
 * @param {NormalizedVariant[]} variants
 */
export function getCheapestVariantPrice(variants) {
  if (!variants.length) return 0;
  return variants.reduce((m, v) => Math.min(m, v.price), Number.POSITIVE_INFINITY);
}

/**
 * Card + modal meta: fixed products use list price; variant products use cheapest variant.
 * @param {Record<string, unknown>} p
 */
export function getBuyerProductCardOfferMeta(p) {
  const base = getProductOfferMeta(p);
  if (!productHasSelectableVariants(p)) {
    return {
      ...base,
      pricingMode: /** @type {const} */ ("fixed"),
      showFrom: false,
    };
  }
  const vars = normalizeProductVariants(p);
  const minP = getCheapestVariantPrice(vars);
  let minOrig;
  for (const v of vars) {
    if (v.price === minP && v.originalPrice != null && v.originalPrice > v.price) {
      minOrig = v.originalPrice;
      break;
    }
  }
  const hasStrike = minOrig != null && minOrig > minP;
  return {
    price: minP,
    originalPrice: hasStrike ? minOrig : undefined,
    offerLabel: hasStrike ? base.offerLabel || "OFFER" : "",
    hasDiscount: hasStrike,
    pricingMode: /** @type {const} */ ("variants"),
    showFrom: true,
  };
}

/**
 * @param {unknown} p
 */
export function getProductVariantSearchBlob(p) {
  if (!productHasSelectableVariants(p)) return "";
  return normalizeProductVariants(/** @type {Record<string, unknown>} */ (p))
    .map((v) => `${v.label} ${v.subLabel}`.trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/**
 * @param {unknown} p
 * @param {string} variantId
 * @returns {NormalizedVariant | null}
 */
export function findVariantOnProduct(p, variantId) {
  const id = String(variantId || "").trim();
  if (!id) return null;
  return normalizeProductVariants(/** @type {Record<string, unknown>} */ (p)).find((v) => v.id === id) || null;
}

/**
 * @param {string} baseName
 * @param {string} [variantLabel]
 */
export function formatLineDisplayName(baseName, variantLabel) {
  const b = String(baseName || "Item").trim() || "Item";
  const v = String(variantLabel || "").trim();
  if (!v) return b;
  return `${b} (${v})`;
}

// --- Combo line items (seller-defined) ---

/**
 * @param {Record<string, unknown>} c
 */
export function normalizeComboItemEntries(c) {
  const raw = c?.items ?? c?.itemList ?? c?.comboItems;
  if (!Array.isArray(raw)) return [];
  return raw.map((it, idx) => {
    if (typeof it === "string") {
      const productId = String(it).trim();
      return {
        productId,
        requiresVariant: false,
        variantId: "",
        rawIndex: idx,
      };
    }
    const o = /** @type {Record<string, unknown>} */ (it || {});
    const productId = String(o.productId ?? o.id ?? "").trim();
    const requiresVariant = o.requiresVariant === true || o.requireVariant === true;
    const variantId = String(o.variantId ?? o.selectedVariantId ?? "").trim();
    return { productId, requiresVariant, variantId, rawIndex: idx };
  });
}

/**
 * @param {Record<string, unknown>} c
 * @param {Map<string, Record<string, unknown>> | undefined} productById
 */
export function getComboVariantPickRequirements(c, productById) {
  const entries = normalizeComboItemEntries(c);
  /** @type {{ productId: string, productName: string, requiresPick: boolean, fixedVariantId: string }[]} */
  const out = [];
  for (const e of entries) {
    if (!e.productId) continue;
    const p = productById?.get(e.productId);
    const name = p?.name != null ? String(p.name) : "Item";
    const hasVariants = Boolean(p && productHasSelectableVariants(p));
    const fixedVariantId = e.variantId || "";
    const requiresPick = Boolean(e.requiresVariant && hasVariants && !fixedVariantId);
    out.push({ productId: e.productId, productName: name, requiresPick, fixedVariantId });
  }
  return out;
}

/**
 * @param {Record<string, unknown>} c
 * @param {Map<string, Record<string, unknown>> | undefined} productById
 */
export function comboNeedsBuyerVariantPicks(c, productById) {
  return getComboVariantPickRequirements(c, productById).some((x) => x.requiresPick);
}

/**
 * Resolved variant picks for a combo (fixed seller variants only — no buyer choices).
 * @param {Record<string, unknown>} c
 * @param {Map<string, Record<string, unknown>> | undefined} productById
 * @returns {{ productId: string, variantId: string, variantLabel: string, subLabel: string }[]}
 */
export function buildDefaultComboVariantPicks(c, productById) {
  if (!productById) return [];
  /** @type {{ productId: string, variantId: string, variantLabel: string, subLabel: string }[]} */
  const picks = [];
  for (const r of getComboVariantPickRequirements(c, productById)) {
    if (!r.fixedVariantId) continue;
    const p = productById.get(r.productId);
    if (!p || !productHasSelectableVariants(p)) continue;
    const v = findVariantOnProduct(p, r.fixedVariantId);
    if (!v) continue;
    picks.push({
      productId: r.productId,
      variantId: v.id,
      variantLabel: v.label,
      subLabel: v.subLabel || "",
    });
  }
  return picks;
}
