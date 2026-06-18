/**
 * Loaders do wizard de emissão de NF-e (`/faturamento/emitir`).
 *
 * Concentra acesso a `supabase.from(...)` para os fluxos de pré-preenchimento
 * (query string), em conformidade com a constraint
 * `mem://tech/camada-services-unica`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface WizardClientePreload {
  id: string;
  nome_razao_social: string;
  uf: string | null;
  codigo_ibge_municipio: string | null;
}

export async function fetchClienteParaWizard(
  clienteId: string,
): Promise<WizardClientePreload | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome_razao_social, uf, codigo_ibge_municipio")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw error;
  return (data as WizardClientePreload | null) ?? null;
}

export interface WizardOrdemVendaItem {
  produto_id: string | null;
  codigo_snapshot: string | null;
  descricao_snapshot: string | null;
  quantidade: number | null;
  quantidade_faturada: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  valor_total: number | null;
  produto?: { ncm: string | null } | null;
}

export interface WizardOrdemVenda {
  id: string;
  numero: string;
  observacoes: string | null;
  frete_tipo: string | null;
  frete_valor: number | null;
  cliente: {
    id: string;
    nome_razao_social: string;
    uf: string | null;
    codigo_ibge_municipio: string | null;
    cidade: string | null;
  } | null;
  itens: WizardOrdemVendaItem[];
}

export async function fetchOrdemVendaParaWizard(
  ordemVendaId: string,
): Promise<WizardOrdemVenda | null> {
  const { data, error } = await supabase
    .from("ordens_venda")
    .select(`
      id, numero, observacoes, frete_tipo, frete_valor,
      cliente:cliente_id(id, nome_razao_social, uf, codigo_ibge_municipio, cidade),
      itens:ordens_venda_itens(
        id, produto_id, codigo_snapshot, descricao_snapshot,
        quantidade, quantidade_faturada, unidade, valor_unitario, valor_total,
        produto:produto_id(ncm)
      )
    `)
    .eq("id", ordemVendaId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as WizardOrdemVenda | null) ?? null;
}

export interface WizardNFRef {
  id: string;
  numero: string | number | null;
  serie: string | null;
  chave_acesso: string | null;
  observacoes: string | null;
  valor_total: number | null;
  frete_valor: number | null;
  cliente: {
    id: string;
    nome_razao_social: string;
    uf: string | null;
    codigo_ibge_municipio: string | null;
  } | null;
  itens: Array<Record<string, unknown>>;
}

export async function fetchNFReferenciadaParaWizard(
  nfId: string,
): Promise<WizardNFRef | null> {
  const { data, error } = await supabase
    .from("notas_fiscais")
    .select(`
      id, numero, serie, chave_acesso, observacoes, valor_total, frete_valor,
      cliente:cliente_id(id, nome_razao_social, uf, codigo_ibge_municipio),
      itens:notas_fiscais_itens(
        produto_id, codigo_produto, descricao, ncm, cfop, cst, origem_mercadoria,
        unidade, quantidade, valor_unitario, valor_total,
        icms_base, icms_aliquota, icms_valor,
        ipi_aliquota, ipi_valor, pis_aliquota, pis_valor, cofins_aliquota, cofins_valor
      )
    `)
    .eq("id", nfId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as WizardNFRef | null) ?? null;
}

export async function marcarOrdemVendaFaturada(ordemVendaId: string): Promise<void> {
  await supabase
    .from("ordens_venda")
    .update({ status_faturamento: "faturado" })
    .eq("id", ordemVendaId);
}