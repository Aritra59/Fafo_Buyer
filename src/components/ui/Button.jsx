export function Button({
  children,
  className = "",
  variant = "primary",
  type = "button",
  disabled,
  ...rest
}) {
  return (
    <button
      type={type}
      className={`nb-btn nb-btn--${variant} ${className}`.trim()}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}
