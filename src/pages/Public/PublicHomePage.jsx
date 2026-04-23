import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { getRecentShops } from "../../utils/guestProfile";
import PwaInstallSection from "../../components/PwaInstallSection";

export default function PublicHomePage() {
  const navigate = useNavigate();
  const { user, profileComplete } = useAuthProfile();
  const [code, setCode] = useState("");
  const recent = getRecentShops();

  function goShop() {
    const c = String(code).trim();
    if (!c) return;
    navigate(`/shop/${encodeURIComponent(c.toUpperCase())}`);
  }

  return (
    <div className="nb-page nb-page--browse">
      <div className="nb-auth__brand" style={{ marginBottom: "1.25rem" }}>
        <h1 className="nb-title">FaFo — Order food</h1>
        <p className="nb-subtitle">Scan a shop QR or enter a code. No sign-up required.</p>
        <p className="nb-muted" style={{ marginTop: "0.4rem" }}>
          <Link className="nb-inline-link" to="/explore">
            Explore
          </Link>
          <span> — offers, nearby shops, track orders</span>
        </p>
        <p className="nb-muted" style={{ marginTop: "0.35rem" }}>
          <Link className="nb-inline-link" to="/dashboard">
            My dashboard
          </Link>
          <span> — live orders &amp; recents</span>
        </p>
        {user && profileComplete ? (
          <p className="nb-muted" style={{ marginTop: "0.5rem" }}>
            <Link className="nb-inline-link" to="/orders">
              My orders
            </Link>
          </p>
        ) : user ? (
          <p className="nb-muted" style={{ marginTop: "0.5rem" }}>
            <Link className="nb-inline-link" to="/login">
              Sign in
            </Link>{" "}
            for full account features, or order as a guest.
          </p>
        ) : null}
      </div>

      <Card className="nb-card--neon" style={{ marginBottom: "1rem" }}>
        <h2 className="nb-section-title nb-section-title--neon" style={{ marginTop: 0 }}>
          Enter shop code
        </h2>
        <div className="nb-stack" style={{ gap: "0.75rem" }}>
          <Input
            label="Shop code"
            name="shopCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. FAFO4832"
            autoComplete="off"
            inputMode="text"
          />
          <Button type="button" onClick={goShop} disabled={!String(code).trim()}>
            Open menu
          </Button>
        </div>
        <PwaInstallSection />
      </Card>

      <section className="nb-section">
        <h2 className="nb-section-title nb-section-title--neon">Scan QR</h2>
        <p className="nb-muted" style={{ margin: "0 0 0.5rem" }}>
          Point your camera at the shop&apos;s FaFo QR — it will open the menu in your browser
          (e.g. <code className="nb-code">/shop/…</code> or <code className="nb-code">/s/…</code>).
        </p>
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
                      {String(r.name || "Shop")}{" "}
                      {r.code ? <span className="nb-muted">· {r.code}</span> : null}
                    </Link>
                  ) : (
                    <span className="nb-recent-shops__link nb-card--neon nb-recent-shops__nolink">
                      {String(r.name || "Shop")}{" "}
                      <span className="nb-muted">(open from QR again)</span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
