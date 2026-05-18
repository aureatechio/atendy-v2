import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({
  className,
  children,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: "default" | "success" | "warning" | "danger" }) {
  const styleByVariant = {
    default: "ds-badge-default",
    success: "ds-badge-success",
    warning: "ds-badge-warning",
    danger: "ds-badge-danger",
  } as const;

  return (
    <span
      className={cn("ds-badge", styleByVariant[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
