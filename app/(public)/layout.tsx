import { AuthProvider } from "@/hooks/use-auth";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
