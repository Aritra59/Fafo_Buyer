import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { subscribeOrderById } from "../../services/orderService";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { normalizeIndiaPhone } from "../../utils/format";

const STATUS_LABELS = {
  new: "Received",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * @param {unknown} v
 */
function phoneKey(v) {
  return String(v || "")
    .trim()
    .replace(/\D/g, "");
}

export default function OrderTrackPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [order, setOrder] = useState(/** @type {Record<string, unknown> & { id?: string } | null} */(null));
  const [err, setErr] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  const paramPhone = search.get("phone") || "";
  const e164 = normalizeIndiaPhone(paramPhone) || paramPhone.trim();

  useEffect(() => {
    if (!orderId || !paramPhone) {
      return undefined;
    }
    const unsub = subscribeOrderById(
      orderId,
      (docSnap) => {
        if (!docSnap) {
          setOrder(null);
          setErr("Order not found.");
          return;
        }
        const docPhone = phoneKey(docSnap.buyerPhone);
        const me = phoneKey(e164);
        if (docPhone && me && docPhone !== me) {
          setOrder(null);
          setErr("Phone number does not match this order.");
          return;
        }
        setErr("");
        setOrder(docSnap);
      },
      (e) => {
        setErr(e.message || "Could not load order.");
        setOrder(null);
      }
    );
    return () => unsub();
  }, [orderId, paramPhone, e164]);

  if (!orderId) {
    return (
      <div className="nb-page">
        <p className="nb-field__error">Invalid link.</p>
        <Link className="nb-inline-link" to="/">
          Home
        </Link>
      </div>
    );
  }

  if (!paramPhone) {
    return (
      <div className="nb-page" style={{ maxWidth: 400, margin: "0 auto" }}>
        <Card className="nb-card--neon">
          <h1 className="nb-page-title" style={{ fontSize: "1.15rem" }}>
            Track order
          </h1>
          <p className="nb-muted" style={{ marginTop: "0.5rem" }}>
            Order <code className="nb-code">{orderId}</code>
          </p>
          <p className="nb-muted" style={{ marginTop: "0.75rem" }}>
            Enter the same phone number you used when ordering.
          </p>
          <Input
            label="Phone"
            name="tphone"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
            style={{ marginTop: "0.75rem" }}
          />
          <Button
            type="button"
            style={{ marginTop: "0.75rem" }}
            onClick={() => {
              const p = normalizeIndiaPhone(phoneInput) || phoneInput.trim();
              if (p) {
                navigate(
                  `/order/${encodeURIComponent(orderId)}/track?phone=${encodeURIComponent(p)}`,
                  { replace: true }
                );
              }
            }}
          >
            View status
          </Button>
          <Link className="nb-inline-link" to="/" style={{ marginTop: "1rem", display: "inline-block" }}>
            Home
          </Link>
        </Card>
      </div>
    );
  }

  if (err) {
    return (
      <div className="nb-page">
        <Card className="nb-card--neon">
          <p className="nb-field__error">{err}</p>
          <p className="nb-muted" style={{ marginTop: "0.5rem" }}>
            Add <code className="nb-code">?phone=</code> with the number you used
            to place the order, or use the full link from your confirmation.
          </p>
          <Link className="nb-inline-link" to="/" style={{ marginTop: "0.75rem", display: "inline-block" }}>
            Home
          </Link>
        </Card>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner />
        <p className="nb-muted" style={{ marginTop: "1rem" }}>
          Loading order…
        </p>
      </div>
    );
  }

  const st = String(order.status || "new");
  const label = STATUS_LABELS[st] || st;
  const isReady = st === "ready";

  return (
    <div className="nb-page nb-page--browse" style={{ maxWidth: 480, margin: "0 auto" }}>
      {isReady ? (
        <Card
          className="nb-card--neon nb-order-ready"
          style={{
            borderColor: "var(--nb-neon, #2ee6a6)",
            marginBottom: "1rem",
            background: "rgba(46, 230, 166, 0.08)",
          }}
        >
          <p className="nb-order-ready__title" style={{ margin: 0, fontSize: "1.1rem" }}>
            Pickup now — your order is ready
          </p>
        </Card>
      ) : null}
      <Card className="nb-card--neon">
        <h1 className="nb-page-title" style={{ fontSize: "1.2rem" }}>
          Order status
        </h1>
        <p className="nb-muted">Order {orderId}</p>
        {order.sellerName ? (
          <p style={{ marginTop: "0.5rem" }}>
            <strong>{String(order.sellerName)}</strong>
          </p>
        ) : null}
        <p className="nb-track-status" data-status={st} style={{ marginTop: "1rem" }}>
          <span className="nb-badge nb-badge--status">{label}</span>
        </p>
        {order.total != null ? (
          <p className="nb-muted" style={{ marginTop: "0.75rem" }}>
            Total: ₹{Number(order.total).toFixed(0)}
          </p>
        ) : null}
        <p className="nb-muted" style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
          Updates are live. Keep this page open to see changes.
        </p>
        <Link className="nb-inline-link" to="/" style={{ marginTop: "1rem", display: "inline-block" }}>
          Home
        </Link>
      </Card>
    </div>
  );
}
