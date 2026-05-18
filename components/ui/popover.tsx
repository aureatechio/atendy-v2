import * as React from "react";

export function Popover({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <details className={`relative ${className}`}>
      {children}
    </details>
  );
}

export function PopoverTrigger({ children, asChild = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  if (asChild) return <>{children}</>;
  return <button {...props}>{children}</button>;
}

export function PopoverContent({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`ds-popover-content ${className}`}>
      {children}
    </div>
  );
}
