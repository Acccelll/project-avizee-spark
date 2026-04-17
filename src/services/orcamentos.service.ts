import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OrcamentoBase {
  id: string;
  numero: string;
  status: string;
  cliente_id: string | null;
  valor_total: number | null;
  quantidade_total: number | null;
  peso_total: number | null;
  observacoes: string | null;
}

export async function sendForApproval(orc: OrcamentoBase): Promise<void> {
  if (orc.status !== "rascunho") return;
  const { error } = await supabase
    .from("orcamentos")
    .update({ status: "pendente" })
    .eq("id", orc.id);
  if (error) throw error;
  toast.success(`Cotação ${orc.numero} enviada para aprovação!`);
}

export async function approveOrcamento(orc: OrcamentoBase): Promise<void> {
  const { error } = await supabase
    .from("orcamentos")
    .update({ status: "aprovado" })
    .eq("id", orc.id);
  if (error) throw error;
  toast.success(`Cotação ${orc.numero} aprovada!`);
}

export interface ConvertToOVOptions {
  poNumber?: string;
  dataPo?: string;
}

/** @deprecated Use convertToPedido instead */
export const convertToOV = convertToPedido;

/**
 * Converte orçamento em pedido de venda usando RPC transacional.
 * Garante atomicidade: numera, copia itens e dados de frete, e marca o orçamento.
 */
export async function convertToPedido(
  orc: OrcamentoBase,
  options: ConvertToOVOptions = {}
): Promise<{ ovId: string; ovNumero: string }> {
  const { data, error } = await supabase.rpc("converter_orcamento_em_ov", {
    p_orcamento_id: orc.id,
    p_po_number: options.poNumber ?? null,
    p_data_po: options.dataPo ?? null,
  });
  if (error) throw error;
  const result = data as { ov_id: string; ov_numero: string };
  toast.success(`Pedido ${result.ov_numero} criado com sucesso!`);
  return { ovId: result.ov_id, ovNumero: result.ov_numero };
}

export async function enviarOrcamentoPorEmail(
  orcamentoId: string,
  emailDestino: string,
  mensagem: string
): Promise<void> {
  const token = await ensurePublicToken(orcamentoId);
  const linkPublico = `${window.location.origin}/orcamento-publico?token=${token}`;

  try {
    const { error } = await supabase.rpc('enqueue_email' as never, {
      queue_name: 'transactional_emails',
      payload: {
        to: emailDestino,
        subject: 'Orçamento disponível para visualização',
        html: `<p>${mensagem.replace(/\n/g, '<br>')}</p><p><a href="${linkPublico}">Clique aqui para visualizar o orçamento</a></p>`,
        label: 'orcamento',
        message_id: `orcamento-${orcamentoId}-${Date.now()}`,
      },
    } as never);
    if (error) throw error;
    toast.success('E-mail enfileirado para envio.');
  } catch {
    const assunto = encodeURIComponent('Orçamento disponível para visualização');
    const corpo = encodeURIComponent(`${mensagem}\n\n${linkPublico}`);
    window.open(`mailto:${emailDestino}?subject=${assunto}&body=${corpo}`);
    toast.info('E-mail aberto no cliente de e-mail padrão.');
  }
}

export async function ensurePublicToken(orcId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("orcamentos")
    .select("public_token")
    .eq("id", orcId)
    .maybeSingle();

  if (existing?.public_token) return existing.public_token;

  const token = crypto.randomUUID();
  const { error } = await supabase
    .from("orcamentos")
    .update({ public_token: token })
    .eq("id", orcId);

  if (error) throw error;
  return token;
}
