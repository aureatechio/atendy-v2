import * as React from "react";

export function Card({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <section className={`ds-card panel-card ${className || ""}`}>{children}</section>;
}

export function CardHeader({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <header className={`panel-card-header ${className || ""}`}>{children}</header>;
}

export function CardContent({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`panel-card-content ${className || ""}`}>{children}</div>;
}

export function CardTitle({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <h3 className={`text-[15px] font-semibold text-[var(--text)] ${className || ""}`}>
      {children}
    </h3>
  );
}
