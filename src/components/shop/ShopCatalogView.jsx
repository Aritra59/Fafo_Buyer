import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeProductsBySeller } from "../../services/productService";
import { subscribeCombosBySeller } from "../../services/comboService";
import { subscribeSellerById } from "../../services/sellerService";
import { useCart } from "../../context/CartContext";
import { getProductOfferMeta } from "../../utils/pricing";
import { formatCurrencyInr } from "../../utils/format";
import { formatSellerHoursDisplay } from "../../utils/shopStatus";
import { getShopOpenUiState } from "../../utils/shopOpenStatus";
import {
  getMenuFilterChips,
  getProductMenuSlot,
  getSellerMenuSession,
  menuSlotLabel,
} from "../../utils/menuSections";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { LazyImage } from "../ui/LazyImage";
import ProductCard from "./ProductCard";
import ComboCard from "./ComboCard";
import StorefrontAdRail from "../StorefrontAdRail";
import "../../styles/buyerShop.css";

const MEAL_THEN_DEALS = /** @type {const} */ (["breakfast", "lunch", "dinner", "specials", "other"]);

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
  const [combos, setCombos] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [combosLoading, setCombosLoading] = useState(true);
  const [seller, setSeller] = useState(null);
  const [sellerErr, setSellerErr] = useState("");
  const [productErr, setProductErr] = useState("");
  const [comboErr, setComboErr] = useState("");

  const menuSession = useMemo(() => getSellerMenuSession(seller), [seller]);
  const sessionLocked = menuSession.mode === "slot" && menuSession.slot;

  const filteredProducts = useMemo(() => {
    if (menuSession.mode !== "slot" || !menuSession.slot) return products;
    const slot = menuSession.slot;
    if (slot === "combos") return [];
    return products.filter((p) => {
      const meta = getProductOfferMeta(p);
      return getProductMenuSlot(p, meta) === slot;
    });
  }, [products, menuSession]);

  const filteredCombos = useMemo(() => {
    if (menuSession.mode !== "slot" || !menuSession.slot) return combos;
    if (menuSession.slot === "combos") return combos;
    return [];
  }, [combos, menuSession]);

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

  const { buckets, otherEmpty, specialsEmpty } = useMemo(() => {
    const q = debouncedSearch;
    const b = {
      breakfast: /** @type {Record<string, unknown>[]} */ ([]),
      lunch: [],
      dinner: [],
      specials: [],
      other: [],
    };
    for (const p of filteredProducts) {
      if (!productMatchesQuery(p, q)) continue;
      const meta = getProductOfferMeta(p);
      const slot = getProductMenuSlot(p, meta);
      b[slot].push(p);
    }
    return {
      buckets: b,
      otherEmpty: b.other.length === 0,
      specialsEmpty: b.specials.length === 0,
    };
  }, [filteredProducts, debouncedSearch]);

  const chips = useMemo(() => {
    if (sessionLocked) {
      return [{ id: "all", label: "Menu" }];
    }
    return getMenuFilterChips().filter((c) => {
      if (c.id === "other" && otherEmpty) return false;
      if (c.id === "specials" && specialsEmpty) return false;
      if (c.id === "combos" && filteredCombos.length === 0) return false;
      return true;
    });
  }, [otherEmpty, specialsEmpty, filteredCombos.length, sessionLocked]);

  useEffect(() => {
    if (chips.length > 0 && !chips.some((c) => c.id === activeTab)) {
      setActiveTab("all");
    }
  }, [chips, activeTab]);

  const combosToShow = useMemo(() => {
    return filteredCombos.filter((c) => comboMatchesQuery(c, debouncedSearch));
  }, [filteredCombos, debouncedSearch]);

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

  const showProductSkeleton = productsLoading && products.length === 0 && !productErr;
  const showCombosSection =
    (activeTab === "all" || activeTab === "combos") &&
    (filteredCombos.length > 0 || combosLoading);
  const hasCombos = combosToShow.length > 0;
  const hasProductSlots = MEAL_THEN_DEALS.some((s) => buckets[s].length > 0);
  const hasAnyMenu =
    hasCombos || hasProductSlots || (filteredCombos.length > 0 && combosLoading);
  const showEmpty =
    !productsLoading && !combosLoading && !hasAnyMenu && !productErr;

  function renderProductGrid(list, sectionKey) {
    return (
      <ul className="bs-pgrid" key={sectionKey}>
        {list.map((p) => {
          const meta = getProductOfferMeta(p);
          return (
            <ProductCard
              key={`${sectionKey}-${p.id}`}
              p={p}
              meta={meta}
              sellerId={sellerId}
              addItem={addItem}
              setQty={setQty}
              line={lineById.get(p.id)}
              categoryLabel={menuSlotLabel(
                getProductMenuSlot(p, meta)
              )}
            />
          );
        })}
      </ul>
    );
  }

  function filterProductsForActiveTab() {
    if (activeTab === "all" || activeTab === "combos") return null;
    if (activeTab === "specials")
      return buckets.specials;
    if (MEAL_THEN_DEALS.includes(/** @type {typeof MEAL_THEN_DEALS[number]} */(activeTab))) {
      return buckets[activeTab] || [];
    }
    return null;
  }

  const singleTabProducts = filterProductsForActiveTab();
  const sessionLabel =
    sessionLocked && menuSession.slot
      ? menuSession.slot === "combos"
        ? "Combos"
        : menuSlotLabel(/** @type {any} */(menuSession.slot))
      : "";

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

      {sessionLocked ? (
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
        {!sessionLocked ? (
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
                  const el =
                    c.id === "all"
                      ? null
                      : document.getElementById(
                          c.id === "combos" ? "bs-sec-combos" : `bs-sec-${c.id}`
                        );
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

      {activeTab === "all" ? (
        <>
          {["breakfast", "lunch", "dinner"].map((slot) => {
            const list = buckets[/** @type {typeof slot} */(slot)];
            if (!list || !list.length) return null;
            return (
              <section
                className="bs-section"
                key={slot}
                id={`bs-sec-${slot}`}
              >
                <h2 className="bs-section__title">
                  {menuSlotLabel(/** @type {any} */(slot))}
                </h2>
                {renderProductGrid(list, slot)}
              </section>
            );
          })}

          {showCombosSection ? (
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

          {["specials", "other"]
            .filter((slot) => (slot === "other" ? !otherEmpty : true))
            .map((slot) => {
              const list = buckets[/** @type {typeof slot} */(slot)];
              if (!list || !list.length) return null;
              return (
                <section
                  className="bs-section"
                  key={slot}
                  id={`bs-sec-${slot}`}
                >
                  <h2 className="bs-section__title">
                    {slot === "other" ? "More" : menuSlotLabel(/** @type {any} */(slot))}
                  </h2>
                  {renderProductGrid(list, slot)}
                </section>
              );
            })}
        </>
      ) : null}

      {activeTab !== "all" && activeTab !== "combos" && singleTabProducts ? (
        <section className="bs-section" id="bs-sec-one">
          <h2 className="bs-section__title">
            {chips.find((c) => c.id === activeTab)?.label || "Menu"}
          </h2>
          {singleTabProducts.length === 0 ? (
            <p className="nb-muted">No dishes in this section.</p>
          ) : (
            renderProductGrid(singleTabProducts, "one")
          )}
        </section>
      ) : null}

      {activeTab === "combos" && !combosLoading ? (
        <section className="bs-section" id="bs-sec-combos-only">
          <h2 className="bs-section__title">Combos</h2>
          {combosToShow.length === 0 ? (
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
