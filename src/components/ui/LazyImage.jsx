import { useEffect, useId, useState } from "react";

function ShopPlaceholder({ gid }) {
  return (
    <svg
      className="nb-lazy-img__ph-svg"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="64" height="64" rx="12" fill={`url(#${gid}-shop)`} />
      <path
        d="M20 38V26h6l4-6h4l4 6h6v12H20z"
        stroke="rgba(45,226,230,0.45)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="32" cy="30" r="3" fill="rgba(176,38,255,0.5)" />
      <defs>
        <linearGradient id={`${gid}-shop`} x1="0" y1="0" x2="64" y2="64">
          <stop stopColor="#1a2433" />
          <stop offset="1" stopColor="#121a24" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function FoodPlaceholder({ gid }) {
  return (
    <svg
      className="nb-lazy-img__ph-svg"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect width="64" height="64" rx="12" fill={`url(#${gid}-food)`} />
      <ellipse cx="32" cy="36" rx="18" ry="10" stroke="rgba(45,226,230,0.4)" strokeWidth="2" />
      <path
        d="M24 28c2-6 14-6 16 0"
        stroke="rgba(176,38,255,0.45)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={`${gid}-food`} x1="0" y1="0" x2="64" y2="64">
          <stop stopColor="#1c2632" />
          <stop offset="1" stopColor="#101820" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * @param {{
 *   src?: string | null,
 *   alt: string,
 *   className?: string,
 *   imgClassName?: string,
 *   ratio?: string,
 *   variant?: "shop" | "food",
 * }} props
 */
export function LazyImage({
  src,
  alt,
  className = "",
  imgClassName = "",
  ratio = "4 / 3",
  variant = "food",
}) {
  const rawId = useId().replace(/:/g, "");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  const trimmed = typeof src === "string" ? src.trim() : "";
  const hasSrc = Boolean(trimmed);
  const showPlaceholder = !hasSrc || error;
  const showSkeleton = hasSrc && !error && !loaded;

  return (
    <div
      className={`nb-lazy-img ${className}`.trim()}
      style={{ aspectRatio: ratio }}
    >
      {showSkeleton ? <div className="nb-lazy-img__skeleton" aria-hidden /> : null}
      {hasSrc && !error ? (
        <img
          className={`nb-lazy-img__img ${loaded ? "nb-lazy-img__img--visible" : ""} ${imgClassName}`.trim()}
          src={trimmed}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      ) : null}
      {showPlaceholder ? (
        <div className="nb-lazy-img__placeholder" aria-hidden>
          {variant === "shop" ? (
            <ShopPlaceholder gid={rawId} />
          ) : (
            <FoodPlaceholder gid={rawId} />
          )}
        </div>
      ) : null}
    </div>
  );
}
