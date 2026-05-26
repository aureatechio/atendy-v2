import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function ConfiguracoesIndexPage() {
  redirect("/configuracoes/etapas");
}
