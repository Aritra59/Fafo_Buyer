import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getSellerByShopCode, getSellerByShopSlug } from "../../services/sellerService";
import ShopCatalogView from "../../components/shop/ShopCatalogView";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import {
  addRecentShop,
  ORDER_SOURCE_PUBLIC_LINK,
  setOrderSourceSession,
} from "../../utils/guestProfile";

export default function PublicShopPage() {
  const { shopCode, shopSlug } = useParams();
  const [sellerId, setSellerId] = useState(/** @type {string | null} */ (null));
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr("");
      setSellerId(null);
      try {
        const seller = shopCode
          ? await getSellerByShopCode(shopCode)
          : await getSellerByShopSlug(shopSlug || "");
        if (cancel) return;
        if (!seller?.id) {
          setErr("We could not find that shop. Check the code or link.");
          setLoading(false);
          return;
        }
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
          setErr(e instanceof Error ? e.message : "Failed to load shop.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [shopCode, shopSlug]);

  if (loading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner />
        <p className="nb-muted" style={{ marginTop: "1rem" }}>
          Loading menu…
        </p>
      </div>
    );
  }

  if (err || !sellerId) {
    return (
      <div className="nb-page">
        <Card className="nb-card--neon">
          <p className="nb-field__error">{err || "Shop not found."}</p>
          <Link className="nb-inline-link" to="/">
            Back to home
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="bs-public-shop">
      <ShopCatalogView
        sellerId={sellerId}
        backTo="/"
        backLabel="Home"
        isPublic
      />
    </div>
  );
}
