import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase/config";

/** DOM id; must match `<div id="...">` on the login page. */
export const RECAPTCHA_CONTAINER_ID = "recaptcha-container";

/** @type {import("firebase/auth").RecaptchaVerifier | null} */
let recaptchaVerifier = null;

function clearRecaptchaDom() {
  if (typeof document === "undefined") return;
  const el = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (el) el.innerHTML = "";
}

export function clearRecaptcha() {
  try {
    recaptchaVerifier?.clear();
  } catch {
    // ignore
  }
  recaptchaVerifier = null;
  clearRecaptchaDom();
}

/**
 * Returns the singleton RecaptchaVerifier. Creates at most one instance per #recaptcha-container
 * until clearRecaptcha(). Call from sendOtp (user gesture), not on React mount, to avoid
 * duplicate render / StrictMode double-init.
 * @returns {Promise<import("firebase/auth").RecaptchaVerifier>}
 */
export async function setupRecaptcha() {
  if (typeof document === "undefined") {
    throw new Error("Phone sign-in is only available in the browser.");
  }
  if (recaptchaVerifier) {
    return recaptchaVerifier;
  }
  const el = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (!el) {
    throw new Error(
      "reCAPTCHA container is missing. Add: <div id=\"recaptcha-container\"></div>."
    );
  }
  clearRecaptchaDom();
  recaptchaVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
    size: "invisible",
  });
  await recaptchaVerifier.render();
  return recaptchaVerifier;
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
  const v = await setupRecaptcha();
  const send = () => signInWithPhoneNumber(auth, e164Phone, v);
  try {
    return await send();
  } catch (err) {
    const code = getErrorCode(err);
    if (
      retryOnVerifierError &&
      code &&
      RETRIABLE_PHONE_AUTH_CODES.has(code)
    ) {
      clearRecaptcha();
      const v2 = await setupRecaptcha();
      return signInWithPhoneNumber(auth, e164Phone, v2);
    }
    throw err;
  }
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}
