import { isDiscountSectionProduct } from "./pricing";

/**
 * @typedef {"breakfast"|"lunch"|"dinner"|"specials"|"other"} MenuSlot
 */

const SLOT_ORDER = /** @type {const} */ (["breakfast", "lunch", "dinner", "specials", "other"]);

const SLOT_LABEL = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  specials: "Specials",
  other: "Other",
};

/**
 * @param {Record<string, unknown>} p
 * @param {{ hasDiscount: boolean }} meta
 * @returns {MenuSlot}
 */
export function getProductMenuSlot(p, meta) {
  const raw = p.menuSection || p.mealType || p.mealSlot || p.menuGroup || p.section;
  if (typeof raw === "string" && raw.trim()) {
    const r = raw.trim().toLowerCase();
    if (r.includes("breakfast") || r === "brunch") return "breakfast";
    if (r.includes("lunch")) return "lunch";
    if (r.includes("dinner") || r.includes("supper")) return "dinner";
    if (r.includes("special") || r === "deals" || r === "offers") return "specials";
  }

  const cat = String(p.category || "")
    .trim()
    .toLowerCase();
  if (cat.includes("breakfast") || cat === "brunch") return "breakfast";
  if (cat.includes("lunch")) return "lunch";
  if (cat.includes("dinner") || cat.includes("supper")) return "dinner";
  if (cat.includes("special") || cat.includes("chef") || cat.includes("bestseller")) {
    return "specials";
  }
  if (isDiscountSectionProduct(p, meta)) return "specials";
  return "other";
}

/**
 * When seller sets `menuSession` to a meal name, buyers only see that section.
 * `All` (or empty) = full menu.
 * @param {Record<string, unknown> | null | undefined} seller
 * @returns {{ mode: "all" | "slot", slot: string | null }}
 */
export function getSellerMenuSession(seller) {
  if (!seller) return { mode: "all", slot: null };
  const raw = seller.menuSession ?? seller.currentMenu ?? seller.activeMenu;
  if (raw == null || !String(raw).trim()) return { mode: "all", slot: null };
  const s = String(raw).trim().toLowerCase();
  if (s === "all" || s === "full" || s === "entire" || s === "everyday") {
    return { mode: "all", slot: null };
  }
  if (s.includes("breakfast") || s === "brunch" || s === "morning") {
    return { mode: "slot", slot: "breakfast" };
  }
  if (s.includes("lunch")) {
    return { mode: "slot", slot: "lunch" };
  }
  if (s.includes("dinner") || s.includes("supper") || s.includes("evening")) {
    return { mode: "slot", slot: "dinner" };
  }
  if (s.includes("combo")) {
    return { mode: "slot", slot: "combos" };
  }
  if (s.includes("special") || s.includes("deal") || s.includes("offer")) {
    return { mode: "slot", slot: "specials" };
  }
  return { mode: "all", slot: null };
}

/**
 * @param {MenuSlot} a
 * @param {MenuSlot} b
 * @returns {number}
 */
export function menuSlotOrder(a, b) {
  return SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b);
}

/**
 * @param {MenuSlot} slot
 * @returns {string}
 */
export function menuSlotLabel(slot) {
  return SLOT_LABEL[slot] || slot;
}

/**
 * @returns {readonly { id: string, label: string }[]}
 */
export function getMenuFilterChips() {
  return [
    { id: "all", label: "All" },
    { id: "breakfast", label: "Breakfast" },
    { id: "lunch", label: "Lunch" },
    { id: "dinner", label: "Dinner" },
    { id: "combos", label: "Combos" },
    { id: "specials", label: "Specials" },
    { id: "other", label: "More" },
  ];
}

/**
 * @param {Record<string, unknown>} p
 */
export function isProductUnavailable(p) {
  if (p == null) return true;
  if (p.isAvailable === false) return true;
  if (p.available === false) return true;
  if (p.inStock === false) return true;
  if (p.soldOut === true) return true;
  if (p.unavailable === true) return true;
  return false;
}

/**
 * @param {Record<string, unknown> | null | undefined} c
 * @returns {boolean}
 */
export function isComboUnavailable(c) {
  if (!c) return true;
  if (c.isAvailable === false) return true;
  if (c.available === false) return true;
  if (c.inStock === false) return true;
  if (c.soldOut === true) return true;
  return false;
}

/**
 * @param {Record<string, unknown>} p
 * @returns {"veg"|"nonveg"|"egg"|"unknown"}
 */
export function getVegType(p) {
  const v = p.vegType ?? p.diet ?? p.foodType;
  if (typeof v === "string") {
    const s = v
      .toLowerCase()
      .replace(/[\s_-]+/g, "");
    if (
      s.includes("nonveg") ||
      s === "nonvegor" ||
      s.includes("meat")
    ) {
      return "nonveg";
    }
    if (s.includes("egg")) return "egg";
    if (s.includes("veg")) return "veg";
  }
  if (p.isVeg === true || p.vegetarian === true) return "veg";
  if (p.isVeg === false) return "nonveg";
  if (Array.isArray(p.tags)) {
    const t = p.tags.map((x) => String(x).toLowerCase()).join(" ");
    if (
      t.includes("nonveg") ||
      t.includes("chicken") ||
      t.includes("mutton") ||
      t.includes("meat") ||
      t.includes("fish")
    ) {
      return "nonveg";
    }
    if (t.includes("egg")) return "egg";
    if (t.includes("veg") || t.includes("veggie")) return "veg";
  }
  return "unknown";
}
