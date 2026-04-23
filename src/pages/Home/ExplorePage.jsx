import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { useBuyerOrders } from "../../context/BuyerOrdersContext";
import { useCart } from "../../context/CartContext";
import { subscribeAllSellers } from "../../services/sellerService";
import { searchProductsBySellerIds } from "../../services/productSearchService";
import { getDistance } from "../../utils/haversine";
import { normalizeLocation } from "../../utils/location";
import { sellerPassesDiscoveryFilters } from "../../utils/shopStatus";
import { getPublicMenuPath } from "../../utils/publicShopPath";
import { getGuestProfile } from "../../utils/guestProfile";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import NearbyShopsSection from "../../components/NearbyShopsSection.jsx";
import PromotionsCarousel from "../../components/PromotionsCarousel.jsx";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";

const MAX_KM = 10;

export default function ExplorePage() {
  const { user, profile, loading: profileLoading } = useAuthProfile();
  const { lineCount } = useCart();
  const { orders, loading: ordersLoading } = useBuyerOrders();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 350);
  const [sellers, setSellers] = useState([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [shopErr, setShopErr] = useState("");
  const [productHits, setProductHits] = useState([]);
  const [productSearchBusy, setProductSearchBusy] = useState(false);

  const greet = useMemo(() => {
    if (user) {
      const n = String(profile?.name || "").trim();
      if (n) return n;
    }
    const g = getGuestProfile();
    const n = g?.name ? String(g.name).trim() : "";
    return n || "there";
  }, [user, profile]);

  useEffect(() => {
    const unsub = subscribeAllSellers(
      (list) => {
        setSellers(list);
        setSellersLoading(false);
        setShopErr("");
      },
      (err) => {
        setShopErr(err instanceof Error ? err.message : "Failed to load shops.");
        setSellersLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const nearbySellerIds = useMemo(() => {
    const pt = normalizeLocation(user?.location);
    if (!user?.location || !pt) return [];
    return sellers
      .filter((s) => sellerPassesDiscoveryFilters(s))
      .map((s) => {
        const sp = normalizeLocation(s?.location);
        if (!sp) return null;
        const d = getDistance(pt.lat, pt.lng, sp.lat, sp.lng);
        return d <= MAX_KM ? s.id : null;
      })
      .filter(Boolean);
  }, [user, sellers]);

  const sellerById = useMemo(() => {
    const m = new Map();
    for (const s of sellers) m.set(s.id, s);
    return m;
  }, [sellers]);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
  }, [orders]);
  const latest = sortedOrders[0];

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setProductHits([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setProductSearchBusy(true);
      try {
        const base = nearbySellerIds.length
          ? nearbySellerIds
          : sellers
              .filter((s) => sellerPassesDiscoveryFilters(s))
              .map((s) => s.id);
        const idsToSearch = base.slice(0, 30);
        if (idsToSearch.length === 0) {
          if (!cancelled) setProductHits([]);
          return;
        }
        const rows = await searchProductsBySellerIds(idsToSearch, q);
        if (!cancelled) setProductHits(rows);
      } catch {
        if (!cancelled) setProductHits([]);
      } finally {
        if (!cancelled) setProductSearchBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, nearbySellerIds, sellers]);

  if (profileLoading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner label="Loading…" />
      </div>
    );
  }

  return (
    <div className="nb-page nb-home nb-page--browse nb-explore">
      <header className="nb-home-header">
        <div>
          <p className="nb-kicker">FaFo</p>
          <h1 className="nb-home-title">Hi, {greet}</h1>
        </div>
        <div className="nb-home-header__actions">
          {user ? (
            <Link className="nb-pill-link nb-pill-link--neon" to="/profile">
              Profile
            </Link>
          ) : null}
          {user ? (
            <Link className="nb-pill-link nb-pill-link--neon" to="/orders">
              Orders
            </Link>
          ) : null}
          <Link className="nb-pill-link nb-pill-link--neon" to="/cart">
            Cart{lineCount > 0 ? ` (${lineCount})` : ""}
          </Link>
          {!user ? (
            <Link className="nb-pill-link nb-pill-link--ghost" to="/login">
              Sign in
            </Link>
          ) : null}
        </div>
      </header>

      {latest && !ordersLoading ? (
        <section className="nb-section">
          <h2 className="nb-section-title nb-section-title--neon">Latest order</h2>
          <Card className="nb-order-hero nb-card--neon">
            <p className="nb-order-hero__name">{String(latest.sellerName || "Order")}</p>
            <p className="nb-order-hero__meta nb-muted">
              {latest.id} ·{" "}
              {typeof latest.total === "number" ? `₹${Number(latest.total).toFixed(0)}` : "—"} ·{" "}
              {String(latest.status || "new")}
            </p>
            <div className="nb-order-hero__row">
              <Button
                type="button"
                onClick={() => {
                  const p = String(latest.buyerPhone || "");
                  const phoneQ = p
                    ? `?phone=${encodeURIComponent(p)}`
                    : "";
                  navigate(
                    `/order/${encodeURIComponent(latest.id)}/track${phoneQ}`
                  );
                }}
              >
                Live tracking
              </Button>
            </div>
          </Card>
        </section>
      ) : null}

      <label className="nb-field nb-search">
        <span className="nb-field__label">Search shops &amp; dishes</span>
        <input
          className="nb-input nb-input--search"
          placeholder="Try “biryani” or a shop name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </label>

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">Nearby shops</h2>
        {shopErr ? <p className="nb-field__error">{shopErr}</p> : null}
        <NearbyShopsSection
          user={user}
          search={search}
          sellersLoading={sellersLoading}
          sellers={sellers}
          showBrowseAll
        />
      </section>

      {search.trim().length >= 2 ? (
        <section className="nb-section">
          <h2 className="nb-section-title nb-section-title--neon">
            Dishes matching &ldquo;{search.trim()}&rdquo;
          </h2>
          {productSearchBusy ? (
            <p className="nb-muted">Searching menu items…</p>
          ) : productHits.length === 0 ? (
            <Card className="nb-card--neon">
              <p className="nb-muted">No menu hits in range yet. Try a different search.</p>
            </Card>
          ) : (
            <ul className="nb-search-hit-list">
              {productHits.map((p) => {
                const s = p.sellerId && sellerById.get(p.sellerId);
                const to = s ? getPublicMenuPath(s) : "/";
                return (
                  <li key={p.id}>
                    <Link className="nb-search-hit nb-card--neon" to={to}>
                      <span className="nb-search-hit__name">{p.name || "Item"}</span>
                      <span className="nb-search-hit__meta nb-muted">Open menu</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">More apps</h2>
        <div className="nb-app-grid nb-app-grid--home">
          {user ? (
            <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/shops">
              <span className="nb-app-tile__name">FaFo list</span>
              <span className="nb-app-tile__meta">Full-screen shop list</span>
            </Link>
          ) : (
            <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/">
              <span className="nb-app-tile__name">Enter shop code</span>
              <span className="nb-app-tile__meta">From QR or link</span>
            </Link>
          )}
          <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/track">
            <span className="nb-app-tile__name">Track with phone</span>
            <span className="nb-app-tile__meta">No login</span>
          </Link>
          <div
            className="nb-app-tile nb-app-tile--disabled nb-card--neon"
            aria-disabled="true"
          >
            <span className="nb-app-tile__name">Groceries</span>
            <span className="nb-app-tile__meta">Soon</span>
          </div>
        </div>
      </section>

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">Promotions</h2>
        <PromotionsCarousel />
      </section>
    </div>
  );
}
