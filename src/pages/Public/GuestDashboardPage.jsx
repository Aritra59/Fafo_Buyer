import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { useBuyerOrders } from "../../context/BuyerOrdersContext";
import { getRecentShops, getGuestProfile } from "../../utils/guestProfile";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";

/**
 * Guest + signed-in buyer home: orders, track links, recents, app shortcuts.
 */
export default function GuestDashboardPage() {
  const navigate = useNavigate();
  const { user, profileComplete, loading: authLoading } = useAuthProfile();
  const { orders, loading: ordersLoading, error: ordersError } = useBuyerOrders();
  const guest = getGuestProfile();
  const recent = getRecentShops();

  const sorted = useMemo(() => {
    return [...orders].sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() ?? 0;
      const tb = b.createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
  }, [orders]);
  const latest = sorted[0];

  if (authLoading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="nb-page nb-page--browse">
      <header className="nb-page-header">
        <h1 className="nb-page-title">My dashboard</h1>
        <p className="nb-page-desc">
          Track orders, reopen shops, and more — no sign-up required for guest ordering.
        </p>
        {user && profileComplete ? (
          <p className="nb-muted" style={{ marginTop: "0.5rem" }}>
            <Link className="nb-inline-link" to="/explore">
              Discovery & nearby
            </Link>
            {" · "}
            <Link className="nb-inline-link" to="/profile">
              Profile
            </Link>
          </p>
        ) : null}
        {!user && guest ? (
          <p className="nb-muted" style={{ marginTop: "0.5rem" }}>
            Guest: {guest.name} · {guest.phone}
          </p>
        ) : !user ? (
          <p className="nb-muted" style={{ marginTop: "0.5rem" }}>
            <Link className="nb-inline-link" to="/">
              Find a shop
            </Link>{" "}
            to order — we&apos;ll save your name and phone after the first order.
          </p>
        ) : null}
      </header>

      {ordersError ? <p className="nb-field__error">{String(ordersError?.message || ordersError)}</p> : null}

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">My orders</h2>
        {ordersLoading ? <p className="nb-muted">Loading orders…</p> : null}
        {!ordersLoading && sorted.length === 0 ? (
          <Card className="nb-card--neon">
            <p className="nb-muted">No orders yet. Open a shop from the home page and add items to your cart.</p>
            <Link to="/" className="nb-inline-link">
              Home
            </Link>
          </Card>
        ) : null}
        <ul className="nb-dashboard-orders" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sorted.map((o) => {
            const st = String(o.status || "new");
            const phoneQ = o.buyerPhone
              ? `?phone=${encodeURIComponent(String(o.buyerPhone))}`
              : "";
            return (
              <li key={o.id} style={{ marginBottom: "0.65rem" }}>
                <Card className="nb-card--neon">
                  <p style={{ margin: 0, fontWeight: 600 }}>{o.sellerName || "Order"}</p>
                  <p className="nb-muted" style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
                    {o.id} · <span data-status={st}>{st}</span> · ₹{Number(o.total || 0).toFixed(0)}
                  </p>
                  <Link
                    className="nb-inline-link"
                    to={`/order/${encodeURIComponent(o.id)}/track${phoneQ}`}
                    style={{ display: "inline-block", marginTop: "0.5rem" }}
                  >
                    Track status
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
        {latest ? (
          <div style={{ marginTop: "1rem" }}>
            <Button
              type="button"
              onClick={() => {
                const p = String(latest.buyerPhone || guest?.phone || "");
                const phoneQ = p ? `?phone=${encodeURIComponent(p)}` : "";
                navigate(`/order/${encodeURIComponent(latest.id)}/track${phoneQ}`);
              }}
            >
              Open latest order live
            </Button>
          </div>
        ) : null}
      </section>

      {recent.length > 0 ? (
        <section className="nb-section">
          <h2 className="nb-section-title nb-section-title--neon">Recent shops</h2>
          <ul className="nb-recent-shops">
            {recent.map((r) => {
              const to = r.code
                ? `/shop/${encodeURIComponent(String(r.code))}`
                : r.slug
                  ? `/s/${encodeURIComponent(String(r.slug))}`
                  : null;
              return (
                <li key={r.id}>
                  {to ? (
                    <Link className="nb-recent-shops__link nb-card--neon" to={to}>
                      {String(r.name || "Shop")}
                      {r.code ? <span className="nb-muted"> · {r.code}</span> : null}
                    </Link>
                  ) : (
                    <span className="nb-recent-shops__link nb-card--neon nb-recent-shops__nolink">
                      {String(r.name || "Shop")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">More</h2>
        <div className="nb-app-grid nb-app-grid--home" style={{ marginTop: "0.5rem" }}>
          {user && profileComplete ? (
            <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/orders">
              <span className="nb-app-tile__name">Full order history</span>
              <span className="nb-app-tile__meta">Signed-in orders</span>
            </Link>
          ) : null}
          <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/">
            <span className="nb-app-tile__name">Home</span>
            <span className="nb-app-tile__meta">Enter shop code or QR</span>
          </Link>
          {user && profileComplete ? (
            <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/shops">
              <span className="nb-app-tile__name">Browse shops</span>
              <span className="nb-app-tile__meta">List view</span>
            </Link>
          ) : (
            <Link className="nb-app-tile nb-app-tile--active nb-card--neon" to="/login">
              <span className="nb-app-tile__name">Sign in</span>
              <span className="nb-app-tile__meta">Optional full account</span>
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
