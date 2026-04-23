import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useBuyerOrders } from "../../context/BuyerOrdersContext";
import { useCart } from "../../context/CartContext";
import { getSellerById } from "../../services/sellerService";
import { formatCurrencyInr } from "../../utils/format";
import { digitsOnly } from "../../utils/format";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Spinner } from "../../components/ui/Spinner";

function statusBadgeClass(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "new") return "nb-order-badge nb-order-badge--new";
  if (s === "confirmed")
    return "nb-order-badge nb-order-badge--confirmed";
  if (s === "preparing") return "nb-order-badge nb-order-badge--preparing";
  if (s === "ready") return "nb-order-badge nb-order-badge--ready";
  if (s === "completed")
    return "nb-order-badge nb-order-badge--completed";
  if (s === "cancelled")
    return "nb-order-badge nb-order-badge--cancelled";
  return "nb-order-badge nb-order-badge--muted";
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

function openWa(phoneDigits, text) {
  const d = digitsOnly(String(phoneDigits));
  if (!d) return;
  const url = `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function orderToCartLines(order) {
  const sid = order.sellerId;
  if (!sid) return [];
  return (order.items || []).map((it, i) => ({
    id: String(it.productId || `re_${order.id}_${i}`),
    productId: it.productId || it.name,
    name: it.name || "Item",
    price: Number(it.price) || 0,
    qty: Number(it.qty) || 1,
    sellerId: sid,
    kind: it.kind || "product",
    imageUrl: "",
    prepTime: "",
    offerLabel: "",
    originalPrice: it.originalPrice,
    comboSummary: it.comboItems || "",
    notes: it.notes || "",
  }));
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const { orders, loading, error } = useBuyerOrders();
  const { replaceLines } = useCart();
  const [waBusy, setWaBusy] = useState(null);

  const sortedOrders = useMemo(() => {
    return [...orders].sort((a, b) => createdAtMs(b) - createdAtMs(a));
  }, [orders]);

  async function handleWhatsAppSeller(order) {
    const id = order.id;
    setWaBusy(id);
    try {
      let phone = order.sellerPhone;
      if (!phone && order.sellerId) {
        const seller = await getSellerById(order.sellerId);
        phone =
          seller?.phone || seller?.whatsapp || seller?.mobile || "";
      }
      const d = digitsOnly(String(phone));
      if (!d) {
        window.alert("Seller phone is not available for this order.");
        return;
      }
      openWa(d, `Hi, about my Nomad order #${String(id).slice(0, 8)}…`);
    } finally {
      setWaBusy(null);
    }
  }

  async function handleCallSeller(order) {
    let phone = order.sellerPhone;
    if (!phone && order.sellerId) {
      const seller = await getSellerById(order.sellerId);
      phone = seller?.phone || seller?.whatsapp || seller?.mobile || "";
    }
    const d = digitsOnly(String(phone));
    if (!d) {
      window.alert("Seller phone is not available.");
      return;
    }
    window.location.href = `tel:${d}`;
  }

  function handleReorder(order) {
    const lines = orderToCartLines(order);
    if (lines.length === 0) {
      window.alert("Nothing to reorder on this order.");
      return;
    }
    const ok = window.confirm(
      "Replace your current cart with this order? Items may differ from live menu prices."
    );
    if (!ok) return;
    replaceLines(lines);
    navigate("/cart");
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
          ← Home
        </Link>
        <h1 className="nb-page-title">My orders</h1>
        <p className="nb-page-desc">Live status from the shop.</p>
      </header>

      {error ? (
        <p className="nb-field__error">
          {error instanceof Error ? error.message : "Could not load orders."}
        </p>
      ) : null}

      {sortedOrders.length === 0 ? (
        <Card className="nb-card--neon">
          <p className="nb-muted">No orders yet. Place one from your cart.</p>
          <Link className="nb-inline-link" to="/explore">
            Browse shops
          </Link>
        </Card>
      ) : (
        <ul className="nb-order-list">
          {sortedOrders.map((order) => {
            const st = String(order.status || "").toLowerCase();
            const isReady = st === "ready";
            const isCancelled = st === "cancelled";
            const isPast = st === "completed" || isCancelled;
            const cancelText =
              order.cancelReason ||
              order.cancellationReason ||
              order.cancelMessage ||
              "No reason provided.";

            return (
              <li key={order.id}>
                <Card className="nb-order-card nb-card--neon">
                  <div className="nb-order-card__head">
                    <span className="nb-order-card__id">
                      {order.orderId
                        ? `Order #${String(order.orderId).slice(0, 8)}`
                        : `Order #${order.id.slice(0, 8)}`}
                    </span>
                    <span className={statusBadgeClass(order.status)}>
                      {String(order.status || "unknown")}
                    </span>
                  </div>
                  {formatCreatedAt(order) ? (
                    <p className="nb-order-card__meta">{formatCreatedAt(order)}</p>
                  ) : null}
                  {order.paymentMode ? (
                    <p className="nb-order-card__meta">
                      Payment: {String(order.paymentMode).toUpperCase()}
                    </p>
                  ) : null}

                  {isCancelled ? (
                    <p className="nb-order-cancel-reason nb-muted">
                      <strong>Cancelled:</strong> {cancelText}
                    </p>
                  ) : null}

                  {isReady ? (
                    <div className="nb-order-ready">
                      <p className="nb-order-ready__title">
                        🟢 Your order is ready
                      </p>
                      <p className="nb-muted nb-order-ready__sub">
                        Message or call the shop for pickup or delivery.
                      </p>
                      <div className="nb-order-ready__actions">
                        <Button
                          type="button"
                          className="nb-btn--primary"
                          disabled={waBusy === order.id}
                          onClick={() => handleWhatsAppSeller(order)}
                        >
                          {waBusy === order.id ? "Opening…" : "Open WhatsApp"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => handleCallSeller(order)}
                        >
                          Call seller
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <ul className="nb-order-items">
                    {(order.items || []).map((item, i) => (
                      <li key={`${order.id}-item-${i}`}>
                        {item.kind === "combo" ? "[Combo] " : ""}
                        {item.name} × {item.qty} — {formatCurrencyInr(item.price)}
                        {item.notes ? (
                          <span className="nb-order-item-note">
                            {" "}
                            ({item.notes})
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <p className="nb-order-card__total">
                    Total: <strong>{formatCurrencyInr(order.total)}</strong>
                  </p>

                  {isPast ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="nb-btn--sm"
                      onClick={() => handleReorder(order)}
                    >
                      Reorder
                    </Button>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
