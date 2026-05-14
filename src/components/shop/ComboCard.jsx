import { memo } from "react";
import { Minus, Plus } from "lucide-react";
import { LazyImage } from "../ui/LazyImage";
import { formatCurrencyInr } from "../../utils/format";
import { isComboUnavailable } from "../../utils/menuSections";
import { buildDefaultComboVariantPicks, comboNeedsBuyerVariantPicks } from "../../utils/productVariants";

function comboImageUrl(c) {
  const u = c.imageUrl ?? c.image;
  return typeof u === "string" && u.trim() ? u.trim() : "";
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

/**
 * @param {unknown} x
 * @returns {string}
 */
function normalizeComboImageArrayItem(x) {
  if (x == null) return "";
  if (typeof x === "string" && x.trim()) return x.trim();
  if (typeof x === "object") {
    const o = /** @type {Record<string, unknown>} */ (x);
    const u = o.url ?? o.imageUrl ?? o.image ?? o.src;
    if (u != null && String(u).trim()) return String(u).trim();
  }
  return "";
}

/**
 * Ordered, deduped image URLs: seller `imageUrls[]`, collage arrays, main `imageUrl`, then line items.
 * @param {Record<string, unknown>} c
 * @param {Map<string, Record<string, unknown>> | undefined} productById
 * @param {number} max
 */
function getComboImageUrls(c, productById, max = 4) {
  const seen = new Set();
  const out = /** @type {string[]} */ ([]);
  const add = (u) => {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s || seen.has(s)) return false;
    seen.add(s);
    out.push(s);
    return out.length >= max;
  };
  const arrays = [c.imageUrls, c.imageURLList, c.collageUrls, c.collageImages];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const x of arr) {
      const s = normalizeComboImageArrayItem(x);
      if (s && add(s)) return out;
    }
  }
  if (add(comboImageUrl(c))) return out;
  const raw = c.items ?? c.itemList ?? c.comboItems;
  if (!Array.isArray(raw)) return out;
  for (const it of raw) {
    if (out.length >= max) break;
    if (typeof it === "string") {
      const p = productById?.get(String(it));
      if (add(p?.imageUrl || p?.image || "")) return out;
    } else if (it && typeof it === "object") {
      const o = /** @type {Record<string, unknown>} */ (it);
      const d = normalizeComboImageArrayItem(o) || String(o.imageUrl || o.image || "").trim();
      if (d && add(d)) return out;
      const pid = o.productId ?? o.id;
      if (pid && productById) {
        const p = productById.get(String(pid));
        if (add(p?.imageUrl || p?.image || "")) return out;
      }
    }
  }
  return out;
}

/**
 * @param {Record<string, unknown>} c
 * @param {string} sellerId
 * @param {(x: Record<string, unknown>) => void} addItem
 * @param {(id: string, n: number) => void} setQty
 * @param {Record<string, unknown> | undefined} line
 * @param {Map<string, Record<string, unknown>>} [productById]
 * @param {"rail"|"grid"} [layout]
 */
function ComboCard({
  c,
  sellerId,
  addItem,
  setQty,
  line,
  productById,
  onComboAddIntent,
  compact = false,
  layout = "grid",
}) {
  const img = comboImageUrl(c);
  const label = c.name || "Combo";
  const price = Number(c.price) || 0;
  const origRaw = c.originalPrice ?? c.compareAtPrice ?? c.mrp;
  const orig = Number(origRaw) || 0;
  const originalPrice = orig > price ? orig : undefined;
  const saveAmt = originalPrice != null ? Math.max(0, originalPrice - price) : 0;
  const summary = comboItemsSummary(c);
  const lineId = `combo_${c.id}`;
  const qty = line ? Math.max(0, Math.floor(Number(line.qty) || 0)) : 0;
  const inCart = qty > 0;
  const unavailable = isComboUnavailable(c);
  const imageUrls = getComboImageUrls(c, productById, 4);
  const n = imageUrls.length;
  const nShow = n >= 4 ? 4 : n;
  const collageClass =
    nShow === 1
      ? "bs-combo-collage--1"
      : nShow === 2
        ? "bs-combo-collage--2"
        : nShow === 3
          ? "bs-combo-collage--3 bs-combo-collage--3-seller"
          : "bs-combo-collage--4";

  const payload = () => ({
    id: lineId,
    productId: lineId,
    kind: "combo",
    name: label,
    price,
    originalPrice,
    offerLabel: "",
    sellerId,
    qty: 1,
    imageUrl: img || imageUrls[0] || "",
    prepTime: "",
    comboSummary: summary,
    comboVariantPicks: buildDefaultComboVariantPicks(/** @type {Record<string, unknown>} */ (c), productById),
    notes: "",
  });

  const addComboToCart = (e) => {
    const el = e.currentTarget;
    el.classList.add("bs-bounce");
    window.setTimeout(() => el.classList.remove("bs-bounce"), 400);
    if (
      comboNeedsBuyerVariantPicks(/** @type {Record<string, unknown>} */ (c), productById) &&
      typeof onComboAddIntent === "function"
    ) {
      onComboAddIntent(c);
      return;
    }
    addItem(payload());
  };

  const collageNodes =
    nShow > 0 ? (
      <div className={`bs-combo-collage ${collageClass}`} aria-hidden>
        {imageUrls.slice(0, nShow).map((u, i) => (
          <div key={`${i}-${u.slice(0, 24)}`} className="bs-combo-collage__cell">
            <LazyImage
              className="bs-combo-collage__media"
              imgClassName="bs-combo-collage__img"
              src={u}
              alt=""
              ratio="1 / 1"
              variant="food"
            />
          </div>
        ))}
      </div>
    ) : (
      <LazyImage
        className="bs-pcard__media"
        imgClassName="bs-pcard__img"
        src={img || null}
        alt={label}
        ratio="1 / 1"
        variant="food"
      />
    );

  const imageBlock =
    layout === "rail" ? (
      <div className="bs-pcard__img-wrap bs-pcard__img-wrap--combo-rail-inner">{collageNodes}</div>
    ) : (
      <div className="bs-pcard__img-wrap bs-pcard__img-wrap--combo-premium">
        {collageNodes}
        {!compact && saveAmt > 0.5 ? (
          <span className="bs-combo-save-badge">Save {formatCurrencyInr(saveAmt)}</span>
        ) : null}
        {unavailable ? <div className="bs-pcard__soldout">Out of stock</div> : null}
      </div>
    );

  const actionBlock =
    unavailable ? (
      <span className="bs-pcard__na">Unavailable</span>
    ) : inCart && line ? (
      <div className={`bs-stepper${compact ? " bs-stepper--minimal" : ""}`} role="group" aria-label="Quantity">
        <button
          type="button"
          className="bs-stepper__btn bs-stepper__btn--minus"
          onClick={() => setQty(line.id, qty - 1)}
          aria-label="Decrease"
        >
          <Minus size={16} strokeWidth={2.5} aria-hidden />
        </button>
        <span className="bs-stepper__qty">{qty}</span>
        <button
          type="button"
          className="bs-stepper__btn bs-stepper__btn--plus"
          onClick={() => setQty(line.id, qty + 1)}
          aria-label="Increase"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    ) : (
      <button
        type="button"
        className={`bs-pcard__add bs-ripple${compact ? " bs-pcard__add--minimal" : ""}`}
        onClick={addComboToCart}
      >
        ADD
      </button>
    );

  if (compact) {
    if (layout === "rail") {
      return (
        <div className="bs-pcard-wrap bs-pcard-wrap--combo-rail">
          <article
            className={`bs-combo-card-rail${unavailable ? " bs-combo-card-rail--unavailable" : ""}`}
          >
            <div className="bs-combo-card-rail__media">
              {imageBlock}
              {unavailable ? <div className="bs-combo-card-rail__soldout">Out of stock</div> : null}
            </div>
            <div className="bs-combo-card-rail__body">
              <h3 className="bs-combo-card-rail__name" title={label}>
                {label}
              </h3>
              <p className="bs-combo-card-rail__price">{formatCurrencyInr(price)}</p>
              <div className="bs-combo-card-rail__cta">{actionBlock}</div>
            </div>
          </article>
        </div>
      );
    }
    const inner = (
      <article
        className={`bs-pcard bs-pcard--combo bs-pcard--combo-compact${
          unavailable ? " bs-pcard--unavailable" : ""
        }`}
      >
        {imageBlock}
        <div className="bs-pcard__body bs-pcard__body--minimal">
          <h3 className="bs-pcard__title bs-pcard__title--minimal" title={label}>
            {label}
          </h3>
          <div className="bs-pcard__row bs-pcard__row--minimal">
            <span className="bs-pcard__price">{formatCurrencyInr(price)}</span>
          </div>
          <div className="bs-pcard__action">{actionBlock}</div>
        </div>
      </article>
    );
    return <li className="bs-pcard-wrap bs-pcard-wrap--combo-premium">{inner}</li>;
  }

  return (
    <li className="bs-pcard-wrap bs-pcard-wrap--combo-premium">
      <article
        className={`bs-pcard bs-pcard--combo bs-pcard--combo-premium${
          unavailable ? " bs-pcard--unavailable" : ""
        }`}
      >
        {imageBlock}
        <div className="bs-pcard__body">
          <h3 className="bs-pcard__title" title={label}>
            {label}
          </h3>
          <p className="bs-pcard__cat">{summary || "Combo meal"}</p>
          <div className="bs-pcard__row">
            <div className="bs-pcard__price-line">
              <span className="bs-pcard__price">{formatCurrencyInr(price)}</span>
              {originalPrice != null ? (
                <span className="bs-pcard__strike">{formatCurrencyInr(originalPrice)}</span>
              ) : null}
            </div>
          </div>
          <div className="bs-pcard__action">{actionBlock}</div>
        </div>
      </article>
    </li>
  );
}

export default memo(ComboCard);
