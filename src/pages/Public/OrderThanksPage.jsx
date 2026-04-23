import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { openWhatsAppOrder } from "../../utils/whatsapp";

/**
 * @typedef {{ orderId?: string, sellerName?: string, buyerPhone?: string, deliveryEnabled?: boolean, returnShopPath?: string, estimatedNote?: string, redirectExplore?: boolean, orderTotal?: number, paymentMode?: string, sellerPhone?: string }} ThanksState
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
  const doExp = s?.redirectExplore === true;
  const note = s?.estimatedNote || (delivery
    ? "The seller will confirm time for delivery or pickup."
    : "The seller will confirm when your order is ready for pickup.");
  const paymentMode = s?.paymentMode;
  const sellerPhone = s?.sellerPhone || "";

  useEffect(() => {
    if (!orderId || !doExp) return undefined;
    const t = window.setTimeout(() => {
      if (redirectOnce.current) return;
      redirectOnce.current = true;
      navigate("/explore", { replace: true });
    }, 2800);
    return () => window.clearTimeout(t);
  }, [orderId, doExp, navigate]);

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

  function sendPaymentProof() {
    const msg = `Hi, I placed order at ${sellerName}. Sending payment proof.`;
    try {
      openWhatsAppOrder(sellerPhone, msg);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not open WhatsApp.");
    }
  }

  return (
    <div className="nb-page nb-page--browse nb-success" style={{ maxWidth: 420, margin: "0 auto" }}>
      <Card className="nb-card--neon nb-thanks">
        <div className="nb-success__glow" aria-hidden />
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
        {doExp ? (
          <p className="nb-muted" style={{ fontSize: "0.9rem" }}>
            Opening explore in a few seconds — or tap below.
          </p>
        ) : null}
        <div className="nb-stack" style={{ marginTop: "1.25rem", gap: "0.5rem" }}>
          <Button type="button" onClick={() => navigate(trackUrl)}>
            Track order
          </Button>
          {paymentMode === "upi" && sellerPhone ? (
            <Button type="button" variant="ghost" onClick={sendPaymentProof}>
              Send UPI payment proof on WhatsApp
            </Button>
          ) : null}
          <Button type="button" onClick={() => navigate("/explore")}>
            Explore
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
