import { getBaseUrl, getPublicShopUrl } from "./url";

/**
 * @param {Record<string, unknown> | null | undefined} seller
 * @returns {string}
 */
export function getPublicMenuPath(seller) {
  if (!seller) return "";
  const slug = String(seller.shopSlug || seller.slug || "").trim();
  const code = String(seller.shopCode || "").trim();
  const identifier = slug || code;
  if (identifier) return `/s/${encodeURIComponent(identifier)}`;
  return "";
}

/**
 * Absolute public shop URL resolved from current origin.
 * Useful for QR/share-style redirects without hardcoded domains.
 *
 * @param {Record<string, unknown> | null | undefined} seller
 * @returns {string}
 */
export function getPublicMenuUrl(seller) {
  if (!seller) return "";
  const publicUrl = getPublicShopUrl(seller);
  if (publicUrl) return publicUrl;
  const slug = String(seller.shopSlug || seller.slug || "").trim();
  if (slug) {
    return `${getBaseUrl()}/s/${encodeURIComponent(slug)}`;
  }
  return "";
}
