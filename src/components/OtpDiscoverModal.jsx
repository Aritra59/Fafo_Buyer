import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RECAPTCHA_CONTAINER_ID,
  clearRecaptcha,
  getFirebaseAuthMessage,
  sendOtp,
} from "../services/authService";
import { normalizeIndiaPhone } from "../utils/format";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Card } from "./ui/Card";

const DISCOVER_COPY = {
  shops: {
    title: "Get OTP to discover nearby shops",
    hint: "Sign in with your phone to browse FaFo shops near you and save your order history.",
  },
  apps: {
    title: "Get OTP to discover nearby apps",
    hint: "Sign in with your phone to browse FaFo apps near you and save your order history.",
  },
};

/**
 * Phone OTP modal for guests to unlock discovery.
 * @param {{ open: boolean, onClose: () => void, initialPhone?: string, variant?: 'shops'|'apps' }} props
 */
export default function OtpDiscoverModal({ open, onClose, initialPhone = "", variant = "shops" }) {
  const navigate = useNavigate();
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmationRef = useRef(null);
  const lastE164Ref = useRef(null);

  useEffect(() => {
    if (!open) {
      clearRecaptcha();
      confirmationRef.current = null;
      lastE164Ref.current = null;
      setStep("phone");
      setOtp("");
      setError("");
      setBusy(false);
      return;
    }
    const p = String(initialPhone || "").trim();
    setPhone(p);
  }, [open, initialPhone]);

  if (!open) return null;

  const copy = DISCOVER_COPY[variant === "apps" ? "apps" : "shops"];

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
      clearRecaptcha();
      onClose();
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

  return (
    <div
      className="nb-discover-modal-backdrop"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        className="nb-discover-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="nb-discover-modal-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
        }}
      >
        <Card className="nb-card--neon nb-discover-modal__card">
          <h2 id="nb-discover-modal-title" className="nb-discover-modal__title">
            {copy.title}
          </h2>
          <p className="nb-muted nb-discover-modal__hint">{copy.hint}</p>

          {step === "phone" ? (
            <form className="nb-stack" style={{ gap: "0.65rem", marginTop: "0.75rem" }} onSubmit={handleSendOtp}>
              <Input
                label="Phone number"
                name="discover-phone"
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
              <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
                Not now
              </Button>
            </form>
          ) : (
            <form className="nb-stack" style={{ gap: "0.65rem", marginTop: "0.75rem" }} onSubmit={handleVerifyOtp}>
              <Input
                label="Enter OTP"
                name="discover-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
              {error ? <p className="nb-field__error">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? "Verifying…" : "Verify & explore"}
              </Button>
              <div className="nb-auth__row-links">
                <button type="button" className="nb-link-btn" onClick={handleResendOtp} disabled={busy}>
                  Resend code
                </button>
                <span className="nb-muted" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  className="nb-link-btn"
                  onClick={() => {
                    setStep("phone");
                    setOtp("");
                    setError("");
                  }}
                  disabled={busy}
                >
                  Change number
                </button>
              </div>
              <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
            </form>
          )}

          <div id={RECAPTCHA_CONTAINER_ID} className="nb-recaptcha-host" aria-hidden="true" />
        </Card>
      </div>
    </div>
  );
}
