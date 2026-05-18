import { getCompras } from "@/lib/api/compras";
import { ComprasDashboard } from "@/components/dashboard/compras-dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getCompras();
  return <ComprasDashboard initialData={data} />;
}
