import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useBuyerOrders } from "../../context/BuyerOrdersContext";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";

function statusBadgeClass(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "new") return "nb-order-badge nb-order-badge--new";
  if (s === "confirmed") return "nb-order-badge nb-order-badge--confirmed";
  if (s === "preparing") return "nb-order-badge nb-order-badge--preparing";
  if (s === "ready") return "nb-order-badge nb-order-badge--ready";
  if (s === "completed") return "nb-order-badge nb-order-badge--completed";
  if (s === "cancelled") return "nb-order-badge nb-order-badge--cancelled";
  return "nb-order-badge nb-order-badge--muted";
}

function statusLabel(statusRaw) {
  const s = String(statusRaw || "new").toLowerCase();
  const labels = {
    new: "Placed",
    confirmed: "Confirmed",
    preparing: "Preparing",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return labels[s] || s;
}

function createdAtMs(data) {
  const c = data?.createdAt;
  if (c && typeof c.toDate === "function") {
    try {
      return c.toDate().getTime();
    } catch {
      return 0;
    }
  }
  return 0;
}

function formatCreatedAt(data) {
  const c = data?.createdAt;
  if (c && typeof c.toDate === "function") {
    try {
      return c.toDate().toLocaleString();
    } catch {
      return "";
    }
  }
  return "";
}

export default function TrackOrdersListPage() {
  const navigate = useNavigate();
  const { orders, loading, error } = useBuyerOrders();

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => createdAtMs(b) - createdAtMs(a));
  }, [orders]);

  function openOrderTrack(order) {
    const p = String(order.buyerPhone || "");
    const phoneQ = p ? `?phone=${encodeURIComponent(p)}` : "";
    navigate(`/order/${encodeURIComponent(order.id)}/track${phoneQ}`);
  }

  if (loading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner label="Loading orders…" />
      </div>
    );
  }

  return (
    <div className="nb-page nb-page--browse">
      <header className="nb-page-header">
        <Link className="nb-back" to="/explore">
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          Explore
        </Link>
        <h1 className="nb-page-title">Track orders</h1>
        <p className="nb-page-desc nb-muted">
          Tap an order to see live status and updates from the shop.
        </p>
      </header>

      {error ? (
        <p className="nb-field__error">
          {error instanceof Error ? error.message : "Could not load orders."}
        </p>
      ) : null}

      {sortedOrders.length === 0 ? (
        <Card className="nb-card--neon">
          <p className="nb-muted">No orders yet. Place one from your cart, then return here to track it.</p>
          <Link className="nb-inline-link" to="/explore" style={{ display: "inline-block", marginTop: "0.75rem" }}>
            Back to Explore
          </Link>
        </Card>
      ) : (
        <ul className="nb-order-list" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {sortedOrders.map((order) => {
            const st = String(order.status || "new");
            const orderLabel = order.orderId
              ? String(order.orderId)
              : `Order ${order.id.slice(0, 8)}`;
            return (
              <li key={order.id} style={{ marginBottom: "0.65rem" }}>
                <button
                  type="button"
                  className="nb-track-order-card"
                  onClick={() => openOrderTrack(order)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    background: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <Card className="nb-order-card nb-card--neon">
                    <div className="nb-order-card__head">
                      <span className="nb-order-card__id">{orderLabel}</span>
                      <span className={statusBadgeClass(st)}>{statusLabel(st)}</span>
                    </div>
                    <p className="nb-order-card__name" style={{ margin: "0.35rem 0 0", fontWeight: 600 }}>
                      {String(order.sellerName || "Order")}
                    </p>
                    {formatCreatedAt(order) ? (
                      <p className="nb-order-card__meta nb-muted">{formatCreatedAt(order)}</p>
                    ) : null}
                    <p className="nb-order-card__meta nb-muted">
                      Total: ₹{Number(order.total || 0).toFixed(0)}
                      {order.paymentMode
                        ? ` · ${String(order.paymentMode).toUpperCase()}`
                        : ""}
                    </p>
                    <p className="nb-muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                      Tap for full status →
                    </p>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
