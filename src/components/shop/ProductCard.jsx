import { memo } from "react";
import { Minus, Plus, Star } from "lucide-react";
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

/**
 * @param {object} props
 * @param {boolean} [props.compact] — mobile-first minimal card (or horizontal row with layout=horizontal)
 * @param {boolean} [props.withDescription] — one line of description in compact mode
 * @param {boolean} [props.horizontal] — one row: image | name, price, ADD
 */
function ProductCard({
  p,
  sellerId,
  addItem,
  setQty,
  line,
  categoryLabel,
  meta: metaIn,
  compact = false,
  withDescription = false,
  horizontal = false,
  onOpenDetail,
}) {
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
  const openDetails = () => {
    if (typeof onOpenDetail === "function") onOpenDetail(p, meta);
  };

  if (compact) {
    if (horizontal) {
      return (
        <li className="bs-pcard-wrap bs-pcard-wrap--hoz">
          <article
            className={`bs-pcard bs-pcard--hoz${unavailable ? " bs-pcard--unavailable" : ""}`}
            onClick={openDetails}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openDetails();
              }
            }}
            role="button"
            tabIndex={0}
            aria-label={`View ${label} details`}
          >
            <div className="bs-pcard__hoz-left">
              <div className="bs-pcard__img-wrap bs-pcard__img-wrap--hoz">
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
            </div>
            <div className="bs-pcard__hoz-mid">
              <h3 className="bs-pcard__title bs-pcard__title--hoz" title={label}>
                {label}
              </h3>
              <span className="bs-pcard__price bs-pcard__price--hoz">{formatCurrencyInr(meta.price)}</span>
            </div>
            <div className="bs-pcard__hoz-action">
              {unavailable ? (
                <span className="bs-pcard__na">Unavailable</span>
              ) : inCart && line ? (
                <div className="bs-stepper bs-stepper--minimal" role="group" aria-label="Quantity">
                  <button
                    type="button"
                    className="bs-stepper__btn bs-stepper__btn--minus"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(line.id, qty - 1);
                    }}
                    aria-label="Decrease"
                  >
                    <Minus size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                  <span className="bs-stepper__qty">{qty}</span>
                  <button
                    type="button"
                    className="bs-stepper__btn bs-stepper__btn--plus"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(line.id, qty + 1);
                    }}
                    aria-label="Increase"
                  >
                    <Plus size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="bs-pcard__add bs-pcard__add--minimal bs-ripple"
                  onClick={(e) => {
                    e.stopPropagation();
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
          </article>
        </li>
      );
    }
    return (
      <li className="bs-pcard-wrap">
        <article
          className={`bs-pcard bs-pcard--minimal${unavailable ? " bs-pcard--unavailable" : ""}`}
          onClick={openDetails}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openDetails();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={`View ${label} details`}
        >
          <div className="bs-pcard__img-wrap bs-pcard__img-wrap--minimal">
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
          <div className="bs-pcard__body bs-pcard__body--minimal">
            <h3 className="bs-pcard__title bs-pcard__title--minimal" title={label}>
              {label}
            </h3>
            {tags.length > 0 ? (
              <div className="bs-pcard__tags-row" aria-label="Tags">
                {tags.slice(0, 2).map((tag, i) => (
                  <span
                    key={`${i}-${tag}`}
                    className="bs-pcard__tag-chip"
                    title={tag}
                  >
                    {tag.length > 16 ? `${tag.slice(0, 16)}…` : tag}
                  </span>
                ))}
              </div>
            ) : null}
            {withDescription && shortDesc ? (
              <p className="bs-pcard__desc bs-pcard__desc--minimal" title={shortDesc}>
                {shortDesc.length > 56 ? `${shortDesc.slice(0, 56)}…` : shortDesc}
              </p>
            ) : null}
            <div className="bs-pcard__row bs-pcard__row--minimal">
              <span className="bs-pcard__price">{formatCurrencyInr(meta.price)}</span>
            </div>
            <div className="bs-pcard__action">
              {unavailable ? (
                <span className="bs-pcard__na">Unavailable</span>
              ) : inCart && line ? (
                <div className="bs-stepper bs-stepper--minimal" role="group" aria-label="Quantity">
                  <button
                    type="button"
                    className="bs-stepper__btn bs-stepper__btn--minus"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(line.id, qty - 1);
                    }}
                    aria-label="Decrease"
                  >
                    <Minus size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                  <span className="bs-stepper__qty">{qty}</span>
                  <button
                    type="button"
                    className="bs-stepper__btn bs-stepper__btn--plus"
                    onClick={(e) => {
                      e.stopPropagation();
                      setQty(line.id, qty + 1);
                    }}
                    aria-label="Increase"
                  >
                    <Plus size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="bs-pcard__add bs-pcard__add--minimal bs-ripple"
                  onClick={(e) => {
                    e.stopPropagation();
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

  return (
    <li className="bs-pcard-wrap">
      <article
        className={`bs-pcard${unavailable ? " bs-pcard--unavailable" : ""}`}
        data-veg={vType !== "unknown" ? vType : undefined}
        onClick={openDetails}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetails();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`View ${label} details`}
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
                <span className="bs-pcard__strike">{formatCurrencyInr(meta.originalPrice)}</span>
              ) : null}
            </div>
            {starTag && !unavailable ? (
              <span className="bs-pcard__star" title={starTag}>
                <Star className="bs-pcard__star-ic" size={12} fill="currentColor" strokeWidth={0} aria-hidden />
                {starTag.length > 12 ? `${starTag.slice(0, 12)}…` : starTag}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setQty(line.id, qty - 1);
                  }}
                  aria-label="Decrease"
                >
                  <Minus size={16} strokeWidth={2.5} aria-hidden />
                </button>
                <span className="bs-stepper__qty">{qty}</span>
                <button
                  type="button"
                  className="bs-stepper__btn bs-stepper__btn--plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQty(line.id, qty + 1);
                  }}
                  aria-label="Increase"
                >
                  <Plus size={16} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="bs-pcard__add bs-ripple"
                onClick={(e) => {
                  e.stopPropagation();
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

function productCardPropsEqual(prev, next) {
  if (prev.sellerId !== next.sellerId) return false;
  if (prev.compact !== next.compact || prev.horizontal !== next.horizontal || prev.withDescription !== next.withDescription)
    return false;
  if ((prev.categoryLabel || "") !== (next.categoryLabel || "")) return false;
  if (prev.p?.id !== next.p?.id) return false;
  if (String(prev.p?.name ?? "") !== String(next.p?.name ?? "")) return false;
  const imgA = String(prev.p?.imageUrl ?? prev.p?.image ?? "");
  const imgB = String(next.p?.imageUrl ?? next.p?.image ?? "");
  if (imgA !== imgB) return false;
  const ma = prev.meta ?? getProductOfferMeta(prev.p);
  const mb = next.meta ?? getProductOfferMeta(next.p);
  if (ma.price !== mb.price || ma.hasDiscount !== mb.hasDiscount) return false;
  if (Number(ma.originalPrice) !== Number(mb.originalPrice)) return false;
  if (String(ma.offerLabel ?? "") !== String(mb.offerLabel ?? "")) return false;
  if (isProductUnavailable(prev.p) !== isProductUnavailable(next.p)) return false;
  const la = prev.line;
  const lb = next.line;
  if ((la?.id ?? "") !== (lb?.id ?? "")) return false;
  if (Number(la?.qty) !== Number(lb?.qty)) return false;
  if (prev.onOpenDetail !== next.onOpenDetail || prev.addItem !== next.addItem || prev.setQty !== next.setQty) return false;
  return true;
}

export default memo(ProductCard, productCardPropsEqual);
