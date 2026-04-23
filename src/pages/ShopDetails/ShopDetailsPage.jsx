import { Link, useParams } from "react-router-dom";
import ShopCatalogView from "../../components/shop/ShopCatalogView";

export default function ShopDetailsPage() {
  const { sellerId } = useParams();
  if (!sellerId) {
    return (
      <div className="nb-page">
        <p className="nb-field__error">Missing shop.</p>
        <Link className="nb-inline-link" to="/shops">
          Back to shops
        </Link>
      </div>
    );
  }
  return (
    <ShopCatalogView
      sellerId={sellerId}
      backTo="/shops"
      backLabel="Shops"
    />
  );
}
