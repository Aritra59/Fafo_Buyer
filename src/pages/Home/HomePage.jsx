import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { useCart } from "../../context/CartContext";
import { subscribeAllSellers } from "../../services/sellerService";
import { searchProductsBySellerIds } from "../../services/productSearchService";
import { getDistance } from "../../utils/haversine";
import { normalizeLocation } from "../../utils/location";
import { sellerPassesDiscoveryFilters } from "../../utils/shopStatus";
import NearbyShopsSection from "../../components/NearbyShopsSection.jsx";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";

const MAX_KM = 10;

export default function HomePage() {
  const { profile: user, loading: profileLoading } = useAuthProfile();
  const { lineCount } = useCart();
  const [search, setSearch] = useState("");
  const [sellers, setSellers] = useState([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [shopErr, setShopErr] = useState("");
  const [productHits, setProductHits] = useState([]);
  const [productSearchBusy, setProductSearchBusy] = useState(false);

  const displayName = String(user?.name || "Buyer").trim();

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

  useEffect(() => {
    const q = search.trim();
    if (q.length < 2 || nearbySellerIds.length === 0) {
      setProductHits([]);
      return undefined;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setProductSearchBusy(true);
      try {
        const rows = await searchProductsBySellerIds(nearbySellerIds, q);
        if (!cancelled) setProductHits(rows);
      } catch {
        if (!cancelled) setProductHits([]);
      } finally {
        if (!cancelled) setProductSearchBusy(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [search, nearbySellerIds]);

  if (profileLoading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner label="Loading…" />
      </div>
    );
  }

  return (
    <div className="nb-page nb-home nb-page--browse">
      <header className="nb-home-header">
        <div>
          <p className="nb-kicker">Nomad</p>
          <h1 className="nb-home-title">Hi, {displayName}</h1>
        </div>
        <div className="nb-home-header__actions">
          <Link className="nb-pill-link nb-pill-link--neon" to="/profile">
            Profile
          </Link>
          <Link className="nb-pill-link nb-pill-link--neon" to="/orders">
            Orders
          </Link>
          <Link className="nb-pill-link nb-pill-link--neon" to="/cart">
            Cart{lineCount > 0 ? ` (${lineCount})` : ""}
          </Link>
        </div>
      </header>

      <label className="nb-field nb-search">
        <span className="nb-field__label">Search shops & dishes</span>
        <input
          className="nb-input nb-input--search"
          placeholder="Try “biryani” or a shop name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </label>

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">
          Nearby shops
        </h2>
        {shopErr ? <p className="nb-field__error">{shopErr}</p> : null}
        <NearbyShopsSection
          user={user}
          search={search}
          sellersLoading={sellersLoading}
          sellers={sellers}
        />
      </section>

      {search.trim().length >= 2 ? (
        <section className="nb-section">
          <h2 className="nb-section-title nb-section-title--neon">
            Dishes matching “{search.trim()}”
          </h2>
          {productSearchBusy ? (
            <p className="nb-muted">Searching menu items…</p>
          ) : productHits.length === 0 ? (
            <Card className="nb-card--neon">
              <p className="nb-muted">No menu hits in your area yet.</p>
            </Card>
          ) : (
            <ul className="nb-search-hit-list">
              {productHits.map((p) => (
                <li key={p.id}>
                  <Link
                    className="nb-search-hit nb-card--neon"
                    to={`/shops/${p.sellerId}`}
                  >
                    <span className="nb-search-hit__name">{p.name || "Item"}</span>
                    <span className="nb-search-hit__meta nb-muted">
                      Open shop menu
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">More apps</h2>
        <div className="nb-app-grid nb-app-grid--home">
          <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/shops">
            <span className="nb-app-tile__name">FaFo list</span>
            <span className="nb-app-tile__meta">Full-screen shop list</span>
          </Link>
          <div
            className="nb-app-tile nb-app-tile--disabled nb-card--neon"
            aria-disabled="true"
          >
            <span className="nb-app-tile__name">Groceries</span>
            <span className="nb-app-tile__meta">Soon</span>
          </div>
          <div
            className="nb-app-tile nb-app-tile--disabled nb-card--neon"
            aria-disabled="true"
          >
            <span className="nb-app-tile__name">Pharma</span>
            <span className="nb-app-tile__meta">Soon</span>
          </div>
          <div
            className="nb-app-tile nb-app-tile--disabled nb-card--neon"
            aria-disabled="true"
          >
            <span className="nb-app-tile__name">Rides</span>
            <span className="nb-app-tile__meta">Soon</span>
          </div>
        </div>
      </section>

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">Promotions</h2>
        <Card className="nb-ad-placeholder nb-card--neon">
          <p className="nb-muted">Local offers will show here.</p>
        </Card>
      </section>
    </div>
  );
}
