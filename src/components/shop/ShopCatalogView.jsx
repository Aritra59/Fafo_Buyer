import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeProductsBySeller } from "../../services/productService";
import { subscribeCombosBySeller } from "../../services/comboService";
import { subscribeSellerById } from "../../services/sellerService";
import { subscribeMenuGroupsBySeller } from "../../services/menuGroupService";
import { useCart } from "../../context/CartContext";
import { getProductOfferMeta } from "../../utils/pricing";
import { formatCurrencyInr } from "../../utils/format";
import { formatSellerHoursDisplay } from "../../utils/shopStatus";
import { getShopOpenUiState } from "../../utils/shopOpenStatus";
import {
  buildCategoryFallbackMenuGroups,
  getProductMenuSlot,
  menuSlotLabel,
  resolveMenuSessionForGroups,
} from "../../utils/menuSections";
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

function productMatchesQuery(p, q) {
  if (!q) return true;
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const name = String(p.name || "").toLowerCase();
  const cat = String(p.category || "").toLowerCase();
  return name.includes(t) || cat.includes(t) || t.split(/\s+/).every((w) => w && name.includes(w));
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

function comboMatchesQuery(c, q) {
  if (!q) return true;
  const t = q.trim().toLowerCase();
  if (!t) return true;
  const name = String(c.name || "").toLowerCase();
  const sum = String(comboItemsSummary(c) || "").toLowerCase();
  return name.includes(t) || sum.includes(t);
}

/** @param {string} gid */
function sectionDomIdForGroup(gid) {
  return `bs-sec-mg-${String(gid).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

/**
 * @param {Map<string, Record<string, unknown>>} byId
 * @param {string[]} pids
 * @param {string} q
 */
function pickProductsInOrder(byId, pids, q) {
  const out = [];
  for (const raw of pids || []) {
    const k = String(raw);
    const p = byId.get(k);
    if (p && productMatchesQuery(/** @type {Record<string, unknown>} */(p), q)) {
      out.push(/** @type {Record<string, unknown>} */(p));
    }
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
  const debouncedSearch = useDebouncedValue(menuSearch, 320);
  const [activeTab, setActiveTab] = useState(/** @type {string} */("all"));
  const [products, setProducts] = useState([]);

  const [rawMenuGroups, setRawMenuGroups] = useState(/** @type {import("../../services/menuGroupService").MenuGroupDoc[]} */ ([]));
  const [menuGroupsLoaded, setMenuGroupsLoaded] = useState(false);
  const [menuGroupErr, setMenuGroupErr] = useState("");

  const [combos, setCombos] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [combosLoading, setCombosLoading] = useState(true);
  const [seller, setSeller] = useState(null);
  const [sellerErr, setSellerErr] = useState("");
  const [productErr, setProductErr] = useState("");
  const [comboErr, setComboErr] = useState("");

  const displayGroups = useMemo(() => {
    if (rawMenuGroups.length > 0) return rawMenuGroups;
    if (!menuGroupsLoaded) {
      return products.length > 0 ? buildCategoryFallbackMenuGroups(products) : null;
    }
    return buildCategoryFallbackMenuGroups(products);
  }, [rawMenuGroups, menuGroupsLoaded, products]);

  const sessionResolved = useMemo(() => {
    if (displayGroups == null) {
      return /** @type {const} */ ({ mode: "all" });
    }
    return resolveMenuSessionForGroups(seller, displayGroups);
  }, [seller, displayGroups]);

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
      const s = new Set((g?.productIds || []).map((x) => String(x)));
      if (!s.size) return [];
      return products.filter((p) => s.has(String(p.id)));
    }
    return products;
  }, [products, displayGroups, sessionResolved]);

  const sessionBaseCombos = useMemo(() => {
    if (displayGroups == null) return [];
    if (sessionResolved.mode === "combosOnly") return combos;
    if (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved) return [];
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

  const menuGroupsForChips = useMemo(() => {
    if (displayGroups == null) return [];
    if (sessionResolved.mode === "combosOnly") return [];
    if (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved) {
      return displayGroups.filter((g) => g.id === sessionResolved.groupId);
    }
    return displayGroups;
  }, [displayGroups, sessionResolved]);

  const chips = useMemo(() => {
    const hasCombos = sessionBaseCombos.length > 0;
    if (sessionLocked) {
      if (sessionResolved.mode === "combosOnly") {
        return [{ id: "combos", label: "Combos" }];
      }
      if (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved) {
        return [
          {
            id: sessionResolved.groupId,
            label: sessionResolved.label || "Menu",
          },
        ];
      }
    }
    const c = /** @type {{ id: string, label: string }[]} */ ([{ id: "all", label: "All" }]);
    for (const g of menuGroupsForChips) {
      c.push({ id: g.id, label: String(g.name || g.slug || "Menu") });
    }
    if (hasCombos) c.push({ id: "combos", label: "Combos" });
    return c;
  }, [menuGroupsForChips, sessionBaseCombos.length, sessionLocked, sessionResolved]);

  const byId = useMemo(() => {
    const m = new Map();
    for (const p of sessionBaseProducts) {
      if (p?.id != null) m.set(String(p.id), p);
    }
    return m;
  }, [sessionBaseProducts]);

  const allSections = useMemo(() => {
    const q = debouncedSearch;
    if (displayGroups == null) return { sections: /** @type {{ id: string, label: string, products: any[] }[]} */ ([]), other: [] };
    if (sessionResolved.mode === "combosOnly" || (sessionLocked && sessionResolved.mode === "oneGroup")) {
      return { sections: [], other: [] };
    }
    const ordered = displayGroups;
    const taken = new Set();
    const sections = [];
    for (const g of ordered) {
      const pids = Array.isArray(g.productIds) ? g.productIds : [];
      const list = pickProductsInOrder(byId, pids, q);
      for (const p of list) {
        if (p?.id) taken.add(String(p.id));
      }
      if (g.id) {
        sections.push({ id: g.id, label: String(g.name || g.slug || "Menu"), group: g, products: list });
      }
    }
    const other = [];
    for (const p of sessionBaseProducts) {
      if (p?.id == null) continue;
      if (!taken.has(String(p.id)) && productMatchesQuery(p, q)) other.push(p);
    }
    return { sections, other };
  }, [byId, debouncedSearch, displayGroups, sessionBaseProducts, sessionLocked, sessionResolved.mode]);

  const singleTabList = useMemo(() => {
    const q = debouncedSearch;
    if (activeTab === "all" || activeTab === "combos") return null;
    const g = (displayGroups || []).find((x) => x.id === activeTab);
    if (!g) return null;
    return pickProductsInOrder(
      byId,
      g.productIds || [],
      q
    );
  }, [activeTab, byId, debouncedSearch, displayGroups]);

  const combosToShow = useMemo(() => {
    return sessionBaseCombos.filter((c) => comboMatchesQuery(c, debouncedSearch));
  }, [sessionBaseCombos, debouncedSearch]);

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

  useEffect(() => {
    if (sessionResolved.mode === "oneGroup" && "groupId" in sessionResolved) {
      setActiveTab(sessionResolved.groupId);
    } else if (sessionResolved.mode === "combosOnly") {
      setActiveTab("combos");
    }
  }, [sessionResolved, sellerId]);

  useEffect(() => {
    if (chips.length > 0 && !chips.some((c) => c.id === activeTab)) {
      setActiveTab(chips[0].id);
    }
  }, [chips, activeTab]);

  useEffect(() => {
    const docs = rawMenuGroups;
    const tab = activeTab;
    let filteredForLog = null;
    if (tab === "all") {
      const flat = [
        ...allSections.sections.flatMap((s) => s.products),
        ...allSections.other,
      ];
      filteredForLog = flat;
    } else if (tab === "combos") {
      filteredForLog = combosToShow;
    } else {
      filteredForLog = singleTabList || [];
    }
    // eslint-disable-next-line no-console
    console.log("[shop] menuGroups docs (raw from Firestore)", docs);
    // eslint-disable-next-line no-console
    console.log("[shop] selected tab", tab, "display groups", displayGroups, "session", sessionResolved);
    // eslint-disable-next-line no-console
    console.log("[shop] filtered for active tab (products or combos list)", filteredForLog);
  }, [rawMenuGroups, activeTab, allSections, combosToShow, singleTabList, displayGroups, sessionResolved]);

  const shopName = seller?.shopName || seller?.name || (sellerId ? "Shop" : "Menu");
  const shopImg = typeof seller?.imageUrl === "string" ? seller.imageUrl.trim() : "";
  const deliveryOn = seller?.deliveryEnabled === true;
  const hoursText = formatSellerHoursDisplay(seller);
  const openState = getShopOpenUiState(seller);
  const isLive = seller?.isLive === true;
  const cartThisShop = cartSellerId && cartSellerId === sellerId;
  const showCartBar = cartThisShop && lineCount > 0;
  const showHeaderCart = isPublic;

  const openLabel = useMemo(() => {
    if (openState === "open")
      return { text: "Open", cls: "bs-pill bs-pill--open" };
    if (openState === "closed")
      return { text: "Closed", cls: "bs-pill bs-pill--closed" };
    return { text: "Hours TBC", cls: "bs-pill bs-pill--unknown" };
  }, [openState]);

  if (!sellerId) {
    return (
      <div className="nb-page">
        <p className="nb-field__error">Missing shop.</p>
      </div>
    );
  }

  const showCombosOnAllView =
    (activeTab === "all" || activeTab === "combos") && (sessionBaseCombos.length > 0 || combosLoading) && !sessionLocked;

  const hasCombos = combosToShow.length > 0;
  const hasAnyMenuSection = allSections.sections.some((s) => s.products.length > 0) || allSections.other.length > 0;
  const hasAnyMenu =
    hasCombos || hasAnyMenuSection || (sessionBaseCombos.length > 0 && combosLoading) || (sessionBaseCombos.length > 0 && !combosLoading);

  const showEmpty =
    !productsLoading &&
    !combosLoading &&
    !hasAnyMenu &&
    !productErr;

  function renderProductGrid(list, sectionKey, categoryOverride) {
    return (
      <ul className="bs-pgrid" key={sectionKey}>
        {list.map((p) => {
          const meta = getProductOfferMeta(/** @type {Record<string, unknown>} */(p));
          const base = categoryOverride
            ? categoryOverride
            : menuSlotLabel(getProductMenuSlot(/** @type {Record<string, unknown>} */(p), meta));
          return (
            <ProductCard
              key={`${sectionKey}-${p.id}`}
              p={p}
              meta={meta}
              sellerId={sellerId}
              addItem={addItem}
              setQty={setQty}
              line={lineById.get(p.id)}
              categoryLabel={base}
            />
          );
        })}
      </ul>
    );
  }

  const showProductSkeleton = productsLoading && products.length === 0 && !productErr;
  const sessionLabel = sessionLocked
    ? sessionResolved.mode === "combosOnly"
      ? "Combos"
      : sessionResolved.mode === "oneGroup" && "label" in sessionResolved
        ? String(sessionResolved.label || "")
        : ""
    : "";

  function emptyCopyForGroupTab() {
    const g = (displayGroups || []).find((x) => x.id === activeTab);
    const pids = g && Array.isArray(g.productIds) ? g.productIds : [];
    if (pids.length === 0) {
      return "No dishes in this section";
    }
    if ((singleTabList || []).length === 0) {
      return "No dishes match your search";
    }
    return null;
  }

  return (
    <div
      className={`bs-shop nb-page nb-page--browse${showCartBar || showHeaderCart ? " bs-shop--with-bar" : ""}`}
    >
      <div className="bs-shop__sticky">
        <Link to={backTo} className="bs-shop__back" aria-label={`Back to ${backLabel}`}>
          <span className="bs-shop__back-icon" aria-hidden>
            ←
          </span>
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
          <div className="bs-shop__pills">
            <span className={openLabel.cls} title="Shop open status">
              {openState === "open" ? "Open" : openState === "closed" ? "Closed" : "Hours TBC"}
            </span>
            {isPublic && isLive ? (
              <span className="bs-pill bs-pill--live">LIVE</span>
            ) : null}
            <span className="bs-pill bs-pill--muted" title="Delivery or pickup">
              {deliveryOn ? "Delivery" : "Pickup"}
            </span>
          </div>
        </div>
        {showHeaderCart ? (
          <Link to="/cart" className="bs-shop__cartbtn" aria-label="Open cart">
            <span className="bs-shop__cart-ic" aria-hidden>
              🛒
            </span>
            {lineCount > 0 ? (
              <span className="bs-shop__cart-n">{lineCount > 9 ? "9+" : lineCount}</span>
            ) : null}
          </Link>
        ) : (
          <div className="bs-shop__cartpl" aria-hidden />
        )}
      </div>

      {sellerErr ? <p className="nb-field__error bs-shop__err">{sellerErr}</p> : null}
      {menuGroupErr ? <p className="nb-field__error nb-field__error--soft">{menuGroupErr}</p> : null}

      <div className="bs-hero bs-hero--compact">
        <div className="bs-hero__banner">
          <LazyImage
            className="bs-hero__media"
            imgClassName="bs-hero__img"
            src={shopImg || null}
            alt=""
            ratio="2.2 / 1"
            variant="shop"
          />
          <div className="bs-hero__grad" />
        </div>
        <p className="bs-hero__hours" title="Timings">
          {hoursText}
        </p>
      </div>

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

      {sessionLocked && sessionLabel ? (
        <div className="bs-session-banner" role="status">
          <span className="bs-session-banner__dot" aria-hidden />
          Showing <strong>{sessionLabel}</strong> only (set by the shop)
        </div>
      ) : null}

      <div className="bs-sticky-tools bs-sticky-tools--shop">
        <div className="bs-search">
          <label htmlFor="bs-menu-search" className="visually-hidden">
            Search menu
          </label>
          <input
            id="bs-menu-search"
            className="bs-search__input"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Search dishes…"
            type="search"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>
        {!sessionLocked && chips.length > 1 ? (
          <div
            className="bs-chips bs-chips--menu"
            role="tablist"
            aria-label="Menu categories"
          >
            {chips.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                className={`bs-chip${activeTab === c.id ? " bs-chip--active" : ""}`}
                aria-selected={activeTab === c.id}
                onClick={() => {
                  setActiveTab(c.id);
                  if (c.id === "all") {
                    return;
                  }
                  const el =
                    c.id === "combos"
                      ? document.getElementById("bs-sec-combos")
                      : document.getElementById(sectionDomIdForGroup(c.id));
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {productErr ? <p className="nb-field__error">{productErr}</p> : null}
      {comboErr ? <p className="nb-field__error nb-field__error--soft">{comboErr}</p> : null}
      {showProductSkeleton ? <BsProductGridSkeleton /> : null}

      {activeTab === "all" && !sessionLocked ? (
        <>
          {allSections.sections.map((sec) => {
            const pids = sec.group && Array.isArray(sec.group.productIds) ? sec.group.productIds : [];
            if (sec.products && sec.products.length) {
              return (
                <section
                  className="bs-section"
                  key={sec.id}
                  id={sectionDomIdForGroup(sec.id)}
                >
                  <h2 className="bs-section__title">{sec.label}</h2>
                  {renderProductGrid(
                    sec.products,
                    `sec-${sec.id}`,
                    String(sec.label)
                  )}
                </section>
              );
            }
            if (pids.length === 0) {
              return (
                <section
                  className="bs-section"
                  key={sec.id}
                  id={sectionDomIdForGroup(sec.id)}
                >
                  <h2 className="bs-section__title">{sec.label}</h2>
                  <p className="nb-muted">No dishes in this section</p>
                </section>
              );
            }
            return (
              <section
                className="bs-section"
                key={sec.id}
                id={sectionDomIdForGroup(sec.id)}
              >
                <h2 className="bs-section__title">{sec.label}</h2>
                <p className="nb-muted">No dishes match your search</p>
              </section>
            );
          })}

          {allSections.other.length > 0 ? (
            <section className="bs-section" id="bs-sec-other-mg">
              <h2 className="bs-section__title">More</h2>
              {renderProductGrid(allSections.other, "other-mg", "More")}
            </section>
          ) : null}

          {showCombosOnAllView ? (
            <section
              className="bs-section"
              id="bs-sec-combos"
              aria-busy={combosLoading}
            >
              <h2 className="bs-section__title">Combos</h2>
              {combosLoading ? (
                <BsProductGridSkeleton />
              ) : (
                <ul className="bs-pgrid">
                  {combosToShow.map((c) => (
                    <ComboCard
                      key={c.id}
                      c={c}
                      sellerId={sellerId}
                      addItem={addItem}
                      setQty={setQty}
                      line={lineById.get(`combo_${c.id}`)}
                    />
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab !== "all" && activeTab !== "combos" && singleTabList != null
        ? (() => {
            const copy = emptyCopyForGroupTab();
            return (
              <section
                className="bs-section"
                id="bs-sec-one"
                key="one-tab"
              >
                <h2 className="bs-section__title">
                  {chips.find((c) => c.id === activeTab)?.label || "Menu"}
                </h2>
                {copy ? <p className="nb-muted">{copy}</p> : renderProductGrid(
                  singleTabList,
                  "one",
                  String(chips.find((c) => c.id === activeTab)?.label || "Menu")
                )}
              </section>
            );
          })()
        : null}

      {activeTab === "combos" ? (
        <section
          className="bs-section"
          id="bs-sec-combos"
          key="combo-only"
          aria-busy={combosLoading}
        >
          <h2 className="bs-section__title">Combos</h2>
          {combosLoading ? (
            <BsProductGridSkeleton />
          ) : combosToShow.length === 0 ? (
            <p className="nb-muted">No combos right now.</p>
          ) : (
            <ul className="bs-pgrid">
              {combosToShow.map((c) => (
                <ComboCard
                  key={c.id}
                  c={c}
                  sellerId={sellerId}
                  addItem={addItem}
                  setQty={setQty}
                  line={lineById.get(`combo_${c.id}`)}
                />
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {showEmpty && !comboErr ? (
        <div className="bs-empty">
          <span className="bs-empty__icon" aria-hidden>
            🍽
          </span>
          <strong>No items in this session</strong>
          <div>Check back later or try a different search.</div>
        </div>
      ) : null}

      {showCartBar ? (
        <Link
          to="/cart"
          className="bs-float-cart"
          aria-label="View cart and checkout"
        >
          <div className="bs-float-cart__left">
            <div className="bs-float-cart__line">
              <span aria-hidden>🛒</span>
              <span className="bs-float-cart__badge">{lineCount}</span>
              <span>
                {lineCount} {lineCount === 1 ? "item" : "items"}
              </span>
            </div>
            <div className="bs-float-cart__total">{formatCurrencyInr(total)}</div>
          </div>
          <span className="bs-float-cart__cta">Checkout</span>
        </Link>
      ) : null}
    </div>
  );
}
