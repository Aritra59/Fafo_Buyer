import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { useCart } from "../../context/CartContext";
import { getSellerById, subscribeSellerById } from "../../services/sellerService";
import { createOrder } from "../../services/orderService";
import {
  formatCurrencyInr,
  isValidGuestPhone,
  normalizeIndiaPhone,
} from "../../utils/format";
import { validateAndPriceOrderLines } from "../../utils/validateOrderPrices";
import { canPlaceOrderByThrottle, markOrderPlacedForThrottle } from "../../utils/orderThrottle";
import {
  getGuestProfile,
  getOrderSourceFromSession,
  getRecentShops,
  setGuestProfile,
} from "../../utils/guestProfile";
import { buildUpiPayUri, copyToClipboard, tryOpenUpiUri } from "../../utils/upi";
import { getShopOpenUiState } from "../../utils/shopOpenStatus";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { LazyImage } from "../../components/ui/LazyImage";
import "../../styles/buyerShop.css";

function shopPathForSeller(sellerId) {
  if (!sellerId) return "/";
  const recents = getRecentShops();
  const s = recents.find((r) => r && r.id === sellerId);
  if (!s) return "/";
  if (s.code) return `/shop/${encodeURIComponent(String(s.code))}`;
  if (s.slug) return `/s/${encodeURIComponent(String(s.slug))}`;
  return "/";
}

function CartQtyStepper({ line, setQty, removeLine }) {
  const q = Math.max(0, Math.floor(Number(line.qty) || 0));
  if (q <= 0) return null;
  return (
    <div className="bs-stepper bs-cart-item__stepper" role="group" aria-label="Quantity">
      <button
        type="button"
        className="bs-stepper__btn bs-stepper__btn--minus"
        onClick={() => {
          if (q <= 1) removeLine(line.id);
          else setQty(line.id, q - 1);
        }}
        aria-label="Decrease"
      >
        −
      </button>
      <span className="bs-stepper__qty">{q}</span>
      <button
        type="button"
        className="bs-stepper__btn bs-stepper__btn--plus"
        onClick={() => setQty(line.id, q + 1)}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

export default function CartPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuthProfile();
  const {
    lines,
    total,
    subtotal,
    savings,
    sellerId,
    setQty,
    setLineNote,
    removeLine,
    clear,
  } = useCart();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [paymentMode, setPaymentMode] = useState("upi");
  const [checkoutName, setCheckoutName] = useState("");
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutAddress, setCheckoutAddress] = useState("");
  const [shopOpenUi, setShopOpenUi] = useState("unknown");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [deliveryOn, setDeliveryOn] = useState(false);
  const canCheckout = shopOpenUi === "open";
  const isGuest = !user;

  const continueShoppingTo = useMemo(() => shopPathForSeller(sellerId), [sellerId]);

  useEffect(() => {
    if (user) {
      setCheckoutName(String(profile?.name || "").trim());
      setCheckoutAddress(String(profile?.address || "").trim());
      const p = user?.phoneNumber || String(profile?.phone || "").trim() || "";
      setCheckoutPhone(p);
    } else {
      const g = getGuestProfile();
      if (g) {
        setCheckoutName(g.name);
        setCheckoutPhone(g.phone);
      } else {
        setCheckoutName("");
        setCheckoutPhone("");
      }
      setCheckoutAddress("");
    }
  }, [profile, user]);

  useEffect(() => {
    if (!sellerId) {
      setShopOpenUi("unknown");
      return undefined;
    }
    const unsub = subscribeSellerById(
      sellerId,
      (docSnap) => {
        if (!docSnap) {
          setShopOpenUi("unknown");
          setDeliveryOn(false);
          return;
        }
        setShopOpenUi(getShopOpenUiState(docSnap));
        setDeliveryOn(docSnap.deliveryEnabled === true);
      },
      () => {
        setShopOpenUi("unknown");
        setDeliveryOn(false);
      }
    );
    return () => unsub();
  }, [sellerId]);

  async function handlePlaceOrder() {
    if (sending) return;
    setError("");

    if (!canCheckout) {
      setError(
        shopOpenUi === "unknown"
          ? "This shop has no valid opening hours yet — checkout is unavailable. You can still browse the menu."
          : "This shop is closed (seller setting). You can browse the menu."
      );
      return;
    }

    if (!sellerId || lines.length === 0) {
      setError("Your cart is empty.");
      return;
    }
    const name = checkoutName.trim();
    const phone = checkoutPhone.trim();
    const addr = checkoutAddress.trim();
    const isGuestUser = !user;

    if (!name || !phone) {
      setError("Please enter your name and phone.");
      return;
    }
    if (isGuestUser) {
      if (!isValidGuestPhone(phone)) {
        setError("Enter a valid 10-digit mobile number (e.g. +91…).");
        return;
      }
    } else if (!addr) {
      setError("Please fill in name, phone, and address for delivery.");
      return;
    }

    const buyerPhoneE164 = normalizeIndiaPhone(phone) || phone.trim();
    const throttle = canPlaceOrderByThrottle(buyerPhoneE164);
    if (!throttle.ok) {
      setError(
        `Please wait ${throttle.waitSec} seconds before placing another order.`
      );
      return;
    }

    setSending(true);
    try {
      const seller = await getSellerById(sellerId);
      if (!seller) {
        setError("This shop is no longer available.");
        return;
      }

      const priced = await validateAndPriceOrderLines(sellerId, lines);
      if (Math.abs(priced.total - total) > 0.5) {
        setError("Prices have changed. Please check your cart and try again.");
        return;
      }

      const sellerPhoneRaw = seller?.phone || seller?.whatsapp || seller?.mobile || "";
      const upiId = String(seller?.upiId || seller?.upi_id || "").trim();
      const upiName = String(seller?.upiName || seller?.upi_name || "").trim();
      const shopLabel = seller?.shopName || seller?.name || "Shop";
      const sellerNameOut = String(seller?.shopName || seller?.name || "Shop");
      const deliveryEnabled = seller?.deliveryEnabled === true;
      const code = String(seller?.shopCode || "").trim();
      const slug = String(seller?.shopSlug || seller?.slug || "").trim();
      const returnShopPath = code
        ? `/shop/${encodeURIComponent(code)}`
        : slug
          ? `/s/${encodeURIComponent(slug)}`
          : "/";

      if (paymentMode === "upi") {
        if (!upiId) {
          setError("This shop has no UPI on file. Pay with COD or contact the seller.");
          return;
        }
        const uri = buildUpiPayUri({
          pa: upiId,
          pn: upiName || shopLabel,
          am: priced.total,
          tn: `FaFo ${shopLabel}`,
        });
        tryOpenUpiUri(uri);
      }

      if (isGuestUser) {
        setGuestProfile({ name, phone: buyerPhoneE164 });
      }

      const orderId = await createOrder({
        sellerId,
        buyerId: user?.uid || "",
        buyerPhone: buyerPhoneE164,
        buyerName: name,
        buyerAddress: isGuestUser
          ? addr || (deliveryEnabled ? "Delivery (confirm with shop)" : "Pickup at shop")
          : addr,
        buyerGuest: isGuestUser,
        sellerName: sellerNameOut,
        sellerPhone: String(sellerPhoneRaw || ""),
        items: priced.items,
        total: priced.total,
        subtotal: priced.subtotal,
        savings: priced.savings,
        paymentMode,
        source: getOrderSourceFromSession(),
      });

      markOrderPlacedForThrottle(buyerPhoneE164);
      setCheckoutOpen(false);
      clear();
      navigate("/order/thanks", {
        state: {
          orderId,
          sellerName: sellerNameOut,
          buyerPhone: buyerPhoneE164,
          deliveryEnabled: deliveryOn,
          returnShopPath,
          redirectDashboard: true,
        },
        replace: false,
      });
    } catch (err) {
      console.error("Order failed:", err);
      setError(
        err instanceof Error ? err.message : "Could not complete order. Try again."
      );
    } finally {
      setSending(false);
    }
  }

  async function handleCopyUpi() {
    setError("");
    if (!sellerId) return;
    try {
      const seller = await getSellerById(sellerId);
      const upiId = String(seller?.upiId || seller?.upi_id || "").trim();
      if (!upiId) {
        setError("UPI ID not available for this shop.");
        return;
      }
      const ok = await copyToClipboard(upiId);
      if (ok) window.alert("UPI ID copied to clipboard.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not copy.");
    }
  }

  return (
    <div className="nb-page nb-page--browse bs-cart">
      <header className="bs-cart__header">
        <Link className="nb-back" to="/">
          ← Home
        </Link>
        <h1 className="bs-cart__title">Your cart</h1>
        <p className="bs-cart__desc">Review items, then check out in one tap.</p>
      </header>

      {error && lines.length > 0 && !checkoutOpen ? <p className="nb-field__error">{error}</p> : null}

      {lines.length === 0 ? null : !canCheckout ? (
        <p className="nb-field__error">
          {shopOpenUi === "unknown"
            ? "Checkout unavailable until this shop sets valid hours (automatic mode) or switches to open."
            : "Shop is closed — browse only. Checkout is available when the seller opens the shop or you’re inside their hours."}
        </p>
      ) : null}

      {lines.length === 0 ? (
        <div className="bs-empty" style={{ marginTop: "1.25rem" }}>
          <span className="bs-empty__icon" aria-hidden>
            🛒
          </span>
          <strong>Your cart is empty</strong>
          <div>Pick dishes from a shop, then return here to order.</div>
          <p style={{ marginTop: "1rem" }}>
            <Link className="nb-inline-link" to={continueShoppingTo === "/" ? "/" : continueShoppingTo}>
              {continueShoppingTo === "/" ? "Browse" : "Continue shopping"}
            </Link>
            {" · "}
            <Link className="nb-inline-link" to="/">
              Home
            </Link>
          </p>
        </div>
      ) : null}

      {lines.length > 0 ? (
        <>
          <ul className="bs-cart__list">
            {lines.map((l) => {
              const img = typeof l.imageUrl === "string" && l.imageUrl.trim() ? l.imageUrl.trim() : null;
              return (
                <li key={l.id} className="bs-cart-item">
                  <div className="bs-cart-item__img">
                    <LazyImage
                      className="nb-lazy-img"
                      imgClassName="bs-hero__img"
                      src={img}
                      alt={l.name || "Item"}
                      ratio="1 / 1"
                      variant="food"
                    />
                  </div>
                  <div className="bs-cart-item__main">
                    <div className="bs-cart-item__head">
                      <p className="bs-cart-item__name">
                        {l.kind === "combo" ? (
                          <span className="bs-cart-item__tag">Combo</span>
                        ) : null}
                        {l.name}
                      </p>
                    </div>
                    {l.comboSummary ? <p className="bs-cart-item__line">{l.comboSummary}</p> : null}
                    <div className="bs-cart-item__row">
                      <p className="bs-cart-item__price">
                        {l.originalPrice && Number(l.originalPrice) > Number(l.price) ? (
                          <span className="bs-cart-item__strike">{formatCurrencyInr(l.originalPrice)}</span>
                        ) : null}
                        {formatCurrencyInr(l.price)} each
                        {l.offerLabel ? (
                          <span>
                            {" "}
                            · {l.offerLabel}
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <div className="bs-cart-item__row">
                      <CartQtyStepper line={l} setQty={setQty} removeLine={removeLine} />
                      <button
                        type="button"
                        className="bs-cart-item__remove"
                        onClick={() => removeLine(l.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="bs-field-label-sm bs-cart__note">
                      <Input
                        label="Notes for kitchen"
                        name={`note-${l.id}`}
                        value={l.notes != null ? String(l.notes) : ""}
                        onChange={(e) => setLineNote(l.id, e.target.value)}
                        placeholder="No onions, extra spicy…"
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="bs-cart__summary">
            {savings > 0 ? (
              <>
                <div className="bs-cart__summary-row">
                  <span>Subtotal (MRP)</span>
                  <span>{formatCurrencyInr(subtotal)}</span>
                </div>
                <div className="bs-cart__summary-row">
                  <span style={{ color: "var(--nb-text-muted)" }}>You save</span>
                  <span style={{ color: "#4ade80" }}>−{formatCurrencyInr(savings)}</span>
                </div>
              </>
            ) : null}
            <div className="bs-cart__summary-row" style={{ fontSize: "0.85rem", color: "var(--nb-text-muted)" }}>
              <span>Taxes & fees</span>
              <span>As per shop</span>
            </div>
            <div className="bs-cart__summary-row" style={{ fontSize: "0.85rem" }}>
              <span>{deliveryOn ? "Delivery" : "Service"}</span>
              <span>
                {deliveryOn ? "Available (confirm with shop)" : "Pickup / per shop policy"}
              </span>
            </div>
            <div className="bs-cart__summary-row bs-cart__summary-row--grand">
              <span>Total</span>
              <strong>{formatCurrencyInr(total)}</strong>
            </div>

            <p className="bs-del-hint" style={canCheckout ? undefined : { marginBottom: 0 }}>
              {isGuest
                ? "Name and phone are used only to confirm the order. Saved on this device when you check out."
                : "We’ll use your account details in checkout."}
            </p>
          </div>

          <div
            className="bs-cart__actions"
            style={{ marginTop: "0.5rem" }}
            role="group"
            aria-label="Next steps"
          >
            <div className="bs-cart__actions--row" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Button
                type="button"
                onClick={() => {
                  setError("");
                  setCheckoutOpen(true);
                }}
                className="nb-sticky-cart__btn"
                style={{ width: "100%" }}
                disabled={!canCheckout}
              >
                {canCheckout ? "Place order" : "Checkout closed"}
              </Button>
              <Link
                to={continueShoppingTo}
                className="nb-btn nb-btn--ghost"
                style={{ width: "100%", textAlign: "center", display: "block" }}
              >
                Continue shopping
              </Link>
            </div>
          </div>
        </>
      ) : null}

      {checkoutOpen && lines.length > 0 ? (
        <div
          className="bs-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Checkout"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            className="bs-sheet"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setCheckoutOpen(false);
            }}
            role="document"
          >
            <div className="bs-sheet__bar" />
            <h2 className="bs-sheet__title">Checkout</h2>
            <p className="bs-sheet__hint">Confirm your contact details and payment.</p>

            {error ? <p className="nb-field__error">{error}</p> : null}

            <div className="bs-checkout-fields" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <h3 className="nb-section-title nb-section-title--neon" style={{ margin: "0.2rem 0" }}>
                {isGuest ? "Your details" : "Delivery details"}
              </h3>
              {isGuest ? (
                <p className="nb-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
                  We only use this to confirm your order. Saved on this device after a successful order.
                </p>
              ) : null}
              <Input
                label="Full name"
                name="cname"
                value={checkoutName}
                onChange={(e) => setCheckoutName(e.target.value)}
                autoComplete="name"
              />
              <Input
                label="Phone"
                name="cphone"
                value={checkoutPhone}
                onChange={(e) => setCheckoutPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
              <Input
                label={isGuest ? "Address (optional)" : "Address"}
                name="caddr"
                value={checkoutAddress}
                onChange={(e) => setCheckoutAddress(e.target.value)}
                autoComplete="street-address"
              />
            </div>

            <Card className="nb-card--neon" style={{ marginTop: "0.9rem" }}>
              <h3 className="nb-section-title nb-section-title--neon" style={{ margin: "0 0 0.4rem" }}>
                Payment
              </h3>
              <div className="nb-pay-mode" role="group" aria-label="Payment mode">
                <span className="nb-pay-mode__label">Mode</span>
                <label className="nb-pay-mode__opt">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMode === "upi"}
                    onChange={() => setPaymentMode("upi")}
                  />
                  UPI
                </label>
                <label className="nb-pay-mode__opt">
                  <input
                    type="radio"
                    name="pay"
                    checked={paymentMode === "cod"}
                    onChange={() => setPaymentMode("cod")}
                  />
                  Cash on delivery
                </label>
              </div>
              {paymentMode === "upi" ? (
                <div className="nb-pay-upi-hint" style={{ marginTop: "0.5rem" }}>
                  <p className="nb-muted nb-pay-upi-hint__text">
                    We open your UPI app with the amount. If nothing opens, copy the seller UPI ID.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="nb-btn--sm"
                    onClick={handleCopyUpi}
                  >
                    Copy seller UPI ID
                  </Button>
                </div>
              ) : null}
            </Card>

            <div
              className="bs-cart__actions"
              style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}
            >
              <Button type="button" disabled={sending} onClick={handlePlaceOrder}>
                {sending
                  ? "Placing…"
                  : paymentMode === "upi"
                    ? "Pay & place order"
                    : "Place order (COD)"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setCheckoutOpen(false)}>
                Back to cart
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
