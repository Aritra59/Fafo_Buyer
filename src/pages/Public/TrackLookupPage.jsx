import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchLatestOrderByPhone } from "../../services/orderService";
import { normalizeIndiaPhone } from "../../utils/format";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

/**
 * Find the latest order for a phone (guest) and go to live tracking.
 */
export default function TrackLookupPage() {
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="nb-page" style={{ maxWidth: 420, margin: "0 auto" }}>
      <header className="nb-page-header">
        <h1 className="nb-page-title">Track your order</h1>
        <p className="nb-page-desc nb-muted">
          Enter the phone number you used for your last order. We will open the latest order status for you.
        </p>
      </header>
      <Card className="nb-card--neon">
        {err ? <p className="nb-field__error">{err}</p> : null}
        <Input
          label="Phone number"
          name="track-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="+91 or 10-digit"
        />
        <Button
          type="button"
          style={{ marginTop: "0.9rem", width: "100%" }}
          disabled={busy}
          onClick={async () => {
            setErr("");
            const p = normalizeIndiaPhone(phone) || phone.trim();
            if (!p) {
              setErr("Enter a valid phone number.");
              return;
            }
            setBusy(true);
            try {
              const o = await fetchLatestOrderByPhone(p);
              if (!o || !o.id) {
                setErr("No order found for this number. Check the number or use the full link from SMS.");
                return;
              }
              navigate(
                `/order/${encodeURIComponent(o.id)}/track?phone=${encodeURIComponent(p)}`,
                { replace: true }
              );
            } catch (e) {
              setErr(e instanceof Error ? e.message : "Could not look up the order.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Looking up…" : "Track latest order"}
        </Button>
        <Link
          to="/"
          className="nb-inline-link"
          style={{ display: "inline-block", marginTop: "1rem" }}
        >
          ← Home
        </Link>
        <Link
          to="/explore"
          className="nb-inline-link"
          style={{ display: "inline-block", marginTop: "0.5rem" }}
        >
          Explore
        </Link>
      </Card>
    </div>
  );
}
