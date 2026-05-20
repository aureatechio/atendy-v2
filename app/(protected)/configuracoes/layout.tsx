import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessAdmin } from "@/lib/auth/guards";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const snapshot = await getAuthSnapshot();

  if (!canAccessAdmin(snapshot)) {
    redirect("/");
  }

  return <SettingsShell>{children}</SettingsShell>;
}
