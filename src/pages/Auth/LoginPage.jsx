import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase/config";
import { useAuthProfile } from "../../context/AuthProfileContext";
import {
  clearRecaptcha,
  getFirebaseAuthMessage,
  sendOtp,
  signInWithGoogle,
} from "../../services/authService";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { Spinner } from "../../components/ui/Spinner";
import { normalizeIndiaPhone } from "../../utils/format";

export default function LoginPage() {
  const navigate = useNavigate();
  const { user, loading, profileComplete } = useAuthProfile();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmationRef = useRef(null);
  const lastE164Ref = useRef(null);

  // Unmount only — do not run setupRecaptcha on mount (avoids duplicate widget + StrictMode).
  useEffect(
    () => () => {
      clearRecaptcha();
    },
    []
  );

  if (user && profileComplete) {
    return <Navigate to="/explore" replace />;
  }

  function resetPhoneFlow() {
    confirmationRef.current = null;
    lastE164Ref.current = null;
    setStep("phone");
    setOtp("");
    setError("");
  }

  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    const e164 = normalizeIndiaPhone(phone);
    if (e164.length < 8) {
      setError("Enter a valid phone number with country code (e.g. +91…).");
      return;
    }
    setBusy(true);
    try {
      confirmationRef.current = await sendOtp(e164);
      lastE164Ref.current = e164;
      setStep("otp");
    } catch (err) {
      setError(getFirebaseAuthMessage(err, "Failed to send OTP."));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    if (!confirmationRef.current) {
      setError("Request a new OTP first.");
      return;
    }
    if (otp.trim().length < 4) {
      setError("Enter the code from SMS.");
      return;
    }
    setBusy(true);
    try {
      await confirmationRef.current.confirm(otp.trim());
      navigate("/explore", { replace: true });
    } catch (err) {
      setError(getFirebaseAuthMessage(err, "Invalid or expired code."));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendOtp() {
    const e164 = lastE164Ref.current;
    if (!e164) {
      setError("Request a new code from the phone step.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      confirmationRef.current = await sendOtp(e164);
    } catch (err) {
      setError(getFirebaseAuthMessage(err, "Failed to resend OTP."));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await signInWithGoogle();
      navigate("/explore", { replace: true });
    } catch (err) {
      setError(getFirebaseAuthMessage(err, "Google sign-in failed."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut(auth);
    confirmationRef.current = null;
    resetPhoneFlow();
  }

  return (
    <div className="nb-page nb-auth">
      <div className="nb-auth__brand">
        <h1 className="nb-title">Nomad</h1>
        <p className="nb-subtitle">Buyer — sign in with phone or Google</p>
      </div>

      <Card className="nb-auth__card nb-card--neon">
        {loading ? (
          <div className="nb-page--center" style={{ minHeight: "12rem" }}>
            <Spinner />
          </div>
        ) : (
          <>
            <div className="nb-stack">
              <Button type="button" variant="ghost" disabled={busy} onClick={handleGoogle}>
                {busy ? "Please wait…" : "Continue with Google"}
              </Button>
              <p className="nb-muted nb-auth__divider">or use phone OTP</p>
            </div>

            {step === "phone" ? (
              <form onSubmit={handleSendOtp} className="nb-stack">
                <Input
                  label="Phone number"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                {error ? <p className="nb-field__error">{error}</p> : null}
                <Button type="submit" disabled={busy}>
                  {busy ? "Sending…" : "Send OTP"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="nb-stack">
                <Input
                  label="Enter OTP"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="6-digit code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                {error ? <p className="nb-field__error">{error}</p> : null}
                <Button type="submit" disabled={busy}>
                  {busy ? "Verifying…" : "Verify & continue"}
                </Button>
                <div className="nb-auth__row-links">
                  <button
                    type="button"
                    className="nb-link-btn"
                    onClick={handleResendOtp}
                    disabled={busy}
                  >
                    Resend code
                  </button>
                  <span className="nb-muted" aria-hidden="true">
                    ·
                  </span>
                  <button type="button" className="nb-link-btn" onClick={resetPhoneFlow}>
                    Change number
                  </button>
                </div>
              </form>
            )}
          </>
        )}

        <div
          id="recaptcha-container"
          className="nb-recaptcha-host"
          aria-hidden="true"
        />
      </Card>

      {user && !profileComplete ? (
        <p className="nb-hint nb-hint--center">
          Signed in. Continue to{" "}
          <Link className="nb-inline-link" to="/onboarding">
            onboarding
          </Link>
          , or{" "}
          <button type="button" className="nb-inline-link" onClick={handleSignOut}>
            sign out
          </button>
          .
        </p>
      ) : null}

      <p className="nb-hint nb-hint--center nb-hint--muted">
        Phone sign-in uses Firebase SMS where applicable. Google uses your Google account email.
      </p>
    </div>
  );
}
