import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "nomad_buyer_cart_v1";

const CartContext = createContext(null);

function loadLines() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }) {
  const [lines, setLines] = useState([]);

  useEffect(() => {
    setLines(loadLines());
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const sellerId = useMemo(
    () => (lines.length > 0 ? lines[0].sellerId : null),
    [lines]
  );

  const subtotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const qty = Number(l.qty) || 0;
        const unit = Number(l.price) || 0;
        const orig = Number(l.originalPrice) || 0;
        const base = orig > unit ? orig : unit;
        return sum + base * qty;
      }, 0),
    [lines]
  );

  const savings = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const qty = Number(l.qty) || 0;
        const unit = Number(l.price) || 0;
        const orig = Number(l.originalPrice) || 0;
        if (orig > unit) return sum + (orig - unit) * qty;
        return sum;
      }, 0),
    [lines]
  );

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + Number(l.price || 0) * Number(l.qty || 0),
        0
      ),
    [lines]
  );

  const addItem = useCallback((item) => {
    const sid = item.sellerId;
    setLines((prev) => {
      let base = prev;
      if (prev.length > 0 && prev[0].sellerId !== sid) {
        const ok = window.confirm(
          "Your cart has items from another shop. Clear cart and add this item?"
        );
        if (!ok) return prev;
        base = [];
      }
      const idx = base.findIndex((l) => l.id === item.id);
      if (idx === -1) {
        return [
          ...base,
          {
            ...item,
            qty: item.qty ?? 1,
            notes: item.notes != null ? String(item.notes) : "",
          },
        ];
      }
      const copy = [...base];
      const nextImg =
        item.imageUrl != null && String(item.imageUrl).trim()
          ? String(item.imageUrl).trim()
          : copy[idx].imageUrl;
      const nextOrig =
        item.originalPrice != null && Number(item.originalPrice) > 0
          ? Number(item.originalPrice)
          : copy[idx].originalPrice;
      const nextOffer =
        item.offerLabel != null && String(item.offerLabel).trim()
          ? String(item.offerLabel).trim()
          : copy[idx].offerLabel;
      const nextNotes =
        item.notes != null ? String(item.notes) : copy[idx].notes || "";
      copy[idx] = {
        ...copy[idx],
        qty: (copy[idx].qty || 0) + (item.qty ?? 1),
        imageUrl: nextImg,
        prepTime:
          item.prepTime != null && item.prepTime !== ""
            ? item.prepTime
            : copy[idx].prepTime,
        originalPrice: nextOrig,
        offerLabel: nextOffer,
        price:
          item.price != null && !Number.isNaN(Number(item.price))
            ? Number(item.price)
            : copy[idx].price,
        notes: nextNotes,
        variantId: item.variantId != null ? item.variantId : copy[idx].variantId,
        variantLabel:
          item.variantLabel != null ? String(item.variantLabel) : copy[idx].variantLabel,
        subLabel: item.subLabel != null ? String(item.subLabel) : copy[idx].subLabel,
        comboVariantPicks: Array.isArray(item.comboVariantPicks)
          ? item.comboVariantPicks
          : copy[idx].comboVariantPicks,
      };
      return copy;
    });
  }, []);

  const setQty = useCallback((lineId, qty) => {
    const q = Math.max(0, Math.floor(Number(qty) || 0));
    setLines((prev) => {
      if (q === 0) return prev.filter((l) => l.id !== lineId);
      return prev.map((l) => (l.id === lineId ? { ...l, qty: q } : l));
    });
  }, []);

  const setLineNote = useCallback((lineId, note) => {
    const t = String(note ?? "");
    setLines((prev) =>
      prev.map((l) => (l.id === lineId ? { ...l, notes: t } : l))
    );
  }, []);

  const removeLine = useCallback((lineId) => {
    setLines((prev) => prev.filter((l) => l.id !== lineId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const replaceLines = useCallback((next) => {
    setLines(Array.isArray(next) ? next : []);
  }, []);

  const lineCount = useMemo(
    () => lines.reduce((n, l) => n + (l.qty || 0), 0),
    [lines]
  );

  const value = useMemo(
    () => ({
      sellerId,
      lines,
      subtotal,
      savings,
      total,
      lineCount,
      addItem,
      setQty,
      setLineNote,
      removeLine,
      clear,
      replaceLines,
    }),
    [
      sellerId,
      lines,
      subtotal,
      savings,
      total,
      lineCount,
      addItem,
      setQty,
      setLineNote,
      removeLine,
      clear,
      replaceLines,
    ]
  );

  return (
    <CartContext.Provider value={value}>{children}</CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
