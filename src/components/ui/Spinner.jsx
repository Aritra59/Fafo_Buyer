export function Spinner({ label = "Loading…" }) {
  return (
    <div className="nb-spinner-wrap" role="status" aria-live="polite">
      <span className="nb-spinner" aria-hidden />
      <span className="nb-sr-only">{label}</span>
    </div>
  );
}
