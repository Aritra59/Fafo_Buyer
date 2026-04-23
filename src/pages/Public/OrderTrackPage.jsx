import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { subscribeOrderById } from "../../services/orderService";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Spinner } from "../../components/ui/Spinner";
import { normalizeIndiaPhone } from "../../utils/format";

const STATUS_ORDER = [
  { key: "new", label: "Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
];

const STATUS_LABELS = {
  new: "Placed",
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

/**
 * @param {string} st
 */
function statusIndex(st) {
  const i = STATUS_ORDER.findIndex((x) => x.key === st);
  return i >= 0 ? i : 0;
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

  const timeline = useMemo(() => {
    const st = String(order?.status || "new").toLowerCase();
    if (st === "cancelled") {
      return { steps: STATUS_ORDER, active: -1, cancelled: true, current: st };
    }
    const active = statusIndex(st);
    return { steps: STATUS_ORDER, active, cancelled: false, current: st };
  }, [order]);

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
      <div className="nb-page nb-track" style={{ maxWidth: 420, margin: "0 auto" }}>
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
            style={{ marginTop: "0.75rem", width: "100%" }}
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
    <div className="nb-page nb-page--browse nb-track" style={{ maxWidth: 420, margin: "0 auto" }}>
      {isReady ? (
        <Card
          className="nb-card--neon nb-order-ready"
          style={{
            borderColor: "rgba(34, 197, 94, 0.45)",
            marginBottom: "1rem",
            background: "rgba(34, 197, 94, 0.1)",
          }}
        >
          <p className="nb-order-ready__title" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
            Your order is ready for pickup
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
        {order.total != null ? (
          <p className="nb-muted" style={{ marginTop: "0.4rem" }}>
            Total: ₹{Number(order.total).toFixed(0)}
          </p>
        ) : null}

        {timeline.cancelled ? (
          <p className="nb-field__error" style={{ marginTop: "1rem" }}>
            This order was cancelled.
          </p>
        ) : (
          <ol className="nb-timeline" aria-label="Order progress">
            {timeline.steps.map((step, idx) => {
              const done = idx < timeline.active;
              const current = idx === timeline.active;
              return (
                <li
                  key={step.key}
                  className={`nb-timeline__step${done ? " nb-timeline__step--done" : ""}${
                    current ? " nb-timeline__step--current" : ""
                  }`}
                >
                  <span className="nb-timeline__dot" aria-hidden />
                  <div className="nb-timeline__label">
                    <span className="nb-timeline__name">{step.label}</span>
                    {current ? (
                      <span className="nb-timeline__now">Current · {label}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="nb-muted" style={{ marginTop: "1.25rem", fontSize: "0.9rem" }}>
          Updates are live. Keep this page open to see changes.
        </p>
        <Link className="nb-inline-link" to="/" style={{ marginTop: "1rem", display: "inline-block" }}>
          Home
        </Link>
      </Card>
    </div>
  );
}
