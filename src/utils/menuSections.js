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
 * @param {string} s
 * @returns {string}
 */
function slugifyName(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "group";
}

/**
 * When Firestore has no `menuGroups`, derive one synthetic group per distinct `product.category`.
 * @param {Array<Record<string, unknown>>} products
 * @returns {Array<{id: string, name: string, slug: string, productIds: string[], active: boolean, sortOrder: number, _fallback?: true}>}
 */
export function buildCategoryFallbackMenuGroups(products) {
  if (!Array.isArray(products) || products.length === 0) return [];
  const byCat = new Map();
  for (const p of products) {
    const id = p?.id != null ? String(p.id) : "";
    if (!id) continue;
    const raw = p?.category != null ? String(p.category) : "";
    const cat = raw.trim() || "Other";
    if (!byCat.has(cat)) byCat.set(cat, /** @type {string[]} */ ([]));
    byCat.get(cat).push(id);
  }
  const names = Array.from(byCat.keys()).sort((a, b) => a.localeCompare(b));
  return names.map((name, i) => {
    const slug = slugifyName(name);
    return {
      id: `fb__${i}_${encodeURIComponent(name).replace(/%/g, "_")}`,
      name,
      slug,
      productIds: byCat.get(name) || [],
      active: true,
      sortOrder: i,
      _fallback: true,
    };
  });
}

/**
 * Menu session: restrict buyer to one group, or combos only, or show full day menu.
 * @param {Record<string, unknown> | null | undefined} seller
 * @param {Array<{id: string, name?: string, slug?: string, productIds?: string[]}>} groups
 * @returns
 *  | { mode: "all" }
 *  | { mode: "combosOnly" }
 *  | { mode: "oneGroup", groupId: string, label: string }
 *  | { mode: "legacyNoGroups", slot: "breakfast"|"lunch"|"dinner"|"specials"|"other" }
 */
export function resolveMenuSessionForGroups(seller, groups) {
  if (!seller) return { mode: "all" };
  const list = Array.isArray(groups) ? groups : [];
  const raw0 = seller.menuSession ?? seller.currentMenu ?? seller.activeMenu;
  if (raw0 == null || !String(raw0).trim()) return { mode: "all" };
  const raw = String(raw0).trim();
  const lower = raw.toLowerCase();
  if (
    lower === "all" ||
    lower === "all day" ||
    lower === "all-day" ||
    lower === "fullday" ||
    lower === "full day" ||
    lower === "everyday" ||
    lower === "entire" ||
    lower === "full"
  ) {
    return { mode: "all" };
  }

  const leg = getSellerMenuSession(seller);
  if (leg.mode === "slot" && leg.slot === "combos") {
    return { mode: "combosOnly" };
  }
  const hasProductMenuGroupCombos = list.some(
    (g) =>
      String(g.name || "")
        .trim()
        .toLowerCase() === "combos" ||
      String(g.slug || "")
        .trim()
        .toLowerCase() === "combos"
  );
  if (lower === "combos" && !hasProductMenuGroupCombos) {
    return { mode: "combosOnly" };
  }

  if (list.length) {
    for (const g of list) {
      if (g.id && raw === g.id) {
        return { mode: "oneGroup", groupId: g.id, label: String(g.name || g.slug || "Menu") };
      }
    }
    for (const g of list) {
      const gs = String(g.slug || "").trim().toLowerCase();
      if (gs && lower === gs) {
        return { mode: "oneGroup", groupId: g.id, label: String(g.name || g.slug) };
      }
    }
    for (const g of list) {
      const gn = String(g.name || "").trim().toLowerCase();
      if (gn && lower === gn) {
        return { mode: "oneGroup", groupId: g.id, label: String(g.name) };
      }
    }
    for (const g of list) {
      const gs = String(g.slug || "").trim().toLowerCase();
      if (gs && gs.length >= 3 && (lower === gs || lower.startsWith(`${gs} `) || lower.endsWith(` ${gs}`))) {
        return { mode: "oneGroup", groupId: g.id, label: String(g.name || g.slug) };
      }
    }
  }

  if (leg.mode === "slot" && leg.slot) {
    if (leg.slot === "combos") {
      return { mode: "combosOnly" };
    }
    if (list.length) {
      for (const g of list) {
        const s = String(g.slug || "")
          .trim()
          .toLowerCase();
        if (s && s === String(leg.slot)) {
          return { mode: "oneGroup", groupId: g.id, label: String(g.name || leg.slot) };
        }
        const n = String(g.name || "")
          .trim()
          .toLowerCase();
        if (n && n === String(leg.slot)) {
          return { mode: "oneGroup", groupId: g.id, label: String(g.name) };
        }
        const nSlug = slugifyName(String(g.name || ""));
        if (nSlug && nSlug === String(leg.slot)) {
          return { mode: "oneGroup", groupId: g.id, label: String(g.name || leg.slot) };
        }
      }
    } else {
      if (
        leg.slot === "breakfast" ||
        leg.slot === "lunch" ||
        leg.slot === "dinner" ||
        leg.slot === "specials" ||
        leg.slot === "other"
      ) {
        return { mode: "legacyNoGroups", slot: leg.slot };
      }
    }
  }
  if (list.length && (lower.includes("breakfast") || lower.includes("lunch") || lower.includes("dinner"))) {
    for (const g of list) {
      const gs = String(g.slug || "").trim().toLowerCase();
      if (gs && lower.includes(gs) && ["breakfast", "lunch", "dinner"].includes(gs)) {
        return { mode: "oneGroup", groupId: g.id, label: String(g.name || g.slug) };
      }
    }
  }

  return { mode: "all" };
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
