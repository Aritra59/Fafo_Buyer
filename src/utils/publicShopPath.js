/**
 * @param {Record<string, unknown> | null | undefined} seller
 * @returns {string}
 */
export function getPublicMenuPath(seller) {
  if (!seller) return "";
  const code = String(seller.shopCode || "").trim();
  if (code) return `/shop/${encodeURIComponent(code)}`;
  const slug = String(seller.shopSlug || seller.slug || "").trim();
  if (slug) return `/s/${encodeURIComponent(slug)}`;
  return "";
}
