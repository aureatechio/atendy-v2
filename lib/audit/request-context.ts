import { headers } from "next/headers";
import type { AuditRequestContext } from "@/lib/audit/logger";

export async function getAuditRequestContext(): Promise<AuditRequestContext> {
  const headerStore = await headers();
  const pathname = headerStore.get("x-atendy-pathname");
  const referer = headerStore.get("referer");

  return {
    requestPath: pathname ?? referer,
    userAgent: headerStore.get("user-agent"),
  };
}
