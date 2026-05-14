import { memo, useCallback, useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { LazyImage } from "../ui/LazyImage";
import { formatCurrencyInr } from "../../utils/format";
import {
  comboNeedsBuyerVariantPicks,
  findVariantOnProduct,
  getComboVariantPickRequirements,
  normalizeProductVariants,
  productHasSelectableVariants,
} from "../../utils/productVariants";

/**
 * @typedef {{ productId: string, variantId: string, variantLabel: string, subLabel: string }} ComboVariantPick
 */

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {Record<string, unknown> | null} props.combo
 * @param {string} props.sellerId
 * @param {Map<string, Record<string, unknown>>} props.productById
 * @param {() => void} props.onClose
 * @param {(picks: ComboVariantPick[], item: Record<string, unknown>) => void} props.onConfirmAdd
 */
function ComboVariantSheet({ open, combo, sellerId, productById, onClose, onConfirmAdd }) {
  const gid = useId().replace(/:/g, "");
  const requirements = useMemo(
    () => (combo && productById ? getComboVariantPickRequirements(combo, productById) : []),
    [combo, productById]
  );
  const needsPick = useMemo(
    () => (combo && productById ? comboNeedsBuyerVariantPicks(combo, productById) : false),
    [combo, productById]
  );

  /** @type {Record<string, string>} */
  const [choiceByProductId, setChoiceByProductId] = useState({});

  useEffect(() => {
    if (!open || !combo || !needsPick) return;
    const next = /** @type {Record<string, string>} */ ({});
    for (const r of getComboVariantPickRequirements(combo, productById)) {
      if (!r.requiresPick) continue;
      const p = productById.get(r.productId);
      const vars = p ? normalizeProductVariants(/** @type {Record<string, unknown>} */ (p)) : [];
      if (vars[0]?.id) next[r.productId] = vars[0].id;
    }
    setChoiceByProductId(next);
  }, [open, combo, productById, needsPick]);

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

  const img = combo?.imageUrl ?? combo?.image;
  const imageUrl = typeof img === "string" && img.trim() ? img.trim() : null;
  const label = combo?.name != null ? String(combo.name) : "Combo";
  const price = Number(combo?.price) || 0;
  const summary = useMemo(() => {
    if (!combo) return "";
    const raw = combo.items ?? combo.itemList ?? combo.comboItems;
    if (Array.isArray(raw)) {
      return raw
        .map((x) => (typeof x === "string" ? x : x?.name || x?.title || x?.label || ""))
        .filter(Boolean)
        .join(" · ");
    }
    return "";
  }, [combo]);

  const buildPicks = useCallback(() => {
    if (!combo || !productById) return /** @type {ComboVariantPick[]} */ ([]);
    /** @type {ComboVariantPick[]} */
    const picks = [];
    for (const r of getComboVariantPickRequirements(combo, productById)) {
      const p = productById.get(r.productId);
      if (!p || !productHasSelectableVariants(p)) continue;
      const vid = r.requiresPick ? choiceByProductId[r.productId] : r.fixedVariantId;
      if (!vid) continue;
      const v = findVariantOnProduct(p, vid);
      if (!v) continue;
      picks.push({
        productId: r.productId,
        variantId: v.id,
        variantLabel: v.label,
        subLabel: v.subLabel || "",
      });
    }
    return picks;
  }, [combo, productById, choiceByProductId]);

  const handleConfirm = useCallback(() => {
    if (!combo || !sellerId) return;
    const lineId = `combo_${combo.id}`;
    for (const r of requirements) {
      if (!r.requiresPick) continue;
      const id = choiceByProductId[r.productId];
      if (!id) return;
    }
    const picks = buildPicks();
    onConfirmAdd(picks, {
      id: lineId,
      productId: lineId,
      kind: "combo",
      name: label,
      price,
      originalPrice: undefined,
      offerLabel: "",
      sellerId,
      qty: 1,
      imageUrl: imageUrl || "",
      prepTime: "",
      comboSummary: summary,
      comboVariantPicks: picks,
      notes: "",
    });
    onClose();
  }, [
    combo,
    sellerId,
    label,
    price,
    imageUrl,
    summary,
    buildPicks,
    choiceByProductId,
    requirements,
    onConfirmAdd,
    onClose,
  ]);

  if (!open || !combo || !needsPick) return null;

  const pickRows = requirements.filter((r) => r.requiresPick);

  return (
    <div className="bs-overlay bs-overlay--variant" onClick={onClose} role="presentation">
      <div
        className="bs-sheet bs-sheet--variant bs-sheet--combo-variant"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${gid}-ctitle`}
        onClick={(e) => e.stopPropagation()}
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
        <h2 id={`${gid}-ctitle`} className="bs-variant-sheet__title">
          {label}
        </h2>
        <p className="bs-variant-sheet__hint">Choose options for items in this combo.</p>

        {pickRows.map((r) => {
          const p = productById.get(r.productId);
          const vars = p ? normalizeProductVariants(/** @type {Record<string, unknown>} */ (p)) : [];
          const sel = choiceByProductId[r.productId] || vars[0]?.id || "";
          return (
            <div key={r.productId} className="bs-combo-variant-block">
              <p className="bs-variant-sheet__section-label">{r.productName}</p>
              <ul className="bs-variant-sheet__options" role="radiogroup" aria-label={r.productName}>
                {vars.map((v) => {
                  const checked = v.id === sel;
                  const strike = v.originalPrice != null && v.originalPrice > v.price;
                  return (
                    <li key={v.id} className="bs-variant-sheet__opt-li">
                      <label
                        className={`bs-variant-opt${checked ? " bs-variant-opt--checked" : ""}`}
                      >
                        <input
                          type="radio"
                          className="bs-variant-opt__radio"
                          name={`combo-var-${gid}-${r.productId}`}
                          value={v.id}
                          checked={checked}
                          onChange={() =>
                            setChoiceByProductId((prev) => ({ ...prev, [r.productId]: v.id }))
                          }
                        />
                        <span className="bs-variant-opt__main">
                          <span className="bs-variant-opt__label">{v.label}</span>
                          {v.subLabel ? (
                            <span className="bs-variant-opt__sub">{v.subLabel}</span>
                          ) : null}
                        </span>
                        <span className="bs-variant-opt__price">
                          {strike ? (
                            <span className="bs-variant-opt__strike">
                              {formatCurrencyInr(v.originalPrice)}
                            </span>
                          ) : null}
                          {formatCurrencyInr(v.price)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        <button type="button" className="bs-variant-sheet__cta" onClick={handleConfirm}>
          Add combo — {formatCurrencyInr(price)}
        </button>
      </div>
    </div>
  );
}

export default memo(ComboVariantSheet);
