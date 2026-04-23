import { useEffect, useRef, useState } from "react";
import { AD_PLACEMENTS, subscribeAdsByPlacement } from "../services/adService";
import { LazyImage } from "./ui/LazyImage";

/**
 * @param {string} url
 */
function adTargetUrl(a) {
  return String(a.ctaLink || a.linkUrl || a.href || "").trim();
}

/**
 * Full-width swipeable ad rail for `/shop/:code` — `placement: buyer_storefront` in Firestore
 * @param {{ autoPlayMs?: number }} p
 */
export default function StorefrontAdRail({ autoPlayMs = 0 }) {
  const [ads, setAds] = useState(/** @type {import('../services/adService').BuyerAd[]} */ ([]));
  const trackRef = useRef(/** @type {HTMLDivElement | null} */(null));
  const [i, setI] = useState(0);

  useEffect(() => {
    return subscribeAdsByPlacement(
      AD_PLACEMENTS.BUYER_STOREFRONT,
      (list) => {
        setAds(list);
      },
      () => setAds([])
    );
  }, []);

  const count = ads.length;

  useEffect(() => {
    if (autoPlayMs <= 0 || count <= 1) return undefined;
    const t = window.setInterval(() => {
      setI((n) => {
        const next = (n + 1) % count;
        const el = trackRef.current;
        if (el) {
          const w = el.clientWidth;
          el.scrollTo({ left: next * w, behavior: "smooth" });
        }
        return next;
      });
    }, autoPlayMs);
    return () => window.clearInterval(t);
  }, [autoPlayMs, count]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || count === 0) return undefined;
    const onScroll = () => {
      const w = el.clientWidth || 1;
      const idx = Math.round(el.scrollLeft / w);
      setI(Math.max(0, Math.min(count - 1, idx)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [count]);

  if (count === 0) return null;

  return (
    <div className="sf-ads" role="region" aria-label="Promotional banners" data-count={count}>
      <div
        className="sf-ads__track"
        ref={trackRef}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
            e.preventDefault();
            const el = trackRef.current;
            if (!el) return;
            const w = el.clientWidth;
            const d = e.key === "ArrowRight" ? 1 : -1;
            el.scrollBy({ left: d * w, behavior: "smooth" });
          }
        }}
      >
        {ads.map((a) => {
          const href = adTargetUrl(a);
          const img = a.imageUrl && String(a.imageUrl).trim();
          const title = a.title && String(a.title).trim() ? String(a.title).trim() : "Offer";
          const sub = a.subtitle && String(a.subtitle).trim() ? String(a.subtitle).trim() : "";
          const bg = a.background && String(a.background).trim() ? String(a.background).trim() : "";
          const content = (
            <div
              className="sf-ads__slide"
              style={
                !img && bg
                  ? {
                      minHeight: 120,
                      borderRadius: 16,
                      padding: "1rem 1.1rem",
                      background: bg,
                    }
                  : undefined
              }
            >
              {img ? (
                <div className="sf-ads__media">
                  <LazyImage
                    className="sf-ads__lazy"
                    imgClassName="sf-ads__img"
                    src={img}
                    alt=""
                    ratio="2.4 / 1"
                    variant="shop"
                  />
                </div>
              ) : null}
              <div className="sf-ads__copy">
                <p className="sf-ads__title">{title}</p>
                {sub ? <p className="sf-ads__sub">{sub}</p> : null}
                {href ? <span className="sf-ads__cta">Tap to open</span> : null}
              </div>
            </div>
          );
          return (
            <div className="sf-ads__cell" key={a.id}>
              {href ? (
                <a
                  href={href}
                  className="sf-ads__link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="visually-hidden">Promotion: {title}. Opens in new tab.</span>
                  {content}
                </a>
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>
      {count > 1 ? (
        <div className="sf-ads__dots" aria-hidden>
          {ads.map((a, j) => (
            <span
              key={a.id}
              className={`sf-ads__dot${j === i ? " sf-ads__dot--on" : ""}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
