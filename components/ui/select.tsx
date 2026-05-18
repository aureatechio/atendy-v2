import * as React from "react";

export function Select({
  children,
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`ds-select ${className ?? ""}`} {...props}>
      {children}
    </select>
  );
}
