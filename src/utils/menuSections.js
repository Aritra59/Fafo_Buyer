import { isDiscountSectionProduct } from "./pricing";
import { extractMenuComboIds, extractMenuProductIds } from "./menuAssignment";

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
 * @param {Record<string, unknown> | null | undefined} seller
 * @returns {boolean}
 */
function hasMenuSessionString(seller) {
  if (!seller) return false;
  const raw = seller.menuSession ?? seller.currentMenu ?? seller.activeMenu;
  return raw != null && String(raw).trim() !== "";
}

/**
 * Live menu for buyers: use Firebase `menuSession` / `activeMenu` when set, else time-of-day schedule
 * (when the seller is not in manual-override mode). Respects the same one-group / combos / legacy
 * resolution as `resolveMenuSessionForGroups` when a session string is present.
 *
 * @param {Record<string, unknown> | null | undefined} seller
 * @param {Array<{ id?: string, name?: string, slug?: string, sortOrder?: number }>} groups
 * @param {Date} [now]
 * @returns
 *  | { mode: "all" }
 *  | { mode: "combosOnly" }
 *  | { mode: "oneGroup", groupId: string, label: string }
 *  | { mode: "legacyNoGroups", slot: "breakfast"|"lunch"|"dinner"|"specials"|"other" }
 */
export function resolveEffectiveMenuSession(seller, groups, now = new Date()) {
  if (!seller) return { mode: "all" };
  const list = Array.isArray(groups) ? groups : [];
  if (isSellerMenuManualOverride(seller) || hasMenuSessionString(seller)) {
    return resolveMenuSessionForGroups(seller, list);
  }
  if (list.length === 0) {
    const leg = getSellerMenuSession(seller);
    if (leg.mode === "slot" && leg.slot === "combos") {
      return { mode: "combosOnly" };
    }
    if (
      leg.mode === "slot" &&
      leg.slot &&
      (leg.slot === "breakfast" || leg.slot === "lunch" || leg.slot === "dinner" || leg.slot === "specials" || leg.slot === "other")
    ) {
      return { mode: "legacyNoGroups", slot: leg.slot };
    }
    return { mode: "all" };
  }
  const gid = getSchedulePreferredMenuGroupId(list, now);
  if (!gid) return { mode: "all" };
  const g = list.find((x) => String(x.id) === String(gid));
  if (!g || !g.id) return { mode: "all" };
  if (String(g.name || "").trim().toLowerCase() === "combos" || String(g.slug || "").trim().toLowerCase() === "combos") {
    return { mode: "combosOnly" };
  }
  const pCount = extractMenuProductIds(/** @type {Record<string, unknown>} */ (g)).length;
  const cCount = extractMenuComboIds(/** @type {Record<string, unknown>} */ (g)).length;
  if (pCount === 0 && cCount > 0) {
    const n = `${String(g.name || "")} ${String(g.slug || "")}`.trim().toLowerCase();
    if (n.includes("combo")) return { mode: "combosOnly" };
  }
  return { mode: "oneGroup", groupId: String(g.id), label: String(g.name || g.slug || "Menu") };
}

/**
 * @param {Array<Record<string, unknown>>} products
 * @param {string} menuLabel — fallback for uncategorized
 * @returns {{ id: string, label: string }[]}
 */
export function categoryPillsFromProducts(products, menuLabel = "Menu") {
  if (!Array.isArray(products) || products.length === 0) return [];
  const seen = new Set();
  const out = /** @type {{ id: string, label: string }[]} */ ([]);
  for (const p of products) {
    const raw = p?.category ?? p?.cuisine ?? p?.menuCategory ?? p?.section ?? p?.type ?? "";
    const label = String(raw).trim() || String(menuLabel).trim() || "Menu";
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({
      id: `cat__${out.length}_${label}`.replace(/\s+/g, "_"),
      label,
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  return out;
}

/**
 * When true, buyer respects seller `menuSession` / active menu locking.
 * When false, full menus stay visible and time-of-day only picks the default tab.
 * @param {Record<string, unknown> | null | undefined} seller
 * @returns {boolean}
 */
export function isSellerMenuManualOverride(seller) {
  if (!seller) return false;
  if (
    seller.menuManualOverride === true ||
    seller.menuSessionManual === true ||
    seller.menuOverrideManual === true ||
    seller.activeMenuManual === true ||
    seller.manualMenuSession === true
  ) {
    return true;
  }
  const raw = seller.menuSessionSource ?? seller.menuSessionMode ?? seller.activeMenuSource;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    if (s === "manual" || s === "override" || s === "locked") return true;
    if (s === "schedule" || s === "auto" || s === "automatic") return false;
  }
  return false;
}

/**
 * Breakfast / lunch / dinner first, then other menus by `sortOrder`.
 * @param {Array<{ id?: string, name?: string, slug?: string, sortOrder?: number }>} groups
 */
export function sortMenuGroupsForBuyerTabs(groups) {
  const list = Array.isArray(groups) ? [...groups] : [];
  const mealRank = (g) => {
    const n = `${String(g?.name || "")} ${String(g?.slug || "")}`.trim().toLowerCase();
    if (n.includes("breakfast") || n.includes("brunch") || n.includes("morning")) return 0;
    if (n.includes("lunch")) return 1;
    if (n.includes("dinner") || n.includes("supper") || n.includes("evening")) return 2;
    return 10 + (Number(g?.sortOrder) || 0) / 1_000_000;
  };
  list.sort((a, b) => {
    const ra = mealRank(a);
    const rb = mealRank(b);
    if (ra !== rb) return ra - rb;
    return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
  });
  return list;
}

/**
 * Local device time — picks a menu tab to show first when seller is on schedule mode.
 * @param {Array<{ id?: string, name?: string, slug?: string }>} groups
 * @param {Date} [now]
 * @returns {string | null}
 */
export function getSchedulePreferredMenuGroupId(groups, now = new Date()) {
  const list = Array.isArray(groups) ? groups : [];
  if (!list.length) return null;
  const h = now.getHours() + now.getMinutes() / 60;
  let want = "dinner";
  if (h >= 5 && h < 11) want = "breakfast";
  else if (h >= 11 && h < 16) want = "lunch";
  else if (h >= 16 && h < 23) want = "dinner";
  else want = "late";
  const find = (key) => {
    for (const g of list) {
      const n = `${String(g.name || "")} ${String(g.slug || "")}`.toLowerCase();
      if (key === "breakfast" && (n.includes("breakfast") || n.includes("brunch") || n.includes("morning"))) {
        return g.id ? String(g.id) : null;
      }
      if (key === "lunch" && n.includes("lunch")) return g.id ? String(g.id) : null;
      if (
        key === "dinner" &&
        (n.includes("dinner") || n.includes("supper") || n.includes("evening"))
      ) {
        return g.id ? String(g.id) : null;
      }
      if (key === "late" && (n.includes("dinner") || n.includes("late") || n.includes("night"))) {
        return g.id ? String(g.id) : null;
      }
    }
    return null;
  };
  if (want === "late") return find("late") || find("dinner") || (list[0].id ? String(list[0].id) : null);
  return find(want) || (list[0].id ? String(list[0].id) : null);
}

/**
 * Menu names/slugs that match the search query (for cross-menu search).
 * @param {Array<{ id?: string, name?: string, slug?: string }>} groups
 * @param {string} q
 */
export function groupIdsMatchingMenuSearch(groups, q) {
  const t = String(q || "").trim().toLowerCase();
  const out = new Set();
  if (!t || !Array.isArray(groups)) return out;
  for (const g of groups) {
    const id = g.id != null ? String(g.id) : "";
    if (!id) continue;
    const n = String(g.name || "").trim().toLowerCase();
    const s = String(g.slug || "").trim().toLowerCase();
    if (n.includes(t) || s.includes(t)) out.add(id);
    else if (t.length >= 4 && n && t.includes(n)) out.add(id);
  }
  return out;
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
