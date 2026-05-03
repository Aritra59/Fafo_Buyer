import { useEffect, useState } from "react";
import { fetchBuyerTerms } from "../services/termsService";

/**
 * View-only buyer terms (scrollable). No checkbox, no blocking.
 */
export default function BuyerTermsPanel() {
  const [title, setTitle] = useState("Buyer terms");
  const [text, setText] = useState("");
  const [html, setHtml] = useState(/** @type {string | null} */(null));
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const t = await fetchBuyerTerms();
        if (cancelled) return;
        setTitle(t.title);
        setText(t.text);
        setHtml(t.html);
        setErr("");
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Could not load terms.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <section className="bs-buyer-terms" aria-label={title}>
        <h3 className="bs-buyer-terms__title">{title}</h3>
        <p className="nb-muted" style={{ margin: 0, fontSize: "0.85rem" }}>
          Loading…
        </p>
      </section>
    );
  }

  if (err) {
    return (
      <section className="bs-buyer-terms" aria-label={title}>
        <h3 className="bs-buyer-terms__title">{title}</h3>
        <p className="nb-field__error nb-field__error--soft" style={{ margin: 0, fontSize: "0.85rem" }}>
          {err}
        </p>
      </section>
    );
  }

  if (!html && !text) {
    return null;
  }

  return (
    <section className="bs-buyer-terms" aria-label={title}>
      <h3 className="bs-buyer-terms__title">{title}</h3>
      <p className="bs-buyer-terms__hint nb-muted" style={{ margin: "0 0 0.45rem", fontSize: "0.8rem" }}>
        For your information only — no action required.
      </p>
      <div className="bs-buyer-terms__scroll" tabIndex={0}>
        {html ? (
          <div
            className="bs-buyer-terms__html"
            // Admin-controlled legal copy in Firestore; buyer app is view-only.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <pre className="bs-buyer-terms__text">{text}</pre>
        )}
      </div>
    </section>
  );
}
