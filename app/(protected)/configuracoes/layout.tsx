import { redirect } from "next/navigation";
import { getAuthSnapshot } from "@/lib/auth/get-auth-snapshot";
import { canAccessSettings } from "@/lib/auth/guards";
import { SettingsShell } from "@/components/settings/settings-shell";

export default async function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  const snapshot = await getAuthSnapshot();

  if (!canAccessSettings(snapshot)) {
    redirect("/");
  }

  return <SettingsShell>{children}</SettingsShell>;
}
