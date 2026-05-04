export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
};

export const getShopUrl = (shopCode) => {
  return `${getBaseUrl()}/shop/${shopCode}`;
};

export const getPublicShopUrl = (seller) => {
  const base = getBaseUrl();
  const slug = String(seller?.shopSlug || seller?.slug || "").trim();
  const code = String(seller?.shopCode || "").trim();
  const identifier = slug || code;
  if (!identifier) return "";
  return `${base}/s/${encodeURIComponent(identifier)}`;
};
