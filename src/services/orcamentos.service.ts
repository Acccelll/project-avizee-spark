import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { proximoNumeroOrcamento } from "@/types/rpc";

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
  const { error } = await supabase.rpc("enviar_orcamento_aprovacao" as never, {
    p_id: orc.id,
  } as never);
  if (error) throw new Error(`Erro ao enviar orçamento para aprovação: ${error.message}`);
  toast.success(`Orçamento ${orc.numero} enviado para aprovação!`);
}

export async function approveOrcamento(orc: OrcamentoBase): Promise<void> {
  const { error } = await supabase.rpc("aprovar_orcamento" as never, {
    p_id: orc.id,
  } as never);
  if (error) throw new Error(`Erro ao aprovar orçamento: ${error.message}`);
  toast.success(`Orçamento ${orc.numero} aprovado!`);
}

/**
 * Cancelamento lógico de orçamento (preserva rastreabilidade).
 * Usa a RPC `cancelar_orcamento` que valida status e registra auditoria.
 */
export async function cancelarOrcamento(orcId: string, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc("cancelar_orcamento" as never, {
    p_id: orcId,
    p_motivo: motivo ?? null,
  } as never);
  if (error) throw new Error(`Erro ao cancelar orçamento: ${error.message}`);
  toast.success("Orçamento cancelado.");
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
  if (error) throw new Error(`Erro ao converter orçamento em pedido: ${error.message}`);
  const result = data as { ov_id: string; ov_numero: string };
  return { ovId: result.ov_id, ovNumero: result.ov_numero };
}

export async function enviarOrcamentoPorEmail(
  orcamentoId: string,
  emailDestino: string,
  mensagem: string,
  extras?: {
    numeroOrcamento?: string;
    clienteNome?: string;
    validade?: string;
    valorTotal?: string;
    vendedorNome?: string;
    pdfBlob?: Blob;
  }
): Promise<void> {
  const token = await ensurePublicToken(orcamentoId);
  const linkPublico = `${window.location.origin}/orcamento-publico?token=${token}`;

  // Upload do PDF (se fornecido) e geração de URL assinada (válida por 30 dias)
  let linkPdf: string | undefined;
  if (extras?.pdfBlob) {
    try {
      const filename = `${orcamentoId}/orcamento-${extras.numeroOrcamento ?? orcamentoId}-${Date.now()}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("orcamentos-pdf")
        .upload(filename, extras.pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadError) throw uploadError;
      const { data: signed } = await supabase.storage
        .from("orcamentos-pdf")
        .createSignedUrl(filename, 60 * 60 * 24 * 30);
      linkPdf = signed?.signedUrl;
    } catch (err) {
      logger.warn("Falha ao anexar PDF ao e-mail:", err);
    }
  }

  try {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "orcamento-disponivel",
        recipientEmail: emailDestino,
        idempotencyKey: `orcamento-${orcamentoId}-${Date.now()}`,
        templateData: {
          numeroOrcamento: extras?.numeroOrcamento,
          clienteNome: extras?.clienteNome,
          validade: extras?.validade,
          valorTotal: extras?.valorTotal,
          vendedorNome: extras?.vendedorNome,
          mensagem,
          linkPublico,
          linkPdf,
        },
      },
    });
    if (error) throw error;
    toast.success("E-mail enviado para o cliente.");
  } catch {
    const assunto = encodeURIComponent(
      `Orçamento ${extras?.numeroOrcamento ?? ""} disponível`.trim(),
    );
    const corpo = encodeURIComponent(
      `${mensagem}\n\nVisualizar online: ${linkPublico}${linkPdf ? `\nBaixar PDF: ${linkPdf}` : ""}`,
    );
    window.open(`mailto:${emailDestino}?subject=${assunto}&body=${corpo}`);
    toast.info("E-mail aberto no cliente de e-mail padrão.");
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

  if (error) throw new Error(`Erro ao gerar token público para orçamento: ${error.message}`);
  return token;
}

/**
 * Duplica um orçamento existente como rascunho, copiando itens e metadados
 * de frete (transportadora, simulação, dimensões, prazos). A numeração é
 * obtida atomicamente via RPC `proximo_numero_orcamento` com fallback
 * baseado em timestamp em caso de falha.
 *
 * @returns o `id` e o `numero` do orçamento recém-criado.
 */
export async function duplicateOrcamento(
  orc: OrcamentoBase & { frete_valor?: number | null; pagamento?: string | null;
    prazo_pagamento?: string | null; prazo_entrega?: string | null;
    frete_tipo?: string | null; modalidade?: string | null;
    cliente_snapshot?: unknown; }
): Promise<{ id: string; numero: string }> {
  // 1. Itens originais
  const { data: items, error: itemsError } = await supabase
    .from("orcamentos_itens")
    .select("*")
    .eq("orcamento_id", orc.id);
  if (itemsError) throw new Error(itemsError.message);

  // 2. Snapshot completo do orçamento original (metadados de frete)
  const { data: fullOrcamento, error: fullError } = await supabase
    .from("orcamentos")
    .select("*")
    .eq("id", orc.id)
    .maybeSingle();
  if (fullError) throw new Error(fullError.message);
  const fullOrc = (fullOrcamento ?? {}) as Record<string, unknown>;

  // 3. Numeração atômica (com fallback em caso de erro de rede)
  const newNumero = await proximoNumeroOrcamento().catch((err) => {
    logger.warn("[orcamentos] proximo_numero_orcamento falhou, usando fallback:", err);
    return null;
  });
  const newNumeroStr = newNumero || `ORC${String(Date.now()).slice(-6)}`;

  // 4. Insert do novo cabeçalho como rascunho
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase insert type inference limitation
  const { data: newOrc, error: insertError } = await (supabase as any)
    .from("orcamentos")
    .insert({
      numero: newNumeroStr,
      data_orcamento: new Date().toISOString().split("T")[0],
      status: "rascunho",
      cliente_id: orc.cliente_id,
      validade: null,
      observacoes: orc.observacoes,
      frete_valor: orc.frete_valor || 0,
      valor_total: orc.valor_total,
      quantidade_total: orc.quantidade_total,
      peso_total: orc.peso_total,
      pagamento: orc.pagamento,
      prazo_pagamento: orc.prazo_pagamento,
      prazo_entrega: orc.prazo_entrega,
      frete_tipo: orc.frete_tipo,
      modalidade: orc.modalidade,
      cliente_snapshot: orc.cliente_snapshot,
      transportadora_id: (fullOrc.transportadora_id as string | null) ?? null,
      frete_simulacao_id: (fullOrc.frete_simulacao_id as string | null) ?? null,
      origem_frete: (fullOrc.origem_frete as string | null) ?? null,
      servico_frete: (fullOrc.servico_frete as string | null) ?? null,
      prazo_entrega_dias: (fullOrc.prazo_entrega_dias as number | null) ?? null,
      volumes: (fullOrc.volumes as number | null) ?? null,
      altura_cm: (fullOrc.altura_cm as number | null) ?? null,
      largura_cm: (fullOrc.largura_cm as number | null) ?? null,
      comprimento_cm: (fullOrc.comprimento_cm as number | null) ?? null,
    })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);
  if (!newOrc) throw new Error("Falha ao criar orçamento duplicado");

  // 5. Copia dos itens (se houver)
  if (items && items.length > 0) {
    const newItems = items.map((i) => ({
      orcamento_id: newOrc.id,
      produto_id: i.produto_id,
      codigo_snapshot: i.codigo_snapshot,
      descricao_snapshot: i.descricao_snapshot,
      variacao: i.variacao,
      quantidade: i.quantidade,
      unidade: i.unidade,
      valor_unitario: i.valor_unitario,
      valor_total: i.valor_total,
      peso_unitario: i.peso_unitario,
      peso_total: i.peso_total,
    }));
    const { error: insertItemsError } = await supabase
      .from("orcamentos_itens")
      .insert(newItems);
    if (insertItemsError) throw new Error(insertItemsError.message);
  }

  return { id: newOrc.id as string, numero: newNumeroStr };
}
