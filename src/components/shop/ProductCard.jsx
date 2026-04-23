import { memo } from "react";
import { LazyImage } from "../ui/LazyImage";
import { formatCurrencyInr } from "../../utils/format";
import { getProductOfferMeta } from "../../utils/pricing";
import { getVegType, isProductUnavailable } from "../../utils/menuSections";

function formatPrepTime(p) {
  const raw =
    p.prepTime ??
    p.prepTimeMinutes ??
    p.prepTimeMins ??
    p.preparationTime ??
    p.prep;
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0) return `${Math.round(n)} min`;
  return String(raw);
}

function productImageUrl(p) {
  const u = p.imageUrl ?? p.image;
  return typeof u === "string" && u.trim() ? u.trim() : "";
}

function productTagList(p) {
  if (Array.isArray(p.tags)) {
    return p.tags.map((x) => String(x).trim()).filter(Boolean);
  }
  if (typeof p.tags === "string" && p.tags.trim()) {
    return p.tags
      .split(/[,|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (p.tag) return [String(p.tag)];
  return [];
}

function ProductCard({ p, sellerId, addItem, setQty, line, categoryLabel, meta: metaIn }) {
  const meta = metaIn || getProductOfferMeta(p);
  const img = productImageUrl(p);
  const label = p.name || "Item";
  const kind = meta.hasDiscount ? "discount" : "product";
  const tags = productTagList(p);
  const starTag = tags[0] || meta.offerLabel;
  const prep = formatPrepTime(p);
  const qty = line ? Math.max(0, Math.floor(Number(line.qty) || 0)) : 0;
  const inCart = qty > 0;
  const cat = categoryLabel || (p.category && String(p.category).trim()) || "Menu";
  const shortDesc = [p.description, p.desc, p.subtitle, p.shortDescription]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .find((s) => s.length > 0);
  const unavailable = isProductUnavailable(p);
  const vType = getVegType(p);

  const payload = () => ({
    id: p.id,
    productId: p.id,
    kind,
    name: label,
    price: meta.price,
    originalPrice: meta.originalPrice,
    offerLabel: meta.offerLabel || "",
    sellerId,
    qty: 1,
    imageUrl: img || "",
    prepTime: prep || "",
    notes: "",
  });

  return (
    <li className="bs-pcard-wrap">
      <article
        className={`bs-pcard${unavailable ? " bs-pcard--unavailable" : ""}`}
        data-veg={vType !== "unknown" ? vType : undefined}
      >
        <div className="bs-pcard__img-wrap">
          <LazyImage
            className="bs-pcard__media"
            imgClassName="bs-pcard__img"
            src={img || null}
            alt={label}
            ratio="1 / 1"
            variant="food"
          />
          {unavailable ? <div className="bs-pcard__soldout">Out of stock</div> : null}
        </div>
        <div className="bs-pcard__body">
          <div className="bs-pcard__title-row">
            {vType === "veg" ? <span className="bs-veg bs-veg--v" title="Vegetarian" /> : null}
            {vType === "nonveg" ? <span className="bs-veg bs-veg--nv" title="Non-vegetarian" /> : null}
            {vType === "egg" ? <span className="bs-veg bs-veg--egg" title="Contains egg" /> : null}
            <h3 className="bs-pcard__title" title={label}>
              {label}
            </h3>
          </div>
          {shortDesc ? <p className="bs-pcard__desc">{shortDesc.length > 80 ? `${shortDesc.slice(0, 80)}…` : shortDesc}</p> : null}
          <p className="bs-pcard__cat">{cat}</p>
          <div className="bs-pcard__row">
            <div className="bs-pcard__price-line">
              <span className="bs-pcard__price">{formatCurrencyInr(meta.price)}</span>
              {meta.originalPrice != null && meta.originalPrice > meta.price ? (
                <span className="bs-pcard__strike">
                  {formatCurrencyInr(meta.originalPrice)}
                </span>
              ) : null}
            </div>
            {starTag && !unavailable ? (
              <span className="bs-pcard__star" title={starTag}>
                ⭐ {starTag.length > 12 ? `${starTag.slice(0, 12)}…` : starTag}
              </span>
            ) : null}
          </div>
          <div className="bs-pcard__action">
            {unavailable ? (
              <span className="bs-pcard__na">Unavailable</span>
            ) : inCart && line ? (
              <div className="bs-stepper" role="group" aria-label="Quantity">
                <button
                  type="button"
                  className="bs-stepper__btn bs-stepper__btn--minus"
                  onClick={() => setQty(line.id, qty - 1)}
                  aria-label="Decrease"
                >
                  −
                </button>
                <span className="bs-stepper__qty">{qty}</span>
                <button
                  type="button"
                  className="bs-stepper__btn bs-stepper__btn--plus"
                  onClick={() => {
                    setQty(line.id, qty + 1);
                  }}
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="bs-pcard__add bs-ripple"
                onClick={(e) => {
                  const el = e.currentTarget;
                  el.classList.add("bs-bounce");
                  window.setTimeout(() => el.classList.remove("bs-bounce"), 400);
                  addItem(payload());
                }}
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

export default memo(ProductCard);
