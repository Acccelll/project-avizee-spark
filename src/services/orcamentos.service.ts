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
      console.warn("Falha ao anexar PDF ao e-mail:", err);
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
