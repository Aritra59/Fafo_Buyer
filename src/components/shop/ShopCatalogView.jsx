import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Search, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { subscribeProductsBySeller } from "../../services/productService";
import { subscribeCombosBySeller } from "../../services/comboService";
import { subscribeSellerById } from "../../services/sellerService";
import { subscribeMenuGroupsBySeller } from "../../services/menuGroupService";
import { useCart } from "../../context/CartContext";
import { getProductOfferMeta } from "../../utils/pricing";
import { formatCurrencyInr } from "../../utils/format";
import {
  formatSellerHoursDisplay,
  formatSellerHoursCompact,
  formatSellerOpensAtMessage,
} from "../../utils/shopStatus";
import { getShopOpenUiState } from "../../utils/shopOpenStatus";
import {
  buildCategoryFallbackMenuGroups,
  getProductMenuSlot,
  menuSlotLabel,
  resolveEffectiveMenuSession,
  sortMenuGroupsForBuyerTabs,
  groupIdsMatchingMenuSearch,
} from "../../utils/menuSections";
import {
  extractMenuProductIds,
  extractMenuComboIds,
  buildProductLookupMap,
  buildComboLookupMap,
  lookupProductByMenuRef,
  lookupComboByMenuRef,
  groupProductsByCategory,
} from "../../utils/menuAssignment";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { LazyImage } from "../ui/LazyImage";
import ProductCard from "./ProductCard";
import ComboCard from "./ComboCard";
import StorefrontAdRail from "../StorefrontAdRail";
import "../../styles/buyerShop.css";

function formatOffers(seller) {
  if (!seller) return [];
  const o = seller.offers ?? seller.shopOffers ?? seller.activeOffers;
  if (Array.isArray(o)) {
    return o
      .map((x) => (typeof x === "string" ? x : x?.text || x?.title || ""))
      .filter(Boolean);
  }
  if (typeof o === "string" && o.trim()) return [o.trim()];
  return [];
}

function productTagsString(p) {
  if (Array.isArray(p.tags)) return p.tags.map((x) => String(x).toLowerCase()).join(" ");
  if (typeof p.tags === "string" && p.tags.trim()) {
    return p.tags
      .toLowerCase()
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function productMatchesQuery(p, q) {
  if (!q) return true;
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const name = String(p.name || "").toLowerCase();
  const cat = String(p.category || "").toLowerCase();
  const tags = productTagsString(p);
  if (name.includes(t) || cat.includes(t) || tags.includes(t)) return true;
  for (const w of t.split(/\s+/)) {
    if (w && (name.includes(w) || tags.includes(w))) return true;
  }
  return t.split(/\s+/).every((w) => w && name.includes(w));
}

function comboItemsSummary(c) {
  const raw = c.items ?? c.itemList ?? c.comboItems;
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === "string" ? x : x?.name || x?.title || x?.label || ""))
      .filter(Boolean)
      .join(" · ");
  }
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  return "";
}

function comboTagsString(c) {
  if (Array.isArray(c.tags)) return c.tags.map((x) => String(x).toLowerCase()).join(" ");
  if (typeof c.tags === "string" && c.tags.trim()) {
    return c.tags
      .toLowerCase()
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

function comboMatchesQuery(c, q) {
  if (!q) return true;
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const name = String(c.name || "").toLowerCase();
  const sum = String(comboItemsSummary(c) || "").toLowerCase();
  const tags = comboTagsString(c);
  if (name.includes(t) || sum.includes(t) || tags.includes(t)) return true;
  for (const w of t.split(/\s+/)) {
    if (w && (name.includes(w) || tags.includes(w))) return true;
  }
  return false;
}

function getProductCuisine(p) {
  if (p == null) return "";
  return String(/** @type {Record<string, unknown>} */ (p).cuisine ?? p.cuisineType ?? p.region ?? "").trim();
}

function getProductMenuCategory(p) {
  if (p == null) return "Menu";
  return String(p.category ?? p.menuCategory ?? p.section ?? p.type ?? "").trim() || "Menu";
}

/**
 * @param {Record<string, unknown>} p
 * @param {{ kind: "all" } | { kind: "cuisine", value: string } | { kind: "category", value: string }} f
 */
function productMatchesViewFilter(p, f) {
  if (f.kind === "all") return true;
  if (f.kind === "cuisine") return getProductCuisine(p) === f.value;
  if (f.kind === "category") return getProductMenuCategory(p) === f.value;
  return true;
}

/**
 * @param {Record<string, unknown>} c
 * @param {{ kind: "all" } | { kind: "cuisine", value: string } | { kind: "category", value: string }} f
 * @param {Map<string, Record<string, unknown>>} productLookupMap
 */
function comboMatchesViewFilter(c, f, productLookupMap) {
  if (f.kind === "all") return true;
  const cC = String(c?.cuisine ?? c?.cuisineType ?? "").trim();
  const cG = String(c?.menuCategory ?? c?.category ?? "").trim();
  if (f.kind === "cuisine" && cC && cC === f.value) return true;
  if (f.kind === "category" && cG && cG === f.value) return true;
  for (const id of getComboLineProductIds(c)) {
    const p = productLookupMap.get(String(id));
    if (p && productMatchesViewFilter(p, f)) return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} c
 */
function getComboLineProductIds(c) {
  if (!c) return [];
  return extractMenuProductIds(/** @type {Record<string, unknown>} */ ({
    productIds: c.productIds,
    items: c.items ?? c.itemList ?? c.comboItems,
  }));
}

/**
 * @param {Record<string, unknown>} group
 * @param {Map<string, Record<string, unknown>>} productLookupMap
 * @param {string} q
 * @param {Set<string>} menuSearchIds
 * @param {Set<string> | null} allowedProductIds
 */
function pickProductsForMenuGroup(group, productLookupMap, q, menuSearchIds, allowedProductIds) {
  const out = [];
  const seen = new Set();
  const gid = group?.id != null ? String(group.id) : "";
  const inMenu = menuSearchIds.size > 0 && gid && menuSearchIds.has(gid);
  const refs = extractMenuProductIds(group);
  for (const ref of refs) {
    const p = lookupProductByMenuRef(productLookupMap, ref);
    if (!p || p.id == null) continue;
    const id = String(p.id);
    if (seen.has(id)) continue;
    if (allowedProductIds && !allowedProductIds.has(id)) continue;
    if (!productMatchesQuery(/** @type {Record<string, unknown>} */ (p), q) && !inMenu) continue;
    seen.add(id);
    out.push(/** @type {Record<string, unknown>} */ (p));
  }
  return out;
}

/**
 * @param {Record<string, unknown>} group
 * @param {Map<string, Record<string, unknown>>} comboLookupMap
 * @param {string} q
 * @param {Set<string>} menuSearchIds
 * @param {Set<string> | null} allowedComboIds
 */
function pickCombosForMenuGroup(group, comboLookupMap, q, menuSearchIds, allowedComboIds) {
  const gid = group?.id != null ? String(group.id) : "";
  const inMenu = menuSearchIds.size > 0 && gid && menuSearchIds.has(gid);
  const out = [];
  const seen = new Set();
  for (const ref of extractMenuComboIds(group)) {
    const c = lookupComboByMenuRef(comboLookupMap, ref);
    if (!c || c.id == null) continue;
    const id = String(c.id);
    if (seen.has(id)) continue;
    if (allowedComboIds && !allowedComboIds.has(id)) continue;
    if (!comboMatchesQuery(c, q) && !inMenu) continue;
    seen.add(id);
    out.push(c);
  }
  return out;
}

function BsProductGridSkeleton() {
  return (
    <ul className="bs-pgrid bs-pgrid--skeleton" aria-busy="true">
      {[1, 2, 3, 4, 5, 6].map((k) => (
        <li key={k} className="bs-sk-card">
          <div className="bs-sk-card__img" />
          <div className="bs-sk-card__body">
            <div className="bs-sk-line" />
            <div className="bs-sk-line bs-sk-line--sm" />
            <div className="bs-sk-line bs-sk-line--btn" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {object} p
 * @param {string} p.sellerId
 * @param {string} p.backTo
 * @param {string} p.backLabel
 * @param {boolean} [p.isPublic]
 */
export default function ShopCatalogView({ sellerId, backTo, backLabel, isPublic = false }) {
  const { addItem, lines, setQty, sellerId: cartSellerId, lineCount, total } = useCart();
  const [menuSearch, setMenuSearch] = useState("");
  const debouncedSearch = useDebouncedValue(menuSearch, 100);
  const [sessionClock, setSessionClock] = useState(0);
  const [activeFilterId, setActiveFilterId] = useState("all");
  const [products, setProducts] = useState([]);

  const [rawMenuGroups, setRawMenuGroups] = useState(
    /** @type {import("../../services/menuGroupService").MenuGroupDoc[]} */ ([])
  );
  const [menuGroupsLoaded, setMenuGroupsLoaded] = useState(false);
  const [menuGroupErr, setMenuGroupErr] = useState("");

  const [combos, setCombos] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [combosLoading, setCombosLoading] = useState(true);
  const [seller, setSeller] = useState(null);
  const [sellerErr, setSellerErr] = useState("");
  const [productErr, setProductErr] = useState("");
  const [comboErr, setComboErr] = useState("");

  useEffect(() => {
    const t = window.setInterval(() => setSessionClock((c) => c + 1), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const displayGroups = useMemo(() => {
    if (rawMenuGroups.length > 0) {
      return sortMenuGroupsForBuyerTabs(rawMenuGroups);
    }
    if (!menuGroupsLoaded) {
      return products.length > 0
        ? sortMenuGroupsForBuyerTabs(buildCategoryFallbackMenuGroups(products))
        : null;
    }
    return sortMenuGroupsForBuyerTabs(buildCategoryFallbackMenuGroups(products));
  }, [rawMenuGroups, menuGroupsLoaded, products]);

  const sessionResolved = useMemo(() => {
    if (displayGroups == null) {
      return /** @type {const} */ ({ mode: "all" });
    }
    return resolveEffectiveMenuSession(seller, displayGroups, new Date());
  }, [seller, displayGroups, sessionClock]);

  const sessionBaseProducts = useMemo(() => {
    if (displayGroups == null) return [];
    if (sessionResolved.mode === "combosOnly") return [];
    if (sessionResolved.mode === "legacyNoGroups" && "slot" in sessionResolved) {
      const slot = String(sessionResolved.slot);
      if (slot === "combos") return [];
      return products.filter((p) => {
        const meta = getProductOfferMeta(p);
        return getProductMenuSlot(p, meta) === String(slot);
      });
    }
    if (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved) {
      const gid = sessionResolved.groupId;
      const g = displayGroups.find((x) => x.id === gid);
      const s = new Set(extractMenuProductIds(/** @type {Record<string, unknown>} */ (g || {})));
      if (!s.size) return [];
      return products.filter((p) => s.has(String(p.id)));
    }
    return products;
  }, [products, displayGroups, sessionResolved]);

  const sessionBaseCombos = useMemo(() => {
    if (displayGroups == null) return [];
    if (sessionResolved.mode === "combosOnly") return combos;
    if (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved) {
      const gid = sessionResolved.groupId;
      const g = displayGroups.find((x) => x.id === gid);
      const refs = extractMenuComboIds(/** @type {Record<string, unknown>} */ (g || {}));
      if (!refs.length) return [];
      const m = buildComboLookupMap(combos);
      return refs.map((id) => lookupComboByMenuRef(m, id)).filter(Boolean);
    }
    if (sessionResolved.mode === "legacyNoGroups" && "slot" in sessionResolved) {
      if (String(sessionResolved.slot) === "combos") return combos;
    }
    return combos;
  }, [combos, displayGroups, sessionResolved]);

  const sessionLocked = useMemo(() => {
    return (
      (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved) ||
      sessionResolved.mode === "combosOnly"
    );
  }, [sessionResolved]);

  const sessionLabel = useMemo(() => {
    if (sessionResolved.mode === "combosOnly") return "Combos";
    if (sessionResolved.mode === "oneGroup" && "label" in sessionResolved) {
      return String(sessionResolved.label || "Menu");
    }
    if (sessionResolved.mode === "legacyNoGroups" && "slot" in sessionResolved) {
      const s = String(sessionResolved.slot);
      if (s === "combos") return "Combos";
      const key = ["breakfast", "lunch", "dinner", "specials", "other"].includes(s) ? s : "other";
      return menuSlotLabel(/** @type {"breakfast"|"lunch"|"dinner"|"specials"|"other"} */ (key));
    }
    if (displayGroups == null) return "Menu";
    if (rawMenuGroups.length > 0) {
      if (sessionResolved.mode === "all") return "Full menu";
      return (
        displayGroups
          .map((g) => String(g.name || g.slug).trim())
          .filter(Boolean)
          .join(" · ") || "Menu"
      );
    }
    return "Menu";
  }, [sessionResolved, displayGroups, rawMenuGroups.length]);

  const productLookupMap = useMemo(() => buildProductLookupMap(products), [products]);
  const comboLookupMap = useMemo(() => buildComboLookupMap(combos), [combos]);
  const productByIdForCollage = productLookupMap;

  const sessionProductIdSet = useMemo(() => {
    return new Set(sessionBaseProducts.map((p) => (p?.id != null ? String(p.id) : "")).filter(Boolean));
  }, [sessionBaseProducts]);

  const sessionComboIdSet = useMemo(() => {
    return new Set(sessionBaseCombos.map((c) => (c?.id != null ? String(c.id) : "")).filter(Boolean));
  }, [sessionBaseCombos]);

  const menuSearchIds = useMemo(
    () => groupIdsMatchingMenuSearch(displayGroups || [], debouncedSearch),
    [displayGroups, debouncedSearch]
  );

  const hasMenuAssignments = useMemo(() => {
    if (displayGroups == null || !displayGroups.length) return true;
    for (const g of displayGroups) {
      const pids = extractMenuProductIds(/** @type {Record<string, unknown>} */ (g));
      const cids = extractMenuComboIds(/** @type {Record<string, unknown>} */ (g));
      if (pids.length > 0 || cids.length > 0) return true;
    }
    return false;
  }, [displayGroups]);

  const unassignedCombos = useMemo(() => {
    const q = debouncedSearch;
    const assigned = new Set();
    if (displayGroups) {
      for (const g of displayGroups) {
        for (const cid of extractMenuComboIds(/** @type {Record<string, unknown>} */ (g))) {
          assigned.add(String(cid));
        }
      }
    }
    const out = [];
    for (const c of sessionBaseCombos) {
      if (c?.id == null) continue;
      if (assigned.has(String(c.id))) continue;
      if (comboMatchesQuery(c, q)) out.push(c);
    }
    return out;
  }, [displayGroups, sessionBaseCombos, debouncedSearch]);

  const menuGroupCombos = useMemo(() => {
    if (!displayGroups || displayGroups.length === 0) return [];
    const q = debouncedSearch;
    const allowedC = sessionResolved.mode !== "all" ? sessionComboIdSet : null;
    const list = [];
    for (const g of displayGroups) {
      if (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved && g.id !== sessionResolved.groupId) {
        continue;
      }
      list.push(
        ...pickCombosForMenuGroup(/** @type {Record<string, unknown>} */ (g), comboLookupMap, q, menuSearchIds, allowedC)
      );
    }
    return list;
  }, [
    displayGroups,
    comboLookupMap,
    debouncedSearch,
    menuSearchIds,
    sessionComboIdSet,
    sessionResolved,
  ]);

  const combosInHorizontalRail = useMemo(() => {
    const fromGroups = menuGroupCombos;
    if (fromGroups.length > 0) {
      const seen = new Set();
      const out = [];
      for (const c of fromGroups) {
        if (!c?.id) continue;
        const id = String(c.id);
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(c);
      }
      return out;
    }
    return unassignedCombos;
  }, [menuGroupCombos, unassignedCombos]);

  const viewFilter = useMemo(() => {
    if (activeFilterId === "all") return /** @type {const} */ ({ kind: "all" });
    if (activeFilterId.startsWith("c-")) {
      return {
        kind: "cuisine",
        value: decodeURIComponent(activeFilterId.slice(2)),
      };
    }
    if (activeFilterId.startsWith("g-")) {
      return {
        kind: "category",
        value: decodeURIComponent(activeFilterId.slice(2)),
      };
    }
    return /** @type {const} */ ({ kind: "all" });
  }, [activeFilterId]);

  const { cuisineList, menuCategoryList } = useMemo(() => {
    const cuisineSet = new Set();
    const menuSet = new Set();
    for (const p of sessionBaseProducts) {
      const cu = getProductCuisine(/** @type {Record<string, unknown>} */ (p));
      if (cu) cuisineSet.add(cu);
      const me = getProductMenuCategory(/** @type {Record<string, unknown>} */ (p));
      if (me) menuSet.add(me);
    }
    for (const c of sessionBaseCombos) {
      const co = /** @type {Record<string, unknown>} */ (c);
      const cC = String(co.cuisine ?? co.cuisineType ?? "").trim();
      if (cC) cuisineSet.add(cC);
      const cM = String(co.menuCategory ?? co.category ?? "").trim();
      if (cM) menuSet.add(cM);
      for (const id of getComboLineProductIds(co)) {
        const p = productLookupMap.get(String(id));
        if (!p) continue;
        const cu = getProductCuisine(/** @type {Record<string, unknown>} */ (p));
        if (cu) cuisineSet.add(cu);
        const me = getProductMenuCategory(/** @type {Record<string, unknown>} */ (p));
        if (me) menuSet.add(me);
      }
    }
    if (menuSet.size > 1) menuSet.delete("Menu");
    const sortStr = (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" });
    return {
      cuisineList: Array.from(cuisineSet).sort(sortStr),
      menuCategoryList: Array.from(menuSet).sort(sortStr),
    };
  }, [sessionBaseProducts, sessionBaseCombos, productLookupMap]);

  const combosInHorizontalRailFiltered = useMemo(() => {
    return combosInHorizontalRail.filter((c) => comboMatchesViewFilter(/** @type {Record<string, unknown>} */ (c), viewFilter, productLookupMap));
  }, [combosInHorizontalRail, viewFilter, productLookupMap]);

  useEffect(() => {
    setActiveFilterId("all");
  }, [sellerId, sessionResolved, sessionBaseProducts.length]);

  const productsFilteredByPill = useMemo(() => {
    const list = sessionBaseProducts.filter(
      (p) =>
        productMatchesQuery(/** @type {Record<string, unknown>} */ (p), debouncedSearch) &&
        productMatchesViewFilter(/** @type {Record<string, unknown>} */ (p), viewFilter)
    );
    return list;
  }, [sessionBaseProducts, debouncedSearch, viewFilter]);

  const otherProductsNotInGroupMenus = useMemo(() => {
    if (!displayGroups || displayGroups.length === 0) return [];
    if (sessionResolved.mode !== "all") return [];
    const q = debouncedSearch;
    const taken = new Set();
    for (const g of displayGroups) {
      for (const p of pickProductsForMenuGroup(
        /** @type {Record<string, unknown>} */ (g),
        productLookupMap,
        q,
        menuSearchIds,
        sessionResolved.mode !== "all" ? sessionProductIdSet : null
      )) {
        if (p?.id) taken.add(String(p.id));
      }
    }
    const out = [];
    for (const p of sessionBaseProducts) {
      if (p?.id == null) continue;
      if (taken.has(String(p.id))) continue;
      if (
        productMatchesQuery(/** @type {Record<string, unknown>} */ (p), q) &&
        productMatchesViewFilter(/** @type {Record<string, unknown>} */ (p), viewFilter)
      ) {
        out.push(p);
      }
    }
    return out;
  }, [displayGroups, productLookupMap, debouncedSearch, menuSearchIds, sessionBaseProducts, sessionProductIdSet, sessionResolved.mode, viewFilter]);

  const productsToRender = useMemo(() => {
    if (otherProductsNotInGroupMenus.length > 0 && sessionResolved.mode === "all" && !sessionLocked) {
      const m = new Map();
      for (const p of productsFilteredByPill) {
        if (p?.id) m.set(String(p.id), p);
      }
      for (const p of otherProductsNotInGroupMenus) {
        if (
          p?.id &&
          !m.has(String(p.id)) &&
          productMatchesQuery(/** @type {Record<string, unknown>} */ (p), debouncedSearch) &&
          productMatchesViewFilter(/** @type {Record<string, unknown>} */ (p), viewFilter)
        ) {
          m.set(String(p.id), p);
        }
      }
      return Array.from(m.values());
    }
    return productsFilteredByPill;
  }, [productsFilteredByPill, otherProductsNotInGroupMenus, sessionResolved, sessionLocked, debouncedSearch, viewFilter]);

  const combosToShow = useMemo(() => {
    return sessionBaseCombos.filter(
      (c) =>
        comboMatchesQuery(c, debouncedSearch) &&
        comboMatchesViewFilter(/** @type {Record<string, unknown>} */ (c), viewFilter, productLookupMap)
    );
  }, [sessionBaseCombos, debouncedSearch, viewFilter, productLookupMap]);

  const showComboRow = sessionResolved.mode !== "combosOnly" && (combosInHorizontalRailFiltered.length > 0 || combosLoading);

  const lineById = useMemo(() => {
    const m = new Map();
    for (const l of lines) {
      if (l.sellerId === sellerId) m.set(l.id, l);
    }
    return m;
  }, [lines, sellerId]);

  useEffect(() => {
    if (!sellerId) return undefined;
    const unsub = subscribeSellerById(
      sellerId,
      (docSnap) => {
        setSeller(docSnap);
        setSellerErr("");
      },
      (err) => {
        setSellerErr(err instanceof Error ? err.message : "Shop unavailable.");
      }
    );
    return () => unsub();
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId) return undefined;
    setMenuGroupsLoaded(false);
    setMenuGroupErr("");
    const unsub = subscribeMenuGroupsBySeller(
      sellerId,
      (list) => {
        setRawMenuGroups(list);
        setMenuGroupsLoaded(true);
      },
      (e) => {
        setMenuGroupErr(e?.message || "Menu groups unavailable.");
        setMenuGroupsLoaded(true);
        setRawMenuGroups([]);
      }
    );
    return () => unsub();
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId) return undefined;
    setProductsLoading(true);
    const unsub = subscribeProductsBySeller(
      sellerId,
      (list) => {
        setProducts(list);
        setProductsLoading(false);
        setProductErr("");
      },
      (err) => {
        setProductErr(err instanceof Error ? err.message : "Failed to load products.");
        setProductsLoading(false);
      }
    );
    return () => unsub();
  }, [sellerId]);

  useEffect(() => {
    if (!sellerId) return undefined;
    setCombosLoading(true);
    const unsub = subscribeCombosBySeller(
      sellerId,
      (list) => {
        setCombos(list);
        setCombosLoading(false);
        setComboErr("");
      },
      (err) => {
        setComboErr(err instanceof Error ? err.message : "Combos unavailable.");
        setCombos([]);
        setCombosLoading(false);
      }
    );
    return () => unsub();
  }, [sellerId]);

  if (!sellerId) {
    return (
      <div className="nb-page">
        <p className="nb-field__error">Missing shop.</p>
      </div>
    );
  }

  const shopName = seller?.shopName || seller?.name || (sellerId ? "Shop" : "Menu");
  const shopImg = typeof seller?.imageUrl === "string" ? seller.imageUrl.trim() : "";
  const deliveryOn = seller?.deliveryEnabled === true;
  const hoursText = formatSellerHoursDisplay(seller);
  const openState = getShopOpenUiState(seller);
  const isLive = seller?.isLive === true;
  const cartThisShop = cartSellerId && cartSellerId === sellerId;
  const showCartBar = cartThisShop && lineCount > 0;
  const showHeaderCart = isPublic;
  const opensAt = formatSellerOpensAtMessage(seller);
  const hoursCompact = formatSellerHoursCompact(seller);

  const openLabel =
    openState === "open"
      ? { text: "Open", cls: "bs-pill bs-pill--open" }
      : openState === "closed"
        ? { text: "Closed", cls: "bs-pill bs-pill--closed" }
        : { text: "Hours TBC", cls: "bs-pill bs-pill--unknown" };

  const showProductSkeleton = productsLoading && products.length === 0 && !productErr;

  const hasItems =
    productsToRender.length > 0 ||
    (sessionResolved.mode === "combosOnly" && (combosToShow.length > 0 || combosLoading)) ||
    (sessionResolved.mode !== "combosOnly" &&
      (combosInHorizontalRailFiltered.length > 0 || combosLoading || combosToShow.length > 0));

  const hasNothingAssigned = rawMenuGroups.length > 0 && !hasMenuAssignments && products.length === 0;

  const showEmpty =
    !productsLoading &&
    !combosLoading &&
    !hasItems &&
    !hasNothingAssigned &&
    !productErr &&
    sessionBaseProducts.length === 0 &&
    sessionBaseCombos.length === 0;

  const showUnavailable =
    hasNothingAssigned || (rawMenuGroups.length > 0 && hasMenuAssignments && !sessionBaseProducts.length && !sessionBaseCombos.length && !combosLoading && !productsLoading);

  function renderProductGrid(list, sectionKey) {
    return (
      <ul className="bs-pgrid bs-pgrid--item-premium" key={sectionKey}>
        {list.map((p) => {
          const meta = getProductOfferMeta(/** @type {Record<string, unknown>} */ (p));
          return (
            <ProductCard
              key={`${sectionKey}-${p.id}`}
              p={p}
              meta={meta}
              sellerId={sellerId}
              addItem={addItem}
              setQty={setQty}
              line={lineById.get(String(p.id))}
              categoryLabel={menuSlotLabel(
                getProductMenuSlot(/** @type {Record<string, unknown>} */ (p), meta)
              )}
              compact
            />
          );
        })}
      </ul>
    );
  }

  function renderProductsWithCategories(products, keyPrefix, menuLabel) {
    const groups = groupProductsByCategory(products);
    const onlyMenu = groups.length === 1 && groups[0].category === "Menu";
    if (onlyMenu || groups.length === 0) {
      return renderProductGrid(products, keyPrefix);
    }
    return (
      <>
        {groups.map(({ category, list }) => (
          <div key={`${keyPrefix}-cat-${category}`} className="bs-cat-block">
            <h3 className="bs-cat-block__title">{category}</h3>
            {renderProductGrid(list, `${keyPrefix}-${category}`)}
          </div>
        ))}
      </>
    );
  }

  const comboRailList =
    sessionResolved.mode === "combosOnly" ? combosToShow : combosInHorizontalRailFiltered;

  return (
    <div
      className={`bs-shop nb-page nb-page--browse${showCartBar || showHeaderCart ? " bs-shop--with-bar" : ""}`}
    >
      <div className="bs-shop__sticky-wrap">
        <div className="bs-shop__sticky">
          <Link to={backTo} className="bs-shop__back" aria-label={`Back to ${backLabel}`}>
            <ChevronLeft className="bs-shop__back-icon" size={22} strokeWidth={2} aria-hidden />
          </Link>
          <div className="bs-shop__brand">
            {shopImg ? (
              <LazyImage
                className="bs-shop__logo"
                imgClassName="bs-shop__logo-img"
                src={shopImg}
                alt=""
                ratio="1 / 1"
                variant="shop"
              />
            ) : (
              <div className="bs-shop__logo-fallback" aria-hidden>
                {String(shopName).slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div className="bs-shop__sticky-mid">
            <h1 className="bs-shop__name">{shopName}</h1>
            {sessionLabel ? <p className="bs-shop__menu-name">{sessionLabel}</p> : null}
            <div className="bs-shop__pills">
              {isPublic && isLive ? (
                <span className="bs-pill bs-pill--live" title="Live on FaFo">
                  Live
                </span>
              ) : null}
              <span className={openLabel.cls} title="Shop open status">
                {openState === "open" ? "Open" : openState === "closed" ? "Closed" : "Hours TBC"}
              </span>
              <span className="bs-pill bs-pill--muted" title="Delivery or pickup">
                {deliveryOn ? "Delivery" : "Pickup"}
              </span>
              {hoursCompact || (hoursText && !String(hoursText).toLowerCase().includes("not set")) ? (
                <span className="bs-pill bs-pill--time" title={String(hoursText || "Hours")}>
                  {hoursCompact || hoursText}
                </span>
              ) : null}
            </div>
          </div>
          {showHeaderCart ? (
            <Link to="/cart" className="bs-shop__cartbtn" aria-label="Open cart">
              <ShoppingCart className="bs-shop__cart-ic" size={20} strokeWidth={2} aria-hidden />
              {lineCount > 0 ? (
                <span className="bs-shop__cart-n">{lineCount > 9 ? "9+" : lineCount}</span>
              ) : null}
            </Link>
          ) : (
            <div className="bs-shop__cartpl" aria-hidden />
          )}
        </div>
        <div className="bs-sticky-search">
          <label htmlFor="bs-menu-search" className="visually-hidden">
            Search menu
          </label>
          <div className="bs-search bs-search--has-leading">
            <span className="bs-search__leading" aria-hidden>
              <Search size={18} strokeWidth={2} />
            </span>
            <input
              id="bs-menu-search"
              className="bs-search__input"
              value={menuSearch}
              onChange={(e) => setMenuSearch(e.target.value)}
              placeholder="Search items, combos, tags…"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
            />
          </div>
        </div>
        {sessionResolved.mode !== "combosOnly" ? (
          <div className="bs-filter-dock">
            <div className="bs-filter-block">
              <span className="bs-filter-block__label">Cuisine</span>
              <div className="bs-filter-row" role="tablist" aria-label="Cuisine">
                <button
                  type="button"
                  role="tab"
                  className={`bs-chip${activeFilterId === "all" ? " bs-chip--active" : ""}`}
                  aria-selected={activeFilterId === "all"}
                  onClick={() => setActiveFilterId("all")}
                >
                  All
                </button>
                {cuisineList.map((cu) => {
                  const fid = `c-${encodeURIComponent(cu)}`;
                  return (
                    <button
                      key={fid}
                      type="button"
                      role="tab"
                      className={`bs-chip${activeFilterId === fid ? " bs-chip--active" : ""}`}
                      aria-selected={activeFilterId === fid}
                      onClick={() => setActiveFilterId(fid)}
                    >
                      {cu}
                    </button>
                  );
                })}
              </div>
            </div>
            {menuCategoryList.length > 0 ? (
              <div className="bs-filter-block">
                <span className="bs-filter-block__label">Menu</span>
                <div className="bs-filter-row" role="tablist" aria-label="Menu category">
                  {menuCategoryList.map((mc) => {
                    const fid = `g-${encodeURIComponent(mc)}`;
                    return (
                      <button
                        key={fid}
                        type="button"
                        role="tab"
                        className={`bs-chip bs-chip--cat${activeFilterId === fid ? " bs-chip--active" : ""}`}
                        aria-selected={activeFilterId === fid}
                        onClick={() => setActiveFilterId(fid)}
                      >
                        {mc}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {sellerErr ? <p className="nb-field__error bs-shop__err">{sellerErr}</p> : null}
      {menuGroupErr ? <p className="nb-field__error nb-field__error--soft">{menuGroupErr}</p> : null}

      {formatOffers(seller).length > 0 || seller?.deliveryNote || seller?.deliveryInfo ? (
        <div className="bs-offers-compact">
          {formatOffers(seller).length > 0 ? (
            <div>
              <strong>Offers</strong>
              <ul>
                {formatOffers(seller).map((t, i) => (
                  <li key={`${i}-${t.slice(0, 16)}`}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {seller?.deliveryNote || seller?.deliveryInfo ? (
            <p>{String(seller.deliveryNote || seller.deliveryInfo)}</p>
          ) : null}
        </div>
      ) : null}

      {isPublic ? <StorefrontAdRail autoPlayMs={6000} /> : null}

      {sessionResolved.mode === "combosOnly" ? null : showComboRow ? (
        <section
          className="bs-combo-rail-wrap"
          aria-label="Combos"
          aria-busy={combosLoading}
        >
          <h2 className="bs-rail__title">Combos</h2>
          {combosLoading && comboRailList.length === 0 ? (
            <ul className="bs-combo-rail bs-combo-rail--skeleton" aria-hidden>
              {[1, 2, 3].map((i) => (
                <li key={i} className="bs-combo-rail__item">
                  <div className="bs-combo-rail__sk" />
                </li>
              ))}
            </ul>
          ) : comboRailList.length === 0 ? (
            <p className="bs-rail__empty nb-muted">No combos in this menu.</p>
          ) : (
            <ul className="bs-combo-rail">
              {comboRailList.map((c) => (
                <li className="bs-combo-rail__item" key={String(c.id)}>
                  <ComboCard
                    c={c}
                    sellerId={sellerId}
                    addItem={addItem}
                    setQty={setQty}
                    line={lineById.get(`combo_${c.id}`)}
                    productById={productByIdForCollage}
                    compact
                    layout="rail"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {sessionResolved.mode === "combosOnly" ? (
        <section className="bs-section" id="bs-sec-combos-only" aria-busy={combosLoading}>
          {combosLoading && combosToShow.length === 0 ? (
            <BsProductGridSkeleton />
          ) : combosToShow.length === 0 ? (
            <div className="bs-empty">
              <strong>Currently unavailable</strong>
              <p className="bs-empty__sub"> No combos in this session.</p>
            </div>
          ) : (
            <ul className="bs-combo-rail bs-combo-rail--tall">
              {combosToShow.map((c) => (
                <li className="bs-combo-rail__item" key={String(c.id)}>
                  <ComboCard
                    c={c}
                    sellerId={sellerId}
                    addItem={addItem}
                    setQty={setQty}
                    line={lineById.get(`combo_${c.id}`)}
                    productById={productByIdForCollage}
                    compact
                    layout="rail"
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {productErr ? <p className="nb-field__error">{productErr}</p> : null}
      {comboErr ? <p className="nb-field__error nb-field__error--soft">{comboErr}</p> : null}
      {showProductSkeleton ? <BsProductGridSkeleton /> : null}

      {sessionResolved.mode === "combosOnly" ? null : showUnavailable ? (
        <div className="bs-empty">
          <span className="bs-empty__icon bs-empty__icon--lucide" aria-hidden>
            <UtensilsCrossed size={28} strokeWidth={1.5} />
          </span>
          <strong>Currently unavailable</strong>
          <p className="bs-empty__sub"> Nothing is assigned to this menu right now.</p>
          {openState === "closed" && opensAt ? <p className="bs-empty__sub">{opensAt}</p> : null}
        </div>
      ) : null}

      {sessionResolved.mode === "combosOnly" ? null : !showUnavailable && (productsToRender.length > 0 || productsLoading) ? (
        <section className="bs-section bs-section--items" aria-label="Menu items">
          {renderProductsWithCategories(
            productsToRender,
            "items",
            sessionLabel
          )}
        </section>
      ) : !showUnavailable && !showProductSkeleton && !productsLoading && sessionResolved.mode !== "combosOnly" && debouncedSearch.trim() && productsToRender.length === 0 && sessionBaseProducts.length > 0 ? (
        <p className="bs-rail__empty">No matches for that search.</p>
      ) : !showUnavailable && !showProductSkeleton && !productsLoading && sessionBaseProducts.length === 0 && sessionBaseCombos.length === 0 ? (
        <div className="bs-empty">
          <strong>Currently unavailable</strong>
          {openState === "closed" && opensAt ? <p className="bs-empty__sub">{opensAt}</p> : <p className="bs-empty__sub">This menu is empty right now.</p>}
        </div>
      ) : null}

      {showEmpty && !comboErr ? (
        <div className="bs-empty">
          <span className="bs-empty__icon bs-empty__icon--lucide" aria-hidden>
            <UtensilsCrossed size={28} strokeWidth={1.5} />
          </span>
          <strong>Currently unavailable</strong>
          <p className="bs-empty__sub"> Check back later or try another search.</p>
        </div>
      ) : null}

      {showCartBar ? (
        <Link to="/cart" className="bs-float-cart" aria-label="View cart and checkout">
          <div className="bs-float-cart__left">
            <div className="bs-float-cart__line">
              <ShoppingCart className="bs-float-cart__cart-icon" size={20} strokeWidth={2} aria-hidden />
              <span className="bs-float-cart__badge">{lineCount}</span>
              <span>
                {lineCount} {lineCount === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="bs-float-cart__total">{formatCurrencyInr(total)}</div>
          </div>
          <span className="bs-float-cart__cta">View cart</span>
        </Link>
      ) : null}
    </div>
  );
}
