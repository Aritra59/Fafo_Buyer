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
