import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { LazyImage } from "../ui/LazyImage";
import { formatCurrencyInr } from "../../utils/format";
import { getShopMenuSectionLabel } from "../../utils/menuAssignment";

function readTags(product) {
  if (Array.isArray(product?.tags)) return product.tags.map((x) => String(x).trim()).filter(Boolean);
  if (typeof product?.tags === "string") {
    return product.tags.split(/[,|]/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

function readCuisine(product) {
  return String(product?.cuisineCategoryName ?? product?.cuisine_category_name ?? product?.cuisine ?? "").trim();
}

export default function ItemDetailModal({
  open,
  product,
  meta,
  line,
  onClose,
  onSetQty,
  onAdd,
  lineId,
}) {
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (!open) return;
    const next = line ? Math.max(1, Number(line.qty) || 1) : 1;
    setQty(next);
  }, [open, line]);

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
    const i = product?.imageUrl ?? product?.image;
    return typeof i === "string" && i.trim() ? i.trim() : null;
  }, [product]);

  if (!open || !product || !meta) return null;

  const tags = readTags(product);
  const cuisine = readCuisine(product);
  const menuCategory = getShopMenuSectionLabel(product);
  const description = String(
    product?.description ?? product?.desc ?? product?.subtitle ?? product?.shortDescription ?? ""
  ).trim();

  return (
    <div className="bs-item-modal-backdrop" onClick={onClose} role="presentation">
      <div className="bs-item-modal" role="dialog" aria-modal="true" aria-label={`${product.name || "Item"} details`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bs-item-modal__close" onClick={onClose} aria-label="Close item details">
          <X size={18} />
        </button>
        <div className="bs-item-modal__media">
          <LazyImage
            className="bs-item-modal__media-inner"
            imgClassName="bs-item-modal__img"
            src={imageUrl}
            alt={String(product.name || "Item")}
            ratio="16 / 10"
            variant="food"
          />
        </div>
        <div className="bs-item-modal__body">
          <h3 className="bs-item-modal__title">{String(product.name || "Item")}</h3>
          {description ? <p className="bs-item-modal__desc">{description}</p> : null}
          <p className="bs-item-modal__price">{formatCurrencyInr(Number(meta.price) || 0)}</p>
          <div className="bs-item-modal__meta">
            {cuisine ? <span className="bs-item-modal__pill">{cuisine}</span> : null}
            {menuCategory ? <span className="bs-item-modal__pill">{menuCategory}</span> : null}
            {tags.slice(0, 4).map((tag) => (
              <span key={tag} className="bs-item-modal__pill">{tag}</span>
            ))}
          </div>
          <div className="bs-item-modal__addons">
            <strong>Add-ons / Modifiers</strong>
            <p>Customization options are coming soon.</p>
          </div>
          <div className="bs-item-modal__footer">
            <div className="bs-stepper bs-stepper--modal" role="group" aria-label="Quantity">
              <button type="button" className="bs-stepper__btn" onClick={() => setQty((n) => Math.max(1, n - 1))} aria-label="Decrease quantity">
                <Minus size={16} />
              </button>
              <span className="bs-stepper__qty">{qty}</span>
              <button type="button" className="bs-stepper__btn" onClick={() => setQty((n) => n + 1)} aria-label="Increase quantity">
                <Plus size={16} />
              </button>
            </div>
            <button
              type="button"
              className="bs-item-modal__cta"
              onClick={() => {
                if (line && lineId) onSetQty(lineId, qty);
                else onAdd(qty);
                onClose();
              }}
            >
              {line ? "Update quantity" : "Add to cart"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
