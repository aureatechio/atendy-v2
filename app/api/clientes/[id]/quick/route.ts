import { NextResponse } from "next/server";
import { getClienteQuickDetail } from "@/lib/api/clientes";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "ID obrigatório." }, { status: 400 });
  }

  try {
    const detail = await getClienteQuickDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }
    return NextResponse.json({ detail });
  } catch (error) {
    const message = (error as Error)?.message ?? "Não foi possível carregar o cliente.";
    const status = message.includes("Authenticated Supabase session") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
