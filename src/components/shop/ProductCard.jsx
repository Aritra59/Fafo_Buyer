import { memo } from "react";
import { LazyImage } from "../ui/LazyImage";
import { formatCurrencyInr } from "../../utils/format";
import { getProductOfferMeta } from "../../utils/pricing";

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
  if (p.tag)   return [String(p.tag)];
  return [];
}

function ProductCard({
  p,
  sellerId,
  addItem,
  setQty,
  line,
  discountSection,
  categoryLabel,
}) {
  const meta = getProductOfferMeta(p);
  const img = productImageUrl(p);
  const label = p.name || "Item";
  const kind = discountSection ? "discount" : "product";
  const tags = productTagList(p);
  const starTag = tags[0] || meta.offerLabel;
  const prep = formatPrepTime(p);
  const qty = line ? Math.max(0, Math.floor(Number(line.qty) || 0)) : 0;
  const inCart = qty > 0;
  const cat = categoryLabel || (p.category && String(p.category).trim()) || "Menu";

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
      <article className="bs-pcard">
        <div className="bs-pcard__img-wrap">
          <LazyImage
            className="bs-pcard__media"
            imgClassName="bs-pcard__img"
            src={img || null}
            alt={label}
            ratio="1 / 1"
            variant="food"
          />
        </div>
        <div className="bs-pcard__body">
          <h3 className="bs-pcard__title" title={label}>
            {label}
          </h3>
          <p className="bs-pcard__cat">{cat}</p>
          <div className="bs-pcard__row">
            <div className="bs-pcard__price-line">
              <span className="bs-pcard__price">{formatCurrencyInr(meta.price)}</span>
              {meta.originalPrice != null && meta.originalPrice > meta.price ? (
                <span className="bs-pcard__strike">{formatCurrencyInr(meta.originalPrice)}</span>
              ) : null}
            </div>
            {starTag ? (
              <span className="bs-pcard__star" title={starTag}>
                ⭐ {starTag.length > 12 ? `${starTag.slice(0, 12)}…` : starTag}
              </span>
            ) : null}
          </div>
          <div className="bs-pcard__action">
            {inCart && line ? (
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
