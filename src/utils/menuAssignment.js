/**
 * Normalize a Firestore menu reference to a comparable product/combo id string.
 * @param {unknown} raw
 * @returns {string}
 */
/**
 * When menu rows are objects (e.g. `{ productId, sequence }`), honor `sequence` / `sortOrder` for buyer order.
 * @param {unknown[] | null | undefined} rows
 * @returns {unknown[]}
 */
function sortMenuEmbedRows(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return Array.isArray(rows) ? rows : [];
  const allObj = rows.every((x) => x != null && typeof x === "object" && !Array.isArray(x));
  if (!allObj) return rows;
  return [...rows].sort((a, b) =>
    compareBySequenceAndCreatedAt(
      /** @type {Record<string, unknown>} */ (a),
      /** @type {Record<string, unknown>} */ (b),
      /** @type {const} */ (["sequence", "sortOrder", "order"])
    )
  );
}

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
  const itemsRaw = g.items ?? g.menuItems ?? g.products ?? g.dishIds;
  const items = Array.isArray(itemsRaw) ? sortMenuEmbedRows(itemsRaw) : [];
  const fromDirect = Array.isArray(direct) ? direct.map(normalizeMenuIdRef).filter(Boolean) : [];
  const fromItems = items.map(normalizeMenuIdRef).filter(Boolean);
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
  const nestedRaw = g.combos ?? g.comboItems;
  const nested = Array.isArray(nestedRaw) ? sortMenuEmbedRows(nestedRaw) : [];
  const fromDirect = Array.isArray(direct) ? direct.map(normalizeMenuIdRef).filter(Boolean) : [];
  const fromNested = nested.map(normalizeMenuIdRef).filter(Boolean);
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

function toEpochMs(raw) {
  if (raw == null) return Number.POSITIVE_INFINITY;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw < 1e12 ? raw * 1000 : raw;
  if (typeof raw === "string") {
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) return asNum < 1e12 ? asNum * 1000 : asNum;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }
  if (typeof raw === "object") {
    const o = /** @type {Record<string, unknown>} */ (raw);
    if (typeof o.toMillis === "function") {
      const v = o.toMillis();
      if (Number.isFinite(v)) return Number(v);
    }
    if (typeof o.seconds === "number") return o.seconds * 1000;
    if (typeof o._seconds === "number") return o._seconds * 1000;
  }
  return Number.POSITIVE_INFINITY;
}

function toSeq(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

function bestSeq(p, keys) {
  const o = /** @type {Record<string, unknown>} */ (p || {});
  for (const k of keys) {
    const v = toSeq(o[k]);
    if (Number.isFinite(v)) return v;
  }
  return Number.POSITIVE_INFINITY;
}

export function compareBySequenceAndCreatedAt(a, b, sequenceKeys = ["sequence", "sortOrder"]) {
  const sa = bestSeq(a, sequenceKeys);
  const sb = bestSeq(b, sequenceKeys);
  if (sa !== sb) return sa - sb;
  const oa = /** @type {Record<string, unknown>|null|undefined} */ (a);
  const ob = /** @type {Record<string, unknown>|null|undefined} */ (b);
  const ca = toEpochMs(oa?.createdAt ?? oa?.created_at);
  const cb = toEpochMs(ob?.createdAt ?? ob?.created_at);
  if (ca !== cb) return ca - cb;
  return String(a?.name ?? a?.title ?? a?.slug ?? a?.id ?? "").localeCompare(
    String(b?.name ?? b?.title ?? b?.slug ?? b?.id ?? ""),
    undefined,
    { sensitivity: "base", numeric: true }
  );
}

/** Single pipeline: `sequence` (and scoped sequence fields), then earliest `createdAt`. */
export const BUYER_PRODUCT_SEQUENCE_KEYS =
  /** @type {readonly ["sequence", "itemSequence", "sortOrder"]} */ (["sequence", "itemSequence", "sortOrder"]);
export const BUYER_COMBO_SEQUENCE_KEYS =
  /** @type {readonly ["sequence", "comboSequence", "sortOrder"]} */ (["sequence", "comboSequence", "sortOrder"]);
export const BUYER_MENU_GROUP_SEQUENCE_KEYS =
  /** @type {readonly ["sequence", "sortOrder"]} */ (["sequence", "sortOrder"]);

/** For tie-breaking buckets by earliest document time (matches {@link compareBySequenceAndCreatedAt}). */
export function arrangementCreatedMs(record) {
  const o = record && typeof record === "object" ? /** @type {Record<string, unknown>} */ (record) : null;
  return toEpochMs(o?.createdAt ?? o?.created_at);
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
  const raw = String(p.itemCategoryName ?? p.item_category_name ?? "").trim();
  if (!raw) return { mergeKey: "__no_item_category__", title: "" };
  return groupingFromCategoryName(raw);
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
 * Order filter-chip labels like the seller menu: min menu-level sequence ASC, then title.
 * @param {Iterable<string>} labels
 * @param {Record<string, unknown>[]} products
 * @param {Record<string, unknown>[]} combos
 * @param {Map<string, Record<string, unknown>> | null | undefined} productLookupMap
 * @returns {string[]}
 */
export function sortMenuSectionLabelsBySequence(labels, products, combos, productLookupMap) {
  const arr = Array.from(labels);
  /** @type {Map<string, number>} */
  const minSeq = new Map();
  /** @type {Map<string, number>} */
  const minCreated = new Map();
  const bumpSeq = (label, seqVal) => {
    const L = String(label || "").trim();
    if (!L) return;
    const s = Number(seqVal);
    const v = Number.isFinite(s) ? s : Number.POSITIVE_INFINITY;
    const prev = minSeq.get(L);
    if (prev == null || v < prev) minSeq.set(L, v);
  };
  const bumpCreated = (label, t) => {
    const L = String(label || "").trim();
    if (!L) return;
    const prev = minCreated.get(L);
    if (prev == null || t < prev) minCreated.set(L, t);
  };
  for (const p of products || []) {
    if (!p) continue;
    const pr = /** @type {Record<string, unknown>} */ (p);
    const lab = getShopMenuSectionLabel(pr);
    bumpSeq(
      lab,
      bestSeq(pr, ["menuCategorySequence", "menu_category_sequence", "menuSequence", "menuSortOrder"])
    );
    bumpCreated(lab, arrangementCreatedMs(pr));
  }
  for (const c of combos || []) {
    if (!c) continue;
    const co = /** @type {Record<string, unknown>} */ (c);
    const cM = String(co.menuCategory ?? co.category ?? "").trim();
    if (cM) {
      bumpSeq(cM, bestSeq(co, BUYER_COMBO_SEQUENCE_KEYS));
      bumpCreated(cM, arrangementCreatedMs(co));
    }
    const lineIds = extractMenuProductIds(
      /** @type {Record<string, unknown>} */ ({
        productIds: co.productIds,
        items: co.items ?? co.itemList ?? co.comboItems,
      })
    );
    for (const id of lineIds) {
      const p = productLookupMap?.get(String(id));
      if (!p) continue;
      const pr = /** @type {Record<string, unknown>} */ (p);
      const lab = getShopMenuSectionLabel(pr);
      bumpSeq(lab, bestSeq(pr, ["menuCategorySequence", "menu_category_sequence", "menuSequence", "menuSortOrder"]));
      bumpCreated(lab, arrangementCreatedMs(pr));
    }
  }
  arr.sort((a, b) => {
    const sa = minSeq.get(String(a)) ?? Number.POSITIVE_INFINITY;
    const sb = minSeq.get(String(b)) ?? Number.POSITIVE_INFINITY;
    if (sa !== sb) return sa - sb;
    const ca = minCreated.get(String(a)) ?? Number.POSITIVE_INFINITY;
    const cb = minCreated.get(String(b)) ?? Number.POSITIVE_INFINITY;
    if (ca !== cb) return ca - cb;
    return compareCategoryDisplayTitles(a, b);
  });
  return arr;
}

/**
 * @param {Record<string, unknown>[]} arr
 */
function sortProductsInCategory(arr) {
  const list = [...(arr || [])];
  list.sort((a, b) =>
    compareBySequenceAndCreatedAt(/** @type {Record<string, unknown>} */ (a), /** @type {Record<string, unknown>} */ (b), BUYER_PRODUCT_SEQUENCE_KEYS)
  );
  return list;
}

/**
 * Cuisine name → Menu name → Item category name buckets; dishes sorted by seller sequence.
 * @returns {{
 *   cuisineKey: string,
 *   cuisineTitle: string,
 *   menus: {
 *     menuKey: string,
 *     menuTitle: string,
 *     itemCategories: {
 *       itemCategoryKey: string,
 *       itemCategoryTitle: string,
 *       hasItemCategory: boolean,
 *       list: Record<string, unknown>[],
 *     }[],
 *   }[],
 * }[]}
 */
export function groupProductsByCuisineMenuItemCategory(products) {
  /** @typedef {{ title: string, seq: number, cats: Map<string, { title: string, seq: number, items: Record<string, unknown>[] }> }} MenuAcc */
  /** @type Map<string, { title: string, seq: number, menus: Map<string, MenuAcc> }> */
  const byCuisine = new Map();

  for (const p of products || []) {
    if (!p || typeof p !== "object") continue;
    const pr = /** @type {Record<string, unknown>} */ (p);

    const { mergeKey: ck, title: cTitle } = cuisineCategoryNameFromProduct(pr);

    const { mergeKey: mk, title: menuTitle } = menuCategoryNameFromProduct(pr);

    const { mergeKey: icKey, title: catTitle } = itemCategoryNameFromProduct(pr);

    const cuisineSeq = bestSeq(pr, [
      "cuisineCategorySequence",
      "cuisine_sequence",
      "cuisineSequence",
      "cuisineSortOrder",
    ]);
    const menuSeq = bestSeq(pr, [
      "menuCategorySequence",
      "menu_category_sequence",
      "menuSequence",
      "menuSortOrder",
    ]);
    const itemCategorySeq = bestSeq(pr, [
      "itemCategorySequence",
      "item_category_sequence",
      "itemTypeSequence",
      "itemSortOrder",
    ]);
    const pCreated = arrangementCreatedMs(pr);

    if (!byCuisine.has(ck)) {
      byCuisine.set(ck, { title: cTitle, seq: cuisineSeq, minCreated: pCreated, menus: new Map() });
    }
    const cuis = byCuisine.get(ck);
    if (!cuis) continue;
    if (cuisineSeq < cuis.seq) cuis.seq = cuisineSeq;
    if (pCreated < cuis.minCreated) cuis.minCreated = pCreated;

    if (!cuis.menus.has(mk)) {
      cuis.menus.set(mk, { title: menuTitle, seq: menuSeq, minCreated: pCreated, cats: new Map() });
    }
    const mu = cuis.menus.get(mk);
    if (!mu) continue;
    if (menuSeq < mu.seq) mu.seq = menuSeq;
    if (pCreated < mu.minCreated) mu.minCreated = pCreated;

    const existingCat = mu.cats.get(icKey);
    if (!existingCat) {
      mu.cats.set(icKey, {
        title: catTitle,
        seq: itemCategorySeq,
        minCreated: pCreated,
        items: [pr],
      });
    } else {
      if (itemCategorySeq < existingCat.seq) existingCat.seq = itemCategorySeq;
      existingCat.items.push(pr);
      if (pCreated < existingCat.minCreated) existingCat.minCreated = pCreated;
    }
  }

  const sortedCuisineKeys = Array.from(byCuisine.keys()).sort((ka, kb) => {
    const ca = byCuisine.get(ka);
    const cb = byCuisine.get(kb);
    const sdiff = (ca?.seq ?? Number.POSITIVE_INFINITY) - (cb?.seq ?? Number.POSITIVE_INFINITY);
    if (sdiff !== 0) return sdiff;
    const dcr = (ca?.minCreated ?? Number.POSITIVE_INFINITY) - (cb?.minCreated ?? Number.POSITIVE_INFINITY);
    if (dcr !== 0) return dcr;
    const ta = /** @type {string} */ (ca?.title ?? "Other");
    const tb = /** @type {string} */ (cb?.title ?? "Other");
    return compareCategoryDisplayTitles(ta, tb);
  });

  /** @type {{ cuisineKey: string, cuisineTitle: string, menus: object[] }[]} */
  const out = [];

  for (const ck of sortedCuisineKeys) {
    const node = byCuisine.get(ck);
    if (!node) continue;
    const menuKeysSorted = Array.from(node.menus.keys()).sort((ka, kb) => {
      const ma = node.menus.get(ka);
      const mb = node.menus.get(kb);
      const sdiff = (ma?.seq ?? Number.POSITIVE_INFINITY) - (mb?.seq ?? Number.POSITIVE_INFINITY);
      if (sdiff !== 0) return sdiff;
      const dcr = (ma?.minCreated ?? Number.POSITIVE_INFINITY) - (mb?.minCreated ?? Number.POSITIVE_INFINITY);
      if (dcr !== 0) return dcr;
      const ta = /** @type {string} */ (ma?.title ?? "Other");
      const tb = /** @type {string} */ (mb?.title ?? "Other");
      return compareCategoryDisplayTitles(ta, tb);
    });

    /** @type {object[]} */
    const menusOut = [];

    for (const mk of menuKeysSorted) {
      const mn = node.menus.get(mk);
      if (!mn) continue;
      const catKeysSorted = Array.from(mn.cats.keys()).sort((ixa, ixb) => {
        const ca = mn.cats.get(ixa);
        const cb = mn.cats.get(ixb);
        const sdiff = (ca?.seq ?? Number.POSITIVE_INFINITY) - (cb?.seq ?? Number.POSITIVE_INFINITY);
        if (sdiff !== 0) return sdiff;
        const dcr = (ca?.minCreated ?? Number.POSITIVE_INFINITY) - (cb?.minCreated ?? Number.POSITIVE_INFINITY);
        if (dcr !== 0) return dcr;
        const ta = /** @type {string} */ (ca?.title ?? "Other");
        const tb = /** @type {string} */ (cb?.title ?? "Other");
        return compareCategoryDisplayTitles(ta, tb);
      });

      const itemCategories = catKeysSorted.map((ik) => {
        const cg = mn.cats.get(ik);
        const listSorted = cg ? sortProductsInCategory(cg.items) : [];
        const itemCategoryTitle = String(cg?.title ?? "").trim();
        return {
          itemCategoryKey: ik,
          itemCategoryTitle,
          hasItemCategory: itemCategoryTitle.length > 0,
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
