import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { subscribeProductsBySeller } from "../../services/productService";
import { subscribeCombosBySeller } from "../../services/comboService";
import { subscribeSellerById } from "../../services/sellerService";
import { useCart } from "../../context/CartContext";
import {
  getProductOfferMeta,
  isDiscountSectionProduct,
} from "../../utils/pricing";
import { formatCurrencyInr } from "../../utils/format";
import { formatSellerHoursDisplay } from "../../utils/shopStatus";
import { getShopOpenUiState } from "../../utils/shopOpenStatus";
import { LazyImage } from "../ui/LazyImage";
import ProductCard from "./ProductCard";
import ComboCard from "./ComboCard";
import "../../styles/buyerShop.css";

function groupByCategory(products) {
  const map = new Map();
  for (const p of products) {
    const cat = (p.category && String(p.category).trim()) || "Other";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(p);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
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

function formatOffers(seller) {
  const o = seller?.offers ?? seller?.shopOffers ?? seller?.activeOffers;
  if (Array.isArray(o)) {
    return o
      .map((x) => (typeof x === "string" ? x : x?.text || x?.title || ""))
      .filter(Boolean);
  }
  if (typeof o === "string" && o.trim()) return [o.trim()];
  return [];
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
  const [activeChip, setActiveChip] = useState("All");
  const [products, setProducts] = useState([]);
  const [combos, setCombos] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [combosLoading, setCombosLoading] = useState(true);
  const [seller, setSeller] = useState(null);
  const [sellerErr, setSellerErr] = useState("");
  const [productErr, setProductErr] = useState("");
  const [comboErr, setComboErr] = useState("");

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

  const categoryNames = useMemo(() => {
    const s = new Set();
    for (const p of products) {
      s.add((p.category && String(p.category).trim()) || "Other");
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const chips = useMemo(() => {
    const c = ["All", ...categoryNames];
    if (combos.length) c.push("Combos");
    return c;
  }, [categoryNames, combos.length]);

  useEffect(() => {
    if (chips.length > 0 && !chips.includes(activeChip)) {
      setActiveChip("All");
    }
  }, [chips, activeChip]);

  const productsForCatalog = useMemo(() => {
    if (activeChip === "Combos") return [];
    const searched = products.filter((p) => productMatchesQuery(p, menuSearch));
    if (activeChip === "All") return searched;
    return searched.filter(
      (p) => ((p.category && String(p.category).trim()) || "Other") === activeChip
    );
  }, [products, menuSearch, activeChip]);

  const combosToShow = useMemo(() => {
    if (activeChip !== "All" && activeChip !== "Combos") return [];
    return combos.filter((c) => comboMatchesQuery(c, menuSearch));
  }, [combos, menuSearch, activeChip]);

  const { regularList, discountList } = useMemo(() => {
    const discount = [];
    const regular = [];
    for (const p of productsForCatalog) {
      const meta = getProductOfferMeta(p);
      if (isDiscountSectionProduct(p, meta)) discount.push(p);
      else regular.push(p);
    }
    return { regularList: regular, discountList: discount };
  }, [productsForCatalog]);

  const regularSections = useMemo(() => groupByCategory(regularList), [regularList]);
  const discountSections = useMemo(() => groupByCategory(discountList), [discountList]);

  const shopName = seller?.shopName || seller?.name || (sellerId ? "Shop" : "Menu");
  const shopImg = typeof seller?.imageUrl === "string" ? seller.imageUrl.trim() : "";
  const deliveryOn = seller?.deliveryEnabled === true;
  const hoursText = formatSellerHoursDisplay(seller);
  const openState = getShopOpenUiState(seller);
  const offerLines = useMemo(() => formatOffers(seller), [seller]);
  const isLive = seller?.isLive === true;
  const cartThisShop = cartSellerId && cartSellerId === sellerId;
  const showCartBar = cartThisShop && lineCount > 0;

  const openLabel = useMemo(() => {
    if (openState === "open") return { text: "Open", cls: "bs-hero__pill--open", emoji: "🟢" };
    if (openState === "closed") return { text: "Closed", cls: "bs-hero__pill--closed", emoji: "🔴" };
    return { text: "Hours TBC", cls: "bs-hero__pill--unknown", emoji: "⏰" };
  }, [openState]);

  if (!sellerId) {
    return (
      <div className="nb-page">
        <p className="nb-field__error">Missing shop.</p>
      </div>
    );
  }

  const showProductSkeleton = productsLoading && products.length === 0 && !productErr;

  const hasAnyMenu =
    combosToShow.length > 0 ||
    discountSections.length > 0 ||
    regularSections.length > 0;

  const showEmpty =
    !productsLoading &&
    !combosLoading &&
    !hasAnyMenu &&
    !productErr;

  return (
    <div
      className={`nb-page nb-page--browse bs-catalog${showCartBar ? " bs-catalog--with-float" : ""}`}
    >
      <header>
        {sellerErr ? <p className="nb-field__error">{sellerErr}</p> : null}

        <div className="bs-hero">
          <div className="bs-hero__banner">
            <Link className="bs-hero__back" to={backTo}>
              ← {backLabel}
            </Link>
            <LazyImage
              className="bs-hero__media"
              imgClassName="bs-hero__img"
              src={shopImg || null}
              alt=""
              ratio="2 / 1"
              variant="shop"
            />
            <div className="bs-hero__grad" />
          </div>
          <div className="bs-hero__row">
            <div className="bs-hero__logo" aria-hidden={!!shopImg}>
              {shopImg ? (
                <LazyImage
                  className="bs-hero__media"
                  imgClassName="bs-hero__img"
                  src={shopImg}
                  alt=""
                  ratio="1 / 1"
                  variant="shop"
                />
              ) : (
                <div className="bs-hero__logo-fallback">{String(shopName).slice(0, 1).toUpperCase()}</div>
              )}
            </div>
            <div className="bs-hero__text">
              <h1 className="bs-hero__title">{shopName}</h1>
              <div className="bs-hero__meta">
                <span className="bs-hero__rating" title="Rating (placeholder)">
                  ⭐ 4.1
                </span>
                <span
                  className={`bs-hero__pill ${openLabel.cls}`}
                  title="Shop open status"
                >
                  {openLabel.emoji} {openLabel.text}
                </span>
                {isPublic && isLive ? (
                  <span className="bs-hero__pill bs-hero__pill--live">LIVE</span>
                ) : null}
                <span className="bs-hero__pill" title="Delivery or pickup">
                  {deliveryOn ? "🚚 Delivery" : "🛍 Pickup"}
                </span>
                <span title="Timings">⏰ {hoursText}</span>
              </div>
            </div>
          </div>
        </div>

        {offerLines.length > 0 || seller?.deliveryNote || seller?.deliveryInfo ? (
          <div className="bs-offers-compact">
            {offerLines.length > 0 ? (
              <div>
                <strong>Offers</strong>
                <ul>
                  {offerLines.map((t, i) => (
                    <li key={`${i}-${t.slice(0, 16)}`}>{t}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {seller?.deliveryNote || seller?.deliveryInfo ? (
              <p>
                {String(seller.deliveryNote || seller.deliveryInfo)}
              </p>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="bs-sticky-tools">
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
        <div
          className="bs-chips"
          role="tablist"
          aria-label="Menu categories"
        >
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              className={`bs-chip${activeChip === c ? " bs-chip--active" : ""}`}
              aria-selected={activeChip === c}
              onClick={() => {
                setActiveChip(c);
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {productErr ? <p className="nb-field__error">{productErr}</p> : null}
      {comboErr ? <p className="nb-field__error nb-field__error--soft">{comboErr}</p> : null}

      {showProductSkeleton ? <BsProductGridSkeleton /> : null}

      {combosLoading && combosToShow.length === 0 && !comboErr && (activeChip === "All" || activeChip === "Combos") ? (
        <section className="bs-section" aria-busy="true">
          <h2 className="bs-section__title">Combos</h2>
          <BsProductGridSkeleton />
        </section>
      ) : null}

      {!combosLoading && combosToShow.length > 0 ? (
        <section className="bs-section">
          <h2 className="bs-section__title">Combos</h2>
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
        </section>
      ) : null}

      {showEmpty && !comboErr ? (
        <div className="bs-empty">
          <span className="bs-empty__icon" aria-hidden>
            🍽
          </span>
          <strong>No items available today</strong>
          <div>Check back later or try a different search.</div>
        </div>
      ) : null}

      {discountSections.map(([category, list]) => (
        <section key={`d-${category}`} className="bs-section">
          <h2 className="bs-section__title">Discount items · {category}</h2>
          <ul className="bs-pgrid">
            {list.map((p) => (
              <ProductCard
                key={`d-${category}-${p.id}`}
                p={p}
                sellerId={sellerId}
                addItem={addItem}
                setQty={setQty}
                line={lineById.get(p.id)}
                discountSection
                categoryLabel={category}
              />
            ))}
          </ul>
        </section>
      ))}

      {regularSections.map(([category, list]) => (
        <section key={category} className="bs-section">
          <h2 className="bs-section__title">{category}</h2>
          <ul className="bs-pgrid">
            {list.map((p) => (
              <ProductCard
                key={`${category}-${p.id}`}
                p={p}
                sellerId={sellerId}
                addItem={addItem}
                setQty={setQty}
                line={lineById.get(p.id)}
                discountSection={false}
                categoryLabel={category}
              />
            ))}
          </ul>
        </section>
      ))}

      {showCartBar ? (
        <Link to="/cart" className="bs-float-cart" aria-label="View cart and checkout">
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
          <span className="bs-float-cart__cta">View cart →</span>
        </Link>
      ) : null}
    </div>
  );
}
