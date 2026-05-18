import { getCompras as getComprasLocal } from "@/lib/data";

export async function getCompras() {
  return getComprasLocal();
}
