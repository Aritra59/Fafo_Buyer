import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { LazyImage } from "../ui/LazyImage";
import { formatCurrencyInr } from "../../utils/format";
import { getProductOfferMeta } from "../../utils/pricing";
import {
  findVariantOnProduct,
  formatLineDisplayName,
  normalizeProductVariants,
} from "../../utils/productVariants";

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {Record<string, unknown> | null} props.product
 * @param {string} props.sellerId
 * @param {() => void} props.onClose
 * @param {(item: Record<string, unknown>) => void} props.onAddToCart
 */
function ProductVariantSheet({ open, product, sellerId, onClose, onAddToCart }) {
  const gid = useId().replace(/:/g, "");
  const variants = useMemo(
    () => (product ? normalizeProductVariants(product) : []),
    [product]
  );
  const [selectedId, setSelectedId] = useState("");
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open || !product) return;
    const first = variants[0]?.id || "";
    setSelectedId(first);
    setQty(1);
    setNotes("");
  }, [open, product, variants]);

  useEffect(() => {
    if (!open) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = old;
      window.removeEventListener("keydown", onEsc);
    };
  }, [open, onClose]);

  const imageUrl = useMemo(() => {
    if (!product) return null;
    const i = product.imageUrl ?? product.image;
    return typeof i === "string" && i.trim() ? i.trim() : null;
  }, [product]);

  const description = useMemo(() => {
    if (!product) return "";
    return String(
      product.description ?? product.desc ?? product.subtitle ?? product.shortDescription ?? ""
    ).trim();
  }, [product]);

  const label = product?.name != null ? String(product.name) : "Item";

  const selected = useMemo(() => {
    if (!product || !selectedId) return null;
    return findVariantOnProduct(product, selectedId);
  }, [product, selectedId]);

  const handleConfirm = useCallback(() => {
    if (!product || !selected || !sellerId) return;
    const pid = String(product.id ?? "");
    if (!pid) return;
    const meta = getProductOfferMeta(/** @type {Record<string, unknown>} */ (product));
    const lineName = formatLineDisplayName(label, selected.label);
    const orig = selected.originalPrice;
    const hasStrike = orig != null && orig > selected.price;
    onAddToCart({
      id: `${pid}__v__${selected.id}`,
      productId: pid,
      variantId: selected.id,
      variantLabel: selected.label,
      subLabel: selected.subLabel || "",
      kind: meta.hasDiscount ? "discount" : "product",
      name: lineName,
      price: selected.price,
      originalPrice: hasStrike ? orig : undefined,
      offerLabel: meta.offerLabel || "",
      sellerId,
      qty,
      imageUrl: imageUrl || "",
      prepTime: "",
      notes: String(notes || "").trim(),
    });
    onClose();
  }, [product, selected, sellerId, qty, notes, imageUrl, label, onAddToCart, onClose]);

  if (!open || !product || variants.length === 0) return null;

  return (
    <div className="bs-overlay bs-overlay--variant" onClick={onClose} role="presentation">
      <div
        className="bs-sheet bs-sheet--variant"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${gid}-vtitle`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="bs-sheet__bar" />
        <button type="button" className="bs-variant-sheet__close" onClick={onClose} aria-label="Close">
          <X size={18} strokeWidth={2} aria-hidden />
        </button>

        <div className="bs-variant-sheet__hero">
          <LazyImage
            className="bs-variant-sheet__media"
            imgClassName="bs-variant-sheet__img"
            src={imageUrl}
            alt={label}
            ratio="16 / 10"
            variant="food"
          />
        </div>
        <h2 id={`${gid}-vtitle`} className="bs-variant-sheet__title">
          {label}
        </h2>
        {description ? <p className="bs-variant-sheet__desc">{description}</p> : null}

        <p className="bs-variant-sheet__section-label">Choose size</p>
        <ul className="bs-variant-sheet__options" role="radiogroup" aria-label="Variants">
          {variants.map((v) => {
            const checked = v.id === selectedId;
            const strike = v.originalPrice != null && v.originalPrice > v.price;
            return (
              <li key={v.id} className="bs-variant-sheet__opt-li">
                <label
                  className={`bs-variant-opt${checked ? " bs-variant-opt--checked" : ""}`}
                >
                  <input
                    type="radio"
                    className="bs-variant-opt__radio"
                    name={`variant-${gid}`}
                    value={v.id}
                    checked={checked}
                    onChange={() => setSelectedId(v.id)}
                  />
                  <span className="bs-variant-opt__main">
                    <span className="bs-variant-opt__label">{v.label}</span>
                    {v.subLabel ? (
                      <span className="bs-variant-opt__sub">{v.subLabel}</span>
                    ) : null}
                  </span>
                  <span className="bs-variant-opt__price">
                    {strike ? (
                      <span className="bs-variant-opt__strike">{formatCurrencyInr(v.originalPrice)}</span>
                    ) : null}
                    {formatCurrencyInr(v.price)}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="bs-variant-sheet__qty-row">
          <span className="bs-variant-sheet__qty-label">Quantity</span>
          <div className="bs-stepper bs-stepper--modal" role="group" aria-label="Quantity">
            <button
              type="button"
              className="bs-stepper__btn"
              onClick={() => setQty((n) => Math.max(1, n - 1))}
              aria-label="Decrease quantity"
            >
              <Minus size={16} strokeWidth={2.5} aria-hidden />
            </button>
            <span className="bs-stepper__qty">{qty}</span>
            <button
              type="button"
              className="bs-stepper__btn"
              onClick={() => setQty((n) => Math.min(99, n + 1))}
              aria-label="Increase quantity"
            >
              <Plus size={16} strokeWidth={2.5} aria-hidden />
            </button>
          </div>
        </div>

        <label className="bs-field-label-sm bs-variant-sheet__notes" htmlFor={`${gid}-notes`}>
          Special instructions (optional)
        </label>
        <textarea
          id={`${gid}-notes`}
          className="nb-input bs-variant-sheet__textarea"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Less ice, no sugar…"
          maxLength={500}
        />

        <button type="button" className="bs-variant-sheet__cta" onClick={handleConfirm} disabled={!selected}>
          Add to cart
        </button>
      </div>
    </div>
  );
}

export default memo(ProductVariantSheet);
