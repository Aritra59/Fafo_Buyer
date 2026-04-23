import { memo } from "react";
import { LazyImage } from "../ui/LazyImage";
import { formatCurrencyInr } from "../../utils/format";

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

function ComboCard({ c, sellerId, addItem, setQty, line }) {
  const img = comboImageUrl(c);
  const label = c.name || "Combo";
  const price = Number(c.price) || 0;
  const origRaw = c.originalPrice ?? c.compareAtPrice ?? c.mrp;
  const orig = Number(origRaw) || 0;
  const originalPrice = orig > price ? orig : undefined;
  const summary = comboItemsSummary(c);
  const lineId = `combo_${c.id}`;
  const qty = line ? Math.max(0, Math.floor(Number(line.qty) || 0)) : 0;
  const inCart = qty > 0;
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
    imageUrl: img || "",
    prepTime: "",
    comboSummary: summary,
    notes: "",
  });

  return (
    <li className="bs-pcard-wrap">
      <article className="bs-pcard bs-pcard--combo">
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
          <p className="bs-pcard__cat">{summary || "Combo meal"}</p>
          <div className="bs-pcard__row">
            <div className="bs-pcard__price-line">
              <span className="bs-pcard__price">{formatCurrencyInr(price)}</span>
              {originalPrice != null ? (
                <span className="bs-pcard__strike">{formatCurrencyInr(originalPrice)}</span>
              ) : null}
            </div>
            <span className="bs-pcard__star" title="Combo">
              ⭐ Combo
            </span>
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
                  onClick={() => setQty(line.id, qty + 1)}
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

export default memo(ComboCard);
