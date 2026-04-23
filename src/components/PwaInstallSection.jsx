import { useEffect, useState } from "react";
import { Button } from "./ui/Button";

/**
 * @returns {import("react").JSX.Element | null}
 */
export default function PwaInstallSection() {
  const [deferred, setDeferred] = useState(/** @type {Event | null} */ (null));

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (deferred) {
    return (
      <div className="nb-pwa-hint" style={{ marginTop: "0.75rem" }}>
        <Button
          type="button"
          variant="ghost"
          className="nb-btn--sm"
          onClick={async () => {
            const e = deferred;
            if (e && "prompt" in e && typeof (/** @type {Event & { prompt?: () => Promise<void> }} */ (e)).prompt === "function") {
              await (/** @type {Event & { prompt: () => Promise<void> }} */ (e)).prompt();
            }
            setDeferred(null);
          }}
        >
          Install FaFo Ordering app
        </Button>
      </div>
    );
  }

  return (
    <p className="nb-muted nb-hint" style={{ marginTop: "0.75rem" }}>
      <strong>Install FaFo Ordering</strong> — on your phone, use the browser menu
      &quot;Add to Home screen&quot; (or install prompt when shown) for a quick icon.
    </p>
  );
}
