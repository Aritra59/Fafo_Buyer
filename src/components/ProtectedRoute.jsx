import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthProfile } from "../context/AuthProfileContext";
import { Spinner } from "./ui/Spinner";

export function RequireAuth() {
  const { user, loading } = useAuthProfile();
  const location = useLocation();

  if (loading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RequireProfile() {
  const { user, profileComplete, loading } = useAuthProfile();
  const location = useLocation();

  if (loading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!profileComplete) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
