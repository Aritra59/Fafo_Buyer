import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AD_PLACEMENTS, subscribeAdsByPlacement } from "../services/adService";
import { LazyImage } from "./ui/LazyImage";
import { Card } from "./ui/Card";
import { Spinner } from "./ui/Spinner";

/**
 * @param {string} url
 * @returns {{ type: "a" | "link", href?: string, to?: string } | null}
 */
function linkTarget(url) {
  if (!url || !String(url).trim()) return null;
  const u = String(url).trim();
  if (/^https?:\/\//i.test(u) || u.startsWith("//")) return { type: "a", href: u };
  if (u.startsWith("/") || u.startsWith(".")) return { type: "link", to: u };
  return { type: "link", to: u.startsWith("/") ? u : `/${u}` };
}

/**
 * Rotating banners for explore — Firestore `ads` with `placement: buyer_explore`
 */
export default function PromotionsCarousel() {
  const [ads, setAds] = useState(/** @type {import('../services/adService').BuyerAd[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = subscribeAdsByPlacement(
      AD_PLACEMENTS.BUYER_EXPLORE,
      (list) => {
        setAds(list);
        setLoading(false);
        setErr("");
      },
      (e) => {
        setErr(e.message || "Ads unavailable");
        setAds([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const [i, setI] = useState(0);
  const current = ads.length ? ads[Math.min(i, ads.length - 1)] : null;

  useEffect(() => {
    if (ads.length <= 1) return undefined;
    const t = window.setInterval(() => {
      setI((n) => (n + 1) % ads.length);
    }, 6000);
    return () => window.clearInterval(t);
  }, [ads.length]);

  if (loading) {
    return (
      <Card className="nb-ads nb-card--neon" aria-live="polite" aria-label="Loading promotions">
        <div className="nb-ads__state">
          <Spinner label="Loading…" />
        </div>
      </Card>
    );
  }
  if (err && ads.length === 0) {
    return null;
  }
  if (!current) {
    return null;
  }

  const link =
    (current.ctaLink && String(current.ctaLink).trim()) ||
    (current.linkUrl && String(current.linkUrl).trim()) ||
    (current.href && String(current.href).trim()) ||
    "";
  const title = current.title && String(current.title).trim() ? String(current.title).trim() : "Offer";
  const sub = current.subtitle && String(current.subtitle).trim() ? String(current.subtitle).trim() : "";
  const bg = (current.background && String(current.background).trim()) || "";

  const media = current.imageUrl && String(current.imageUrl).trim() ? String(current.imageUrl).trim() : null;

  const slide = linkTarget(link);
  const body = (
    <div
      className="nb-ads__slide"
      style={
        !media && bg
          ? { background: bg, minHeight: 140, borderRadius: 18, padding: "1rem 1.1rem" }
          : undefined
      }
    >
      {media ? (
        <div className="nb-ads__image">
          <LazyImage
            className="nb-ads__lazy"
            imgClassName="nb-ads__img"
            src={media}
            alt=""
            ratio="21 / 9"
            variant="shop"
          />
        </div>
      ) : null}
      <div className="nb-ads__copy">
        <p className="nb-ads__title">{title}</p>
        {sub ? <p className="nb-ads__sub nb-muted">{sub}</p> : null}
        {slide ? <span className="nb-ads__cta">Tap to open</span> : null}
      </div>
    </div>
  );

  const main =
    slide?.type === "a" ? (
      <a
        className="nb-ads__link"
        href={/** @type {string} */(slide.href)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {body}
      </a>
    ) : slide?.type === "link" ? (
      <Link className="nb-ads__link" to={/** @type {string} */(slide.to)}>
        {body}
      </Link>
    ) : (
    body
    );

  return (
    <div className="nb-ads nb-card nb-card--neon">
      {main}
      {ads.length > 1 ? (
        <div className="nb-ads__dots" role="tablist" aria-label="Promotion slides">
          {ads.map((a, j) => (
            <button
              key={a.id}
              type="button"
              className={`nb-ads__dot${j === i % ads.length ? " nb-ads__dot--on" : ""}`}
              aria-label={`Show promotion ${j + 1}`}
              aria-selected={j === i % ads.length}
              onClick={() => setI(j)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
