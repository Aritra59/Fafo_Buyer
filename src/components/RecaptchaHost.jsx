import { RECAPTCHA_CONTAINER_ID } from "../services/authService";

/** One invisible reCAPTCHA mount for the whole app (avoids duplicate #ids). */
export default function RecaptchaHost() {
  return (
    <div id={RECAPTCHA_CONTAINER_ID} className="nb-recaptcha-host" aria-hidden="true" />
  );
}
