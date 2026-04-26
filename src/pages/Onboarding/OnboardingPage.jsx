import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthProfile } from "../../context/AuthProfileContext";
import { saveUserProfile } from "../../services/userService";
import { normalizeIndiaPhone } from "../../utils/format";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";

const MapLocationPicker = lazy(() =>
  import("../../components/MapLocationPicker.jsx")
);

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, profile, loading, profileComplete } = useAuthProfile();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState(null);
  const [phoneInput, setPhoneInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile) return;
    if (profile.name) setName(String(profile.name));
    if (profile.address) setAddress(String(profile.address));
    if (profile.phone) setPhoneInput(String(profile.phone));
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
  }, [profile]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="nb-page nb-page--center">
        <Spinner />
      </div>
    );
  }

  if (profileComplete) {
    return <Navigate to="/explore" replace />;
  }

  function handleLocationChange({ lat, lng, address: addr }) {
    setLocation({ lat, lng });
    if (addr && String(addr).trim()) {
      setAddress(String(addr));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const n = name.trim();
    const a = address.trim();
    if (!n) {
      setError("Please enter your name.");
      return;
    }
    if (!a) {
      setError("Please enter or select an address.");
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

    const phone =
      user.phoneNumber || normalizeIndiaPhone(phoneInput) || phoneInput.trim();
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      setError("Enter a valid 10-digit mobile number for order updates.");
      return;
    }

    setSaving(true);
    try {
      await saveUserProfile(user.uid, {
        phone: normalizeIndiaPhone(phoneInput) || user.phoneNumber || phoneInput.trim(),
        name: n,
        address: a,
        location: { lat: location.lat, lng: location.lng },
        email: user.email || "",
      });
      navigate("/explore", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  const showPhoneField = !user.phoneNumber;

  return (
    <div className="nb-page nb-onboarding">
      <header className="nb-page-header">
        <h1 className="nb-page-title">Welcome</h1>
        <p className="nb-page-desc">
          Tell us your name and where you are so we can show nearby shops.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="nb-stack nb-stack--lg">
        <Card className="nb-card--neon">
          <Input
            label="Your name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {showPhoneField ? (
            <Input
              label="Mobile number"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="9876543210"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
            />
          ) : null}
          <Input
            label="Address"
            name="address"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Flat, street, area"
          />
        </Card>

        <Card className="nb-card--neon">
          <h2 className="nb-section-title nb-section-title--neon">Location</h2>
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
          {saving ? "Saving…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}
