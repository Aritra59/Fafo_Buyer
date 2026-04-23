import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuthProfile } from "../../context/AuthProfileContext";

/**
 * @typedef {{ orderId?: string, sellerName?: string, buyerPhone?: string, deliveryEnabled?: boolean, returnShopPath?: string, estimatedNote?: string, redirectDashboard?: boolean }} ThanksState
 */

export default function OrderThanksPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const redirectOnce = useRef(false);
  /** @type {ThanksState | null} */
  const s = state && typeof state === "object" ? state : null;
  const { user } = useAuthProfile();
  const orderId = s?.orderId;
  const sellerName = s?.sellerName || "The shop";
  const buyerPhone = s?.buyerPhone || "";
  const returnShop = s?.returnShopPath || "/";
  const delivery = s?.deliveryEnabled === true;
  const doDash = s?.redirectDashboard === true;
  const note = s?.estimatedNote || (delivery
    ? "The seller will confirm time for delivery or pickup."
    : "The seller will confirm when your order is ready for pickup.");

  useEffect(() => {
    if (!orderId || !doDash) return undefined;
    const t = window.setTimeout(() => {
      if (redirectOnce.current) return;
      redirectOnce.current = true;
      navigate("/dashboard", { replace: true });
    }, 3500);
    return () => window.clearTimeout(t);
  }, [orderId, doDash, navigate]);

  if (!orderId) {
    return (
      <div className="nb-page">
        <Card className="nb-card--neon">
          <p className="nb-muted">No order details here.</p>
          <Link className="nb-inline-link" to="/">
            Home
          </Link>
        </Card>
      </div>
    );
  }

  const trackUrl = `/order/${encodeURIComponent(orderId)}/track?phone=${encodeURIComponent(buyerPhone)}`;

  return (
    <div className="nb-page nb-page--browse" style={{ maxWidth: 480, margin: "0 auto" }}>
      <Card className="nb-card--neon nb-thanks">
        <p className="nb-thanks__emoji" aria-hidden="true">
          Thank you 🎉
        </p>
        <h1 className="nb-thanks__title">Order received</h1>
        <p className="nb-thanks__meta">
          <strong>Order ID</strong>
          <br />
          <code className="nb-code nb-thanks__order-id">{orderId}</code>
        </p>
        <p className="nb-muted">
          <strong>{sellerName}</strong>
        </p>
        <p className="nb-muted" style={{ marginTop: "0.75rem" }}>
          {note}
        </p>
        {doDash ? (
          <p className="nb-muted" style={{ fontSize: "0.9rem" }}>
            Opening your dashboard in a few seconds — or tap below.
          </p>
        ) : null}
        <div className="nb-stack" style={{ marginTop: "1.25rem", gap: "0.5rem" }}>
          <Button type="button" onClick={() => navigate(trackUrl)}>
            Track order
          </Button>
          <Button type="button" onClick={() => navigate("/dashboard")}>
            Open dashboard
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(returnShop)}>
            Back to shop
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/")}>
            {user ? "Close" : "Home"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
