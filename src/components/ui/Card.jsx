export function Card({ children, className = "", ...rest }) {
  return (
    <div className={`nb-card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
