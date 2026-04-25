import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Compass } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

/**
 * @typedef {{ orderId?: string, sellerName?: string, buyerPhone?: string, deliveryEnabled?: boolean, returnShopPath?: string, estimatedNote?: string, redirectExplore?: boolean, orderTotal?: number, paymentMode?: string, sellerPhone?: string }} ThanksState
 */

const EXPLORE_REDIRECT_MS = 4200;

export default function OrderThanksPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  /** @type {ThanksState | null} */
  const s = state && typeof state === "object" ? state : null;
  const orderId = s?.orderId;
  const sellerName = s?.sellerName || "The shop";
  const delivery = s?.deliveryEnabled === true;
  const note =
    s?.estimatedNote ||
    (delivery
      ? "The seller will confirm time for delivery or pickup."
      : "The seller will confirm when your order is ready for pickup.");

  useEffect(() => {
    if (!orderId) return undefined;
    const t = window.setTimeout(() => {
      navigate("/explore", { replace: true });
    }, EXPLORE_REDIRECT_MS);
    return () => window.clearTimeout(t);
  }, [orderId, navigate]);

  if (!orderId) {
    return (
      <div className="nb-page nb-page--browse nb-thanks-page">
        <Card className="nb-card nb-thanks nb-thanks--minimal">
          <p className="nb-muted">No order details here.</p>
          <Button type="button" className="nb-thanks__explore" onClick={() => navigate("/explore", { replace: true })}>
            <Compass size={18} aria-hidden />
            Back to Explore
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="nb-page nb-page--browse nb-success nb-thanks-page" style={{ maxWidth: 440, margin: "0 auto" }}>
      <Card className="nb-card nb-thanks nb-thanks--minimal">
        <div className="nb-thanks__icon-wrap" aria-hidden>
          <CheckCircle2 size={40} strokeWidth={1.35} className="nb-thanks__icon" />
        </div>
        <h1 className="nb-thanks__title">Thank you</h1>
        <p className="nb-thanks__subtitle">Your order was received.</p>
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
        <p className="nb-thanks__hint nb-muted">Taking you to Explore in a few seconds…</p>
        <div className="nb-thanks__actions">
          <Button type="button" className="nb-thanks__explore" onClick={() => navigate("/explore", { replace: true })}>
            <Compass size={18} aria-hidden />
            Back to Explore
          </Button>
        </div>
      </Card>
    </div>
  );
}
