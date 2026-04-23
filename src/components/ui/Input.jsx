export function Input({ label, id, error, className = "", ...rest }) {
  const inputId = id || rest.name;
  return (
    <label className={`nb-field ${className}`.trim()} htmlFor={inputId}>
      {label && <span className="nb-field__label">{label}</span>}
      <input id={inputId} className="nb-input" {...rest} />
      {error ? <span className="nb-field__error">{error}</span> : null}
    </label>
  );
}
