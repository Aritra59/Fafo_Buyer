/**
 * Normalize a Firestore menu reference to a comparable product/combo id string.
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeMenuIdRef(raw) {
  if (raw == null) return "";
  if (typeof raw === "string" || typeof raw === "number") {
    const s = String(raw).trim();
    if (!s) return "";
    if (s.includes("/")) {
      const parts = s.split("/").filter(Boolean);
      const last = parts[parts.length - 1];
      return last ? String(last).trim() : s;
    }
    return s;
  }
  if (typeof raw === "object") {
    const o = /** @type {Record<string, unknown>} */ (raw);
    const id = o.id ?? o.productId ?? o.product_id ?? o.productID ?? o.sku;
    if (id != null) return normalizeMenuIdRef(id);
  }
  return "";
}

/**
 * @param {Record<string, unknown> | null | undefined} group
 * @returns {string[]}
 */
export function extractMenuProductIds(group) {
  if (!group) return [];
  const g = /** @type {Record<string, unknown>} */ (group);
  const direct = g.productIds ?? g.productIDList ?? g.product_id_list;
  const items = g.items ?? g.menuItems ?? g.products ?? g.dishIds;
  const fromDirect = Array.isArray(direct) ? direct.map(normalizeMenuIdRef).filter(Boolean) : [];
  const fromItems = Array.isArray(items) ? items.map(normalizeMenuIdRef).filter(Boolean) : [];
  if (fromDirect.length && fromItems.length) {
    const seen = new Set(fromDirect);
    const rest = fromItems.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return [...fromDirect, ...rest];
  }
  return fromDirect.length ? fromDirect : fromItems;
}

/**
 * @param {Record<string, unknown> | null | undefined} group
 * @returns {string[]}
 */
export function extractMenuComboIds(group) {
  if (!group) return [];
  const g = /** @type {Record<string, unknown>} */ (group);
  const direct = g.comboIds ?? g.combo_ids ?? g.comboIDList ?? g.combo_id_list;
  const nested = g.combos ?? g.comboItems;
  const fromDirect = Array.isArray(direct) ? direct.map(normalizeMenuIdRef).filter(Boolean) : [];
  const fromNested = Array.isArray(nested) ? nested.map(normalizeMenuIdRef).filter(Boolean) : [];
  if (fromDirect.length && fromNested.length) {
    const seen = new Set(fromDirect);
    const rest = fromNested.filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    return [...fromDirect, ...rest];
  }
  return fromDirect.length ? fromDirect : fromNested;
}

/**
 * Multi-key lookup: doc id, productId, sku, slug (trimmed strings).
 * @param {Array<Record<string, unknown>>} products
 * @returns {Map<string, Record<string, unknown>>}
 */
export function buildProductLookupMap(products) {
  /** @type {Map<string, Record<string, unknown>>} */
  const m = new Map();
  const put = (key, p) => {
    const k = String(key || "").trim();
    if (!k || m.has(k)) return;
    m.set(k, p);
  };
  for (const p of products || []) {
    if (!p || p.id == null) continue;
    put(String(p.id), p);
    const n = Number(p.id);
    if (Number.isFinite(n)) put(String(n), p);
    put(p.productId, p);
    put(p.sku, p);
    put(p.slug, p);
  }
  return m;
}

/**
 * @param {Map<string, Record<string, unknown>>} map
 * @param {unknown} ref
 * @returns {Record<string, unknown> | undefined}
 */
export function lookupProductByMenuRef(map, ref) {
  const k = normalizeMenuIdRef(ref);
  if (!k || !map) return undefined;
  const p = map.get(k);
  if (p) return p;
  return undefined;
}

/**
 * @param {Array<Record<string, unknown>>} products
 * @returns {{ category: string, list: Record<string, unknown>[] }[]}
 */
/**
 * @param {Array<Record<string, unknown>>} combos
 * @returns {Map<string, Record<string, unknown>>}
 */
export function buildComboLookupMap(combos) {
  /** @type {Map<string, Record<string, unknown>>} */
  const m = new Map();
  for (const c of combos || []) {
    if (!c || c.id == null) continue;
    const id = String(c.id).trim();
    if (!id) continue;
    m.set(id, c);
    const n = Number(c.id);
    if (Number.isFinite(n)) m.set(String(n), c);
  }
  return m;
}

/**
 * @param {Map<string, Record<string, unknown>>} map
 * @param {unknown} ref
 * @returns {Record<string, unknown> | undefined}
 */
export function lookupComboByMenuRef(map, ref) {
  const k = normalizeMenuIdRef(ref);
  if (!k || !map) return undefined;
  return map.get(k);
}

export function groupProductsByCategory(products) {
  const m = new Map();
  for (const p of products || []) {
    const raw =
      p?.category ??
      p?.cuisine ??
      p?.menuCategory ??
      p?.section ??
      p?.type ??
      "";
    const cat = String(raw).trim() || "Menu";
    if (!m.has(cat)) m.set(cat, []);
    m.get(cat).push(p);
  }
  return Array.from(m.entries())
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
    .map(([category, list]) => ({ category, list }));
}

/** Same basis as buyer Menu chips: category / menuCategory / section / type. */
export function getShopMenuSectionLabel(p) {
  if (p == null) return "Menu";
  const o = /** @type {Record<string, unknown>} */ (p);
  return (
    String(o.category ?? o.menuCategory ?? o.section ?? o.type ?? "").trim() || "Menu"
  );
}

const ITEM_TYPE_ORDER = /** @type {const} */ (["Tea", "Coffee", "Drinks", "Other"]);

/** Internal merge key when a storefront name field is empty (shown as "Other"). */
const NAME_BUCKET_OTHER_KEY = "__name_other__";

/**
 * @param {unknown} rawName
 */
function groupingFromCategoryName(rawName) {
  const t = String(rawName ?? "").trim();
  if (!t) return { mergeKey: NAME_BUCKET_OTHER_KEY, title: "Other" };
  return { mergeKey: t.toLowerCase(), title: t };
}

/** @param {Record<string, unknown>} p */
function cuisineCategoryNameFromProduct(p) {
  return groupingFromCategoryName(
    p.cuisineCategoryName ?? p.cuisine_category_name ?? ""
  );
}

/** @param {Record<string, unknown>} p */
function menuCategoryNameFromProduct(p) {
  return groupingFromCategoryName(p.menuCategoryName ?? p.menu_category_name ?? "");
}

/** @param {Record<string, unknown>} p */
function itemCategoryNameFromProduct(p) {
  return groupingFromCategoryName(p.itemCategoryName ?? p.item_category_name ?? "");
}

/** Alphabetical sort; `"Other"` last. */
export function compareCategoryDisplayTitles(a, b) {
  const isOther = (/** @type {unknown} */ x) =>
    String(x ?? "").trim().toLowerCase() === "other";
  if (isOther(a) !== isOther(b)) return isOther(a) ? 1 : -1;
  return String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    sensitivity: "base",
    numeric: true,
  });
}

/**
 * @param {Record<string, unknown>[]} arr
 */
function sortProductsByName(arr) {
  const list = [...(arr || [])];
  list.sort((a, b) =>
    String(a?.name ?? "")
      .trim()
      .localeCompare(String(b?.name ?? "").trim(), undefined, {
        sensitivity: "base",
        numeric: true,
      })
  );
  return list;
}

/**
 * Cuisine name → Menu name → Item category name buckets; dish lists sorted by name.
 * @returns {{
 *   cuisineKey: string,
 *   cuisineTitle: string,
 *   menus: {
 *     menuKey: string,
 *     menuTitle: string,
 *     itemCategories: {
 *       itemCategoryKey: string,
 *       itemCategoryTitle: string,
 *       list: Record<string, unknown>[],
 *     }[],
 *   }[],
 * }[]}
 */
export function groupProductsByCuisineMenuItemCategory(products) {
  /** @typedef {{ title: string, cats: Map<string, { title: string, items: Record<string, unknown>[] }> }} MenuAcc */
  /** @type Map<string, { title: string, menus: Map<string, MenuAcc> }> */
  const byCuisine = new Map();

  for (const p of products || []) {
    if (!p || typeof p !== "object") continue;
    const pr = /** @type {Record<string, unknown>} */ (p);

    const { mergeKey: ck, title: cTitle } = cuisineCategoryNameFromProduct(pr);

    const { mergeKey: mk, title: menuTitle } = menuCategoryNameFromProduct(pr);

    const { mergeKey: icKey, title: catTitle } = itemCategoryNameFromProduct(pr);

    if (!byCuisine.has(ck)) {
      byCuisine.set(ck, { title: cTitle, menus: new Map() });
    }
    const cuis = byCuisine.get(ck);
    if (!cuis) continue;

    if (!cuis.menus.has(mk)) {
      cuis.menus.set(mk, { title: menuTitle, cats: new Map() });
    }
    const mu = cuis.menus.get(mk);
    if (!mu) continue;

    const existingCat = mu.cats.get(icKey);
    if (!existingCat) {
      mu.cats.set(icKey, { title: catTitle, items: [pr] });
    } else {
      existingCat.items.push(pr);
    }
  }

  const sortedCuisineKeys = Array.from(byCuisine.keys()).sort((ka, kb) => {
    const ta = /** @type {string} */(byCuisine.get(ka)?.title ?? "Other");
    const tb = /** @type {string} */(byCuisine.get(kb)?.title ?? "Other");
    return compareCategoryDisplayTitles(ta, tb);
  });

  /** @type {{ cuisineKey: string, cuisineTitle: string, menus: object[] }[]} */
  const out = [];

  for (const ck of sortedCuisineKeys) {
    const node = byCuisine.get(ck);
    if (!node) continue;
    const menuKeysSorted = Array.from(node.menus.keys()).sort((ka, kb) => {
      const ta = /** @type {string} */(node.menus.get(ka)?.title ?? "Other");
      const tb = /** @type {string} */(node.menus.get(kb)?.title ?? "Other");
      return compareCategoryDisplayTitles(ta, tb);
    });

    /** @type {object[]} */
    const menusOut = [];

    for (const mk of menuKeysSorted) {
      const mn = node.menus.get(mk);
      if (!mn) continue;
      const catKeysSorted = Array.from(mn.cats.keys()).sort((ixa, ixb) => {
        const ta = /** @type {string} */(mn.cats.get(ixa)?.title ?? "Other");
        const tb = /** @type {string} */(mn.cats.get(ixb)?.title ?? "Other");
        return compareCategoryDisplayTitles(ta, tb);
      });

      const itemCategories = catKeysSorted.map((ik) => {
        const cg = mn.cats.get(ik);
        const listSorted = cg ? sortProductsByName(cg.items) : [];
        return {
          itemCategoryKey: ik,
          itemCategoryTitle: cg?.title ?? "Other",
          list: listSorted,
        };
      });

      menusOut.push({
        menuKey: mk,
        menuTitle: mn.title ?? "Other",
        itemCategories,
      });
    }

    out.push({
      cuisineKey: ck,
      cuisineTitle: node.title ?? "Other",
      menus: menusOut,
    });
  }

  return out;
}

/**
 * Canonical beverage hint for search/combos — Tea / Coffee / Drinks / Other.
 * @param {Record<string, unknown>} p
 */
export function canonicalItemTypeLabelWithoutItemCategory(p) {
  if (!p || typeof p !== "object") return "Other";
  const o = /** @type {Record<string, unknown>} */ (p);

  /** @param {string} s lowercased or mixed text blob */
  const classifyBlob = (s) => {
    if (!String(s || "").trim()) return null;
    const x = String(s).toLowerCase();
    if (/\btea\b|^chai\b|masala chai|green tea|iced tea\b/i.test(x)) return "Tea";
    if (
      /\bcoffee\b|latte|cappuccino|espresso|americano|cold coffee|cold brew|cortado|mocha|flat white|frappe\b/i.test(
        x
      )
    )
      return "Coffee";
    if (
      /\bdrinks?\b|beverage|juice\b|smoothie\b|shake\b|mocktail|lemonade|soda\b|cold drink|frappe\b|\bcola\b|mojito\b/i.test(
        x
      )
    )
      return "Drinks";
    return null;
  };

  const raw = String(
    o.itemType ?? o.item_type ?? o.drinkType ?? o.drink_category ?? ""
  ).trim();
  if (raw) {
    const hit = classifyBlob(raw);
    if (hit) return hit;
    const low = raw.toLowerCase();
    const exact = ITEM_TYPE_ORDER.find((x) => x.toLowerCase() === low);
    if (exact && exact !== "Other") return exact;
  }

  /** @type {string[]} */
  const tagParts = [];
  const tags = o.tags;
  if (Array.isArray(tags)) {
    tags.forEach((u) => tagParts.push(String(u).toLowerCase()));
  } else if (typeof tags === "string" && tags.trim()) {
    tags
      .toLowerCase()
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => tagParts.push(s));
  }

  const name = String(o.name ?? "").toLowerCase();
  const blob = [name, ...tagParts].join(" ");
  return classifyBlob(blob) ?? "Other";
}

/**
 * Tea / Coffee / Drinks heuristic (products + combos) — unchanged behavior for search / combo hints.
 * @param {Record<string, unknown>} p
 */
export function canonicalItemTypeLabel(p) {
  return canonicalItemTypeLabelWithoutItemCategory(p);
}

/**
 * Combos inherit item types from constituent products plus optional combo.itemType fields.
 * @param {Record<string, unknown>} c
 * @param {Map<string, Record<string, unknown>>} productLookupMap
 */
export function comboCanonicalItemTypeLabels(c, productLookupMap) {
  const labels = new Set();
  labels.add(canonicalItemTypeLabel(c));
  const raw = c?.items ?? c?.itemList ?? c?.comboItems;
  const ids =
    typeof raw !== "undefined"
      ? extractMenuProductIds(
          /** @type {Record<string, unknown>} */ ({
            items: raw,
            productIds: c.productIds,
          })
        )
      : extractMenuProductIds(
          /** @type {Record<string, unknown>} */ ({ productIds: c.productIds })
        );
  for (const id of ids) {
    const pr = productLookupMap?.get(String(id));
    if (pr) labels.add(canonicalItemTypeLabel(/** @type {Record<string, unknown>} */ (pr)));
  }
  return [...labels];
}
