import { createCrmClient } from "@/lib/crm/client";
import { fetchSupabaseAll } from "@/lib/supabase/paginate";

const CRM_COMPRAS_SELECT = `
  id,
  data_compra,
  data_pagamento,
  descricao,
  valor_total,
  valor_total_proposta,
  tipo_venda,
  statuscompra,
  statusproducao,
  checkout_status,
  vendaaprovada,
  parcelado,
  numero_parcelas,
  vigencia_meses,
  fimdireitouso,
  regiaocomprada,
  tempoocomprado,
  razao_social,
  endereco_completo,
  telefone,
  is_mgs,
  is_test,
  clicksign_status,
  data_envio_assinatura,
  data_assinatura_concluida,
  clicksign_signed_document_url,
  leadid,
  imagemproposta_id,
  cliente:clientes!compras_cliente_id_fkey ( id, nome, cnpj, cpf, email, telefone, razaosocial, cidade, estado ),
  vendedor:vendedores!compras_vendedoresponsavel_fkey ( id, nome ),
  celebridade_ref:celebridadesReferencia!compras_celebridade_fkey ( id, nome ),
  segmento_ref:segmentos!compras_segmento_fkey ( id, nome ),
  subsegmento_ref:subsegmento!compras_subsegmento_fkey ( id, nome ),
  imagem:imagemProposta!compras_imagemproposta_id_fkey ( id, imagem )
`;

type Relation<T> = T | null;

export type CrmCompraRow = {
  id: string;
  data_compra: string | null;
  data_pagamento: string | null;
  descricao: string | null;
  valor_total: number | null;
  valor_total_proposta: number | null;
  tipo_venda: string | null;
  statuscompra: string | null;
  statusproducao: string | null;
  checkout_status: string | null;
  vendaaprovada: boolean | null;
  parcelado: boolean | null;
  numero_parcelas: number | null;
  vigencia_meses: number | null;
  fimdireitouso: string | null;
  regiaocomprada: string | null;
  tempoocomprado: string | null;
  razao_social: string | null;
  endereco_completo: string | null;
  telefone: string | null;
  is_mgs: boolean | null;
  is_test: boolean | null;
  clicksign_status: string | null;
  data_envio_assinatura: string | null;
  data_assinatura_concluida: string | null;
  clicksign_signed_document_url: string | null;
  leadid: string | null;
  imagemproposta_id: string | null;
  cliente: Relation<{
    id: string;
    nome: string | null;
    cnpj: string | null;
    cpf: string | null;
    email: string | null;
    telefone: string | null;
    razaosocial: string | null;
    cidade: string | null;
    estado: string | null;
  }>;
  vendedor: Relation<{ id: string; nome: string | null }>;
  celebridade_ref: Relation<{ id: string; nome: string | null }>;
  segmento_ref: Relation<{ id: string; nome: string | null }>;
  subsegmento_ref: Relation<{ id: string; nome: string | null }>;
  imagem: Relation<{ id: number; imagem: string | null }>;
};

export async function fetchCrmCompras(): Promise<CrmCompraRow[]> {
  const supabase = createCrmClient();

  return fetchSupabaseAll<CrmCompraRow>((from, to) =>
    supabase
      .from("compras")
      .select(CRM_COMPRAS_SELECT)
      .in("checkout_status", ["pago", "parcialmente_pago"])
      .eq("is_test", false)
      .order("data_compra", { ascending: false })
      .range(from, to)
      .returns<CrmCompraRow[]>(),
  );
}
