import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { saveUserProfile } from "../../services/userService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";

const MapLocationPicker = lazy(() =>
  import("../../components/MapLocationPicker.jsx")
);

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuthProfile();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    if (profile.name) setName(String(profile.name));
    if (profile.address) setAddress(String(profile.address));
    if (profile.email) setEmail(String(profile.email));
    else if (user?.email) setEmail(String(user.email));
    if (
      profile.location &&
      typeof profile.location.lat === "number" &&
      typeof profile.location.lng === "number"
    ) {
      setLocation({
        lat: profile.location.lat,
        lng: profile.location.lng,
      });
    }
  }, [profile, user?.email]);

  function handleLocationChange({ lat, lng, address: addr }) {
    setLocation({ lat, lng });
    if (addr && String(addr).trim()) {
      setAddress(String(addr));
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");
    const n = name.trim();
    const a = address.trim();
    if (!n) {
      setError("Please enter your name.");
      return;
    }
    if (!a) {
      setError("Please enter your address.");
      return;
    }
    if (
      !location ||
      typeof location.lat !== "number" ||
      typeof location.lng !== "number"
    ) {
      setError("Pick a location on the map or from search.");
      return;
    }
    const phone = user?.phoneNumber || "";
    if (!phone || !user?.uid) {
      setError("Session error. Please sign in again.");
      return;
    }

    setSaving(true);
    try {
      await saveUserProfile(user.uid, {
        phone,
        name: n,
        address: a,
        location: { lat: location.lat, lng: location.lng },
        email: email.trim() || user.email || "",
      });
      navigate("/explore", { replace: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await signOut(auth);
    navigate("/login", { replace: true });
  }

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner label="Loading profile…" />
      </div>
    );
  }

  const phoneDisplay = user.phoneNumber || "—";

  return (
    <div className="nb-page nb-page--browse nb-profile">
      <header className="nb-page-header">
        <Link className="nb-back" to="/explore">
          <ArrowLeft size={16} strokeWidth={2} aria-hidden />
          Home
        </Link>
        <h1 className="nb-page-title">Profile</h1>
        <p className="nb-page-desc">
          Update your details and delivery location.
        </p>
      </header>

      <form onSubmit={handleSave} className="nb-stack nb-stack--lg">
        <Card className="nb-card--neon">
          <Input
            label="Your name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div className="nb-field">
            <span className="nb-field__label">Phone</span>
            <p className="nb-profile__phone">{phoneDisplay}</p>
            <p className="nb-hint nb-hint--muted">
              Phone comes from your login (OTP) or onboarding (Google).
            </p>
          </div>
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Delivery address"
            name="address"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Flat, street, area, landmark"
          />
        </Card>

        <Card className="nb-card--neon">
          <h2 className="nb-section-title nb-section-title--neon">
            Change location
          </h2>
          <p className="nb-muted nb-profile__map-intro">
            Search a place, tap the map, or drag the pin — then save.
          </p>
          <Suspense
            fallback={
              <div className="nb-page nb-page--center" style={{ minHeight: 280 }}>
                <Spinner label="Loading map…" />
              </div>
            }
          >
            <MapLocationPicker
              value={location}
              address={address}
              onChange={handleLocationChange}
            />
          </Suspense>
        </Card>

        {error ? <p className="nb-field__error">{error}</p> : null}

        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save profile"}
        </Button>

        <Button type="button" variant="ghost" onClick={handleLogout}>
          Log out
        </Button>
      </form>
    </div>
  );
}
