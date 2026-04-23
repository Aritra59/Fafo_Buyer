import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { subscribeAllSellers } from "../../services/sellerService";
import NearbyShopsSection from "../../components/NearbyShopsSection.jsx";
import { Spinner } from "../../components/ui/Spinner";

export default function ShopsPage() {
  const { profile: user, loading: userDocLoading } = useAuthProfile();
  const [sellers, setSellers] = useState([]);
  const [sellersLoading, setSellersLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = subscribeAllSellers(
      (list) => {
        setSellers(list);
        setSellersLoading(false);
        setError("");
      },
      (err) => {
        setError(err instanceof Error ? err.message : "Failed to load shops.");
        setSellersLoading(false);
      }
    );
    return () => unsub();
  }, []);

  if (userDocLoading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner label="Loading your profile…" />
      </div>
    );
  }

  return (
    <div className="nb-page nb-page--browse">
      <header className="nb-page-header nb-page-header--row">
        <div>
          <Link className="nb-back" to="/explore">
            ← Home
          </Link>
          <h1 className="nb-page-title">FaFo shops</h1>
          <p className="nb-page-desc">
            Live, in-stock shops within 10 km — sorted by distance.
          </p>
        </div>
      </header>

      {error ? <p className="nb-field__error">{error}</p> : null}

      <NearbyShopsSection
        user={user}
        search=""
        sellersLoading={sellersLoading}
        sellers={sellers}
      />
    </div>
  );
}
