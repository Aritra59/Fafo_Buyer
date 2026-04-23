/**
 * @param {Record<string, unknown>} p
 */
export function getProductOfferMeta(p) {
  const price = Number(p.price) || 0;
  const origRaw = p.originalPrice ?? p.compareAtPrice ?? p.mrp ?? p.listPrice;
  const orig = Number(origRaw) || 0;
  const flagDiscount =
    p.isDiscount === true ||
    p.discount === true ||
    p.onOffer === true ||
    p.onSale === true;
  const hasStrikeDeal = orig > price && price >= 0;
  const hasDiscount = flagDiscount || hasStrikeDeal;
  const offerLabel =
    (p.offerLabel && String(p.offerLabel).trim()) ||
    (p.offerTag && String(p.offerTag).trim()) ||
    (hasStrikeDeal ? "OFFER" : "");
  const originalPrice = hasStrikeDeal ? orig : undefined;
  return { price, originalPrice, offerLabel, hasDiscount };
}

/**
 * Menu "Discount items" section (not duplicate in main grid).
 * @param {Record<string, unknown>} p
 * @param {{ hasDiscount: boolean }} meta
 */
export function isDiscountSectionProduct(p, meta) {
  if (meta.hasDiscount) return true;
  const cat = String(p.category || "")
    .trim()
    .toLowerCase();
  return (
    cat.includes("discount") ||
    cat.includes("offer") ||
    cat.includes("sale")
  );
}
