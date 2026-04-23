import { useMemo } from "react";
import { Link } from "react-router-dom";
import { getDistance } from "../utils/haversine";
import { normalizeLocation } from "../utils/location";
import { formatDistanceKm } from "../utils/format";
import { sellerPassesDiscoveryFilters } from "../utils/shopStatus";
import { getShopOpenUiState } from "../utils/shopOpenStatus";
import { Card } from "./ui/Card";
import { LazyImage } from "./ui/LazyImage";

const MAX_KM = 10;

function DeliveryBadge() {
  return (
    <span className="nb-delivery-badge" title="Delivery available">
      <svg
        className="nb-delivery-badge__icon"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M4 16v2a1 1 0 001 1h1m10-3v2a1 1 0 01-1 1h-1m-6 0h4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="7" cy="19" r="1.5" fill="currentColor" />
        <circle cx="17" cy="19" r="1.5" fill="currentColor" />
        <path
          d="M3 11h3l2-4h6v8H3V11z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M14 7h3l2 4v4h-5V7z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      Delivery
    </span>
  );
}

function ShopGridSkeleton() {
  return (
    <ul className="nb-shop-grid" aria-busy="true" aria-label="Loading shops">
      {[1, 2, 3, 4].map((k) => (
        <li key={k}>
          <div className="nb-shop-card nb-shop-card--skeleton">
            <div
              className="nb-shop-card__media nb-skeleton-block"
              style={{ aspectRatio: "16 / 10" }}
            />
            <div className="nb-shop-card__body">
              <div className="nb-skeleton-line nb-skeleton-line--lg" />
              <div className="nb-skeleton-line nb-skeleton-line--sm" />
              <div className="nb-shop-card__meta-row">
                <div className="nb-skeleton-pill" />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * @param {{
 *   user: object | null,
 *   search: string,
 *   sellersLoading: boolean,
 *   sellers: object[],
 *   emptyLinkTo?: string,
 * }} props
 */
export default function NearbyShopsSection({
  user,
  search,
  sellersLoading,
  sellers,
  emptyLinkTo = "/profile",
}) {
  const buyerPoint = normalizeLocation(user?.location);

  const rows = useMemo(() => {
    if (!user || user.location == null || buyerPoint == null) {
      return [];
    }
    const q = String(search || "").trim().toLowerCase();
    return sellers
      .filter((seller) => sellerPassesDiscoveryFilters(seller))
      .map((seller) => {
        const sellerPt = normalizeLocation(seller?.location);
        if (!sellerPt) return null;
        const dist = getDistance(
          buyerPoint.lat,
          buyerPoint.lng,
          sellerPt.lat,
          sellerPt.lng
        );
        if (dist > MAX_KM) return null;
        const name = (seller.shopName || seller.name || "").toLowerCase();
        if (q && !name.includes(q)) return null;
        return { seller, km: dist };
      })
      .filter(Boolean)
      .sort((a, b) => a.km - b.km);
  }, [user, sellers, buyerPoint, search]);

  if (!user || user.location == null || buyerPoint == null) {
    return (
      <Card className="nb-card--neon">
        <p className="nb-muted">
          Set your location in{" "}
          <Link className="nb-inline-link" to={emptyLinkTo}>
            Profile
          </Link>{" "}
          to see nearby shops.
        </p>
      </Card>
    );
  }

  if (sellersLoading) {
    return <ShopGridSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <Card className="nb-card--neon">
        <p className="nb-muted">
          No shops match your search within {MAX_KM} km.
        </p>
      </Card>
    );
  }

  return (
    <ul className="nb-shop-grid">
      {rows.map(({ seller, km }) => {
        const openState = getShopOpenUiState(seller);
        const name = seller.shopName || seller.name || "Shop";
        const owner =
          seller.ownerName ||
          seller.ownerDisplayName ||
          seller.displayName ||
          "";
        const img =
          typeof seller.imageUrl === "string" ? seller.imageUrl.trim() : "";
        const deliveryOn = seller.deliveryEnabled === true;
        const ratingPh =
          typeof seller.rating === "number" && seller.rating > 0
            ? `★ ${seller.rating.toFixed(1)}`
            : "★ —";

        return (
          <li key={seller.id}>
            <Link className="nb-shop-card-link" to={`/shops/${seller.id}`}>
              <article className="nb-shop-card nb-card--neon">
                <LazyImage
                  className="nb-shop-card__media"
                  imgClassName="nb-shop-card__img"
                  src={img || null}
                  alt={name}
                  ratio="16 / 10"
                  variant="shop"
                />
                <div className="nb-shop-card__body">
                  <h2 className="nb-shop-card__title">{name}</h2>
                  {owner ? (
                    <p className="nb-shop-card__owner nb-muted">{owner}</p>
                  ) : null}
                  <div className="nb-shop-card__meta-row">
                    <span className="nb-pill nb-pill--neon">
                      {formatDistanceKm(km)}
                    </span>
                    <span
                      className={`nb-status-pill ${
                        openState === "open"
                          ? "nb-status-pill--open"
                          : openState === "closed"
                            ? "nb-status-pill--closed"
                            : "nb-status-pill--unknown"
                      }`}
                    >
                      {openState === "open"
                        ? "OPEN"
                        : openState === "closed"
                          ? "CLOSED"
                          : "CHECK HOURS"}
                    </span>
                    {deliveryOn ? <DeliveryBadge /> : null}
                    <span className="nb-rating-ph">{ratingPh}</span>
                  </div>
                  <p className="nb-shop-card__tap-hint nb-muted">
                    Tap to open menu
                  </p>
                </div>
              </article>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
