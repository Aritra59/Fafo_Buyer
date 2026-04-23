import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSellerByShopCode, getSellerByShopSlug } from "../../services/sellerService";
import ShopCatalogView from "../../components/shop/ShopCatalogView";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import {
  addRecentShop,
  ORDER_SOURCE_PUBLIC_LINK,
  setOrderSourceSession,
} from "../../utils/guestProfile";
import "../../styles/buyerShop.css";

function normalizeSegment(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s.replace(/^\/+|\/+$/g, "");
}

function PublicShopPageSkeleton() {
  return (
    <div className="bs-public-sk" aria-busy="true" aria-label="Loading shop">
      <div className="bs-public-sk__hero">
        <div className="bs-public-sk__banner" />
        <div className="bs-public-sk__row">
          <div className="bs-public-sk__logo" />
          <div className="bs-public-sk__text">
            <div className="bs-public-sk__title" />
            <div className="bs-public-sk__meta" />
          </div>
        </div>
      </div>
      <ul className="bs-pgrid bs-pgrid--skeleton" aria-hidden>
        {[1, 2, 3, 4, 5, 6].map((k) => (
          <li key={k} className="bs-sk-card">
            <div className="bs-sk-card__img" />
            <div className="bs-sk-card__body">
              <div className="bs-sk-line" />
              <div className="bs-sk-line bs-sk-line--sm" />
              <div className="bs-sk-line bs-sk-line--btn" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PublicShopPage() {
  const { shopCode: shopCodeParam, shopSlug: shopSlugParam } = useParams();
  const shopCode = normalizeSegment(shopCodeParam);
  const shopSlug = normalizeSegment(shopSlugParam);

  const [sellerId, setSellerId] = useState(/** @type {string | null} */ (null));
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    document.title = "FaFo — Shop";
    return () => {
      document.title = "FaFo — Order food";
    };
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setLoadError("");
      setSellerId(null);
      try {
        const seller = shopCode
          ? await getSellerByShopCode(shopCode)
          : await getSellerByShopSlug(shopSlug);
        if (cancel) return;
        if (!seller?.id) {
          setNotFound(true);
          document.title = "Shop not found — FaFo";
          setLoading(false);
          return;
        }
        document.title = `${String(seller.shopName || seller.name || "Shop")} — FaFo`;
        setOrderSourceSession(ORDER_SOURCE_PUBLIC_LINK);
        setSellerId(seller.id);
        addRecentShop({
          id: seller.id,
          name: String(seller.shopName || seller.name || "Shop"),
          code: String(seller.shopCode || shopCode || ""),
          slug: String(seller.shopSlug || seller.slug || shopSlug || ""),
        });
        setLoading(false);
      } catch (e) {
        if (!cancel) {
          const msg =
            e instanceof Error ? e.message : "Something went wrong. Please try again.";
          setLoadError(msg);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [shopCode, shopSlug, retryToken]);

  if (loading) {
    return (
      <div className="nb-page">
        <PublicShopPageSkeleton />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="nb-page">
        <Card className="nb-card--neon">
          <h1 className="nb-section-title" style={{ marginTop: 0 }}>
            Couldn&apos;t load shop
          </h1>
          <p className="nb-field__error">{loadError}</p>
          <div className="nb-stack" style={{ gap: "0.75rem", marginTop: "1rem" }}>
            <Button type="button" onClick={() => setRetryToken((n) => n + 1)}>
              Retry
            </Button>
            <Link className="nb-inline-link" to="/">
              Back to home
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (notFound || !sellerId) {
    return (
      <div className="nb-page">
        <Card className="nb-card--neon">
          <h1 className="nb-section-title" style={{ marginTop: 0 }}>
            Shop not found
          </h1>
          <p className="nb-muted">
            We could not find a shop for this code or link. Check for a typo, or scan the QR
            again.
          </p>
          <Link className="nb-inline-link" to="/" style={{ display: "inline-block", marginTop: "1rem" }}>
            Back to home
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="bs-public-shop">
      <ShopCatalogView sellerId={sellerId} backTo="/" backLabel="Home" isPublic />
    </div>
  );
}
