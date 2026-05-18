import comprasRaw from "@/data/compras.json";
import funilRaw from "@/data/funil.json";
import { type Compra, type FunilData } from "@/lib/types";

const comprasData: Compra[] = comprasRaw as Compra[];
const funilData: FunilData = funilRaw as FunilData;

export async function getCompras(): Promise<Compra[]> {
  return comprasData;
}

export async function getFunilDados(): Promise<FunilData> {
  return funilData;
}
