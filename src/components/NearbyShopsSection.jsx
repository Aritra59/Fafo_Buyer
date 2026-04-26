import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Truck } from "lucide-react";
import { getDistance } from "../utils/haversine";
import { normalizeLocation } from "../utils/location";
import { formatDistanceKm } from "../utils/format";
import { sellerPassesDiscoveryFilters } from "../utils/shopStatus";
import { getShopOpenUiState } from "../utils/shopOpenStatus";
import { getPublicMenuPath } from "../utils/publicShopPath";
import { Card } from "./ui/Card";
import { LazyImage } from "./ui/LazyImage";

const MAX_KM = 10;
const BROWSE_CAP = 32;

/**
 * @param {Record<string, unknown>} seller
 * @param {import('firebase/auth').User | null} user
 */
function shopListPath(seller, user) {
  const p = getPublicMenuPath(seller);
  if (p) return p;
  if (user) return `/shops/${seller.id}`;
  return null;
}

function DeliveryBadge() {
  return (
    <span className="nb-delivery-badge" title="Delivery available">
      <Truck className="nb-delivery-badge__icon" size={14} strokeWidth={2} aria-hidden />
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
 *   user: { location?: unknown } | null,
 *   search: string,
 *   sellersLoading: boolean,
 *   sellers: object[],
 *   emptyLinkTo?: string,
 *   showBrowseAll?: boolean,
 * }} props
 */
export default function NearbyShopsSection({
  user,
  search,
  sellersLoading,
  sellers,
  emptyLinkTo = "/profile",
  showBrowseAll = false,
}) {
  const buyerPoint = normalizeLocation(user?.location);

  const withDistance = useMemo(() => {
    if (!user || user.location == null || buyerPoint == null) {
      return null;
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

  const browseRows = useMemo(() => {
    if (withDistance != null) return null;
    if (!showBrowseAll) return null;
    const q = String(search || "").trim().toLowerCase();
    return sellers
      .filter((seller) => sellerPassesDiscoveryFilters(seller))
      .filter((seller) => {
        if (!q) return true;
        const name = (seller.shopName || seller.name || "").toLowerCase();
        return name.includes(q);
      })
      .map((seller) => ({ seller, km: null }))
      .sort((a, b) =>
        String(a.seller.shopName || a.seller.name || "").localeCompare(
          String(b.seller.shopName || b.seller.name || ""),
          undefined,
          { sensitivity: "base" }
        )
      )
      .slice(0, BROWSE_CAP);
  }, [sellers, search, withDistance, showBrowseAll]);

  if (sellersLoading) {
    return <ShopGridSkeleton />;
  }

  if (withDistance && withDistance.length === 0) {
    return (
      <Card className="nb-card--neon">
        <p className="nb-muted">
          No shops match your search within {MAX_KM} km.
        </p>
      </Card>
    );
  }

  if (!withDistance && !browseRows?.length) {
    if (showBrowseAll) {
      return (
        <Card className="nb-card--neon">
          <p className="nb-muted">No open shops to show right now. Try a search or check back later.</p>
        </Card>
      );
    }
    return (
      <Card className="nb-card--neon">
        <p className="nb-muted">
          Set your location in{" "}
          <Link className="nb-inline-link" to={emptyLinkTo}>
            Profile
          </Link>{" "}
          to see distance-ranked shops, or use a shop code from the home screen.
        </p>
      </Card>
    );
  }

  const rows = withDistance || browseRows || [];

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
        const to = shopListPath(seller, user);
        if (!to) {
          return (
            <li key={seller.id}>
              <article
                className="nb-shop-card nb-card--neon nb-shop-card--nolink"
                aria-label={`${name} (no public link yet)`}
              >
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
                  <p className="nb-muted" style={{ marginTop: 6, fontSize: "0.85rem" }}>
                    This shop is adding a public link. Try another listing or sign in to browse the full
                    list.
                  </p>
                </div>
              </article>
            </li>
          );
        }

        return (
          <li key={seller.id}>
            <Link className="nb-shop-card-link" to={to}>
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
                    {km != null ? (
                      <span className="nb-pill nb-pill--neon">
                        {formatDistanceKm(km)}
                      </span>
                    ) : (
                      <span className="nb-pill nb-pill--dim">In your area</span>
                    )}
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
