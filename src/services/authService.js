import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../firebase/config";

/** DOM id; must match `<div id="...">` in RecaptchaHost. */
export const RECAPTCHA_CONTAINER_ID = "recaptcha-container";

/** @type {import("firebase/auth").RecaptchaVerifier | null} */
let recaptchaVerifier = null;
/** @type {Promise<import("firebase/auth").RecaptchaVerifier> | null} */
let recaptchaSetupPromise = null;

/**
 * Replace the container node so Google's widget cannot stick to a stale element.
 */
function resetRecaptchaContainerDom() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (!el?.parentNode) return;
  const fresh = document.createElement("div");
  fresh.id = RECAPTCHA_CONTAINER_ID;
  fresh.className = el.className || "nb-recaptcha-host";
  fresh.setAttribute("aria-hidden", "true");
  el.parentNode.replaceChild(fresh, el);
}

export function clearRecaptcha() {
  try {
    recaptchaVerifier?.clear();
  } catch {
    // ignore
  }
  recaptchaVerifier = null;
  recaptchaSetupPromise = null;
  resetRecaptchaContainerDom();
}

function isRecaptchaReuseError(err) {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /already been rendered/i.test(msg);
}

function isRetriablePhoneAuthError(err) {
  const code = getErrorCode(err);
  if (code && RETRIABLE_PHONE_AUTH_CODES.has(code)) return true;
  return isRecaptchaReuseError(err);
}

/**
 * @param {boolean} [force] When true, always tear down and create a fresh verifier.
 * @returns {Promise<import("firebase/auth").RecaptchaVerifier>}
 */
export async function setupRecaptcha(force = false) {
  if (typeof document === "undefined") {
    throw new Error("Phone sign-in is only available in the browser.");
  }
  if (!force && recaptchaVerifier) {
    return recaptchaVerifier;
  }
  if (!force && recaptchaSetupPromise) {
    return recaptchaSetupPromise;
  }

  const run = async () => {
    clearRecaptcha();
    const el = document.getElementById(RECAPTCHA_CONTAINER_ID);
    if (!el) {
      throw new Error(
        'reCAPTCHA container is missing. Add <RecaptchaHost /> near the app root.',
      );
    }
    const verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
      size: "invisible",
    });
    try {
      await verifier.render();
    } catch (err) {
      try {
        verifier.clear();
      } catch {
        // ignore
      }
      if (isRecaptchaReuseError(err)) {
        resetRecaptchaContainerDom();
        const el2 = document.getElementById(RECAPTCHA_CONTAINER_ID);
        if (!el2) throw err;
        const verifier2 = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
          size: "invisible",
        });
        await verifier2.render();
        recaptchaVerifier = verifier2;
        return verifier2;
      }
      throw err;
    }
    recaptchaVerifier = verifier;
    return verifier;
  };

  recaptchaSetupPromise = run().finally(() => {
    recaptchaSetupPromise = null;
  });
  return recaptchaSetupPromise;
}

/**
 * Pre-render invisible reCAPTCHA so the first "Send OTP" is faster.
 * Safe to call on login mount / discover modal open.
 */
export function warmRecaptcha() {
  if (typeof document === "undefined") return;
  if (recaptchaVerifier || recaptchaSetupPromise) return;
  setupRecaptcha().catch(() => {
    clearRecaptcha();
  });
}

const RETRIABLE_PHONE_AUTH_CODES = new Set([
  "auth/invalid-app-credential",
  "auth/captcha-check-failed",
  "auth/invalid-recaptcha-token",
]);

function getErrorCode(err) {
  if (err && typeof err === "object" && "code" in err) {
    const c = err.code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

/**
 * Human-readable copy for common Firebase Auth errors (phone + general).
 * @param {unknown} err
 * @param {string} [fallback]
 */
export function getFirebaseAuthMessage(err, fallback = "Something went wrong. Try again.") {
  const code = getErrorCode(err);
  const messages = {
    "auth/invalid-app-credential":
      "SMS protection could not verify this browser. Refresh the page and try again, or use Google sign-in.",
    "auth/invalid-recaptcha-token":
      "reCAPTCHA verification failed. Refresh the page and try again.",
    "auth/captcha-check-failed": "reCAPTCHA check failed. Please try again in a few seconds.",
    "auth/too-many-requests":
      "Too many SMS attempts. Wait a few minutes, then try again.",
    "auth/invalid-phone-number":
      "This phone number format is not valid. Use a full number with country code (e.g. +91 for India).",
    "auth/missing-phone-number": "Please enter a phone number.",
    "auth/quota-exceeded": "SMS quota for this project was exceeded. Try again later.",
  };
  if (code && messages[code]) return messages[code];
  if (isRecaptchaReuseError(err)) {
    return "SMS verification reset. Tap Send OTP again.";
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

if (import.meta.env.DEV) {
  const h = typeof window !== "undefined" ? window.location.hostname : "";
  if (h && h !== "localhost" && h !== "127.0.0.1") {
    // eslint-disable-next-line no-console
    console.info(
      `[auth] You are on host "${h}". If phone OTP fails with domain errors, add it under Firebase Console → Auth → Settings → Authorized domains.`,
    );
  }
}

/**
 * @param {string} e164Phone — E.164, e.g. +9198…
 * @param {{ retryOnVerifierError?: boolean }} [opts]
 */
export async function sendOtp(e164Phone, opts = {}) {
  const { retryOnVerifierError = true } = opts;

  async function attempt(forceVerifier) {
    const v = await setupRecaptcha(forceVerifier);
    return signInWithPhoneNumber(auth, e164Phone, v);
  }

  try {
    return await attempt(false);
  } catch (err) {
    if (!retryOnVerifierError || !isRetriablePhoneAuthError(err)) {
      throw err;
    }
    clearRecaptcha();
    return attempt(true);
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

/** Sign out and reset phone-auth widgets for a clean next login. */
export async function signOutAndClearRecaptcha() {
  clearRecaptcha();
  return signOut(auth);
}
