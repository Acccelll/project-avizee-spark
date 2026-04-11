/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase update type workaround */
import { supabase } from "@/integrations/supabase/client";
import {
  calcularValorParcela,
  calcularVencimentoParcela,
  calcularStatusFaturamentoOV,
} from "@/lib/fiscal";

// ── Event logging ──────────────────────────────────────────────────────────────

export async function registrarEventoFiscal(params: {
  nota_fiscal_id: string;
  tipo_evento: string;
  status_anterior?: string;
  status_novo?: string;
  descricao?: string;
  payload_resumido?: Record<string, any>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("nota_fiscal_eventos").insert({
    nota_fiscal_id: params.nota_fiscal_id,
    tipo_evento: params.tipo_evento,
    status_anterior: params.status_anterior || null,
    status_novo: params.status_novo || null,
    descricao: params.descricao || null,
    payload_resumido: params.payload_resumido || null,
    usuario_id: user?.id || null,
  } as any);
}

// ── Confirm NF ─────────────────────────────────────────────────────────────────

interface ConfirmarNFParams {
  nf: {
    id: string; numero: string; tipo: string;
    data_emissao: string; valor_total: number;
    movimenta_estoque: boolean; gera_financeiro: boolean;
    condicao_pagamento: string; forma_pagamento: string;
    fornecedor_id: string; cliente_id: string;
    conta_contabil_id: string | null; ordem_venda_id: string | null;
    tipo_operacao?: string; status?: string;
  };
  parcelas: number;
}

export async function confirmarNotaFiscal({ nf, parcelas }: ConfirmarNFParams) {
  // Idempotency: if already confirmed, skip
  const { data: current } = await supabase
    .from("notas_fiscais")
    .select("status")
    .eq("id", nf.id)
    .single();

  if (current?.status === "confirmada") {
    console.warn("[fiscal] NF já confirmada, ignorando duplicidade");
    return;
  }

  const statusAnterior = current?.status || nf.status || "pendente";

  await supabase.from("notas_fiscais").update({
    status: "confirmada",
    status_sefaz: "nao_enviada",
  } as any).eq("id", nf.id);

  const { data: itens } = await supabase
    .from("notas_fiscais_itens")
    .select("*")
    .eq("nota_fiscal_id", nf.id);

  // Stock movements
  if (nf.movimenta_estoque !== false && itens) {
    for (const item of itens) {
      const { data: prod } = await supabase
        .from("produtos")
        .select("estoque_atual")
        .eq("id", item.produto_id)
        .single();
      const saldo_anterior = Number(prod?.estoque_atual || 0);
      const qty = nf.tipo === "entrada" ? item.quantidade : -item.quantidade;
      const saldo_atual = saldo_anterior + qty;
      await supabase.from("estoque_movimentos").insert({
        produto_id: item.produto_id,
        tipo: nf.tipo === "entrada" ? "entrada" : "saida",
        quantidade: item.quantidade,
        saldo_anterior,
        saldo_atual,
        documento_tipo: "fiscal",
        documento_id: nf.id,
      });
      await supabase
        .from("produtos")
        .update({ estoque_atual: saldo_atual })
        .eq("id", item.produto_id);
    }
  }

  // Financial entries
  if (nf.gera_financeiro !== false) {
    const tipo_fin = nf.tipo === "entrada" ? "pagar" : "receber";
    const isAVista = nf.condicao_pagamento === "a_vista";
    const valorFin = Number(nf.valor_total || 0);
    if (isAVista) {
      await supabase.from("financeiro_lancamentos").insert({
        tipo: tipo_fin as any,
        descricao: `NF ${nf.numero}`,
        valor: valorFin,
        data_vencimento: nf.data_emissao,
        data_pagamento: nf.data_emissao,
        status: "pago",
        fornecedor_id: nf.fornecedor_id || null,
        cliente_id: nf.cliente_id || null,
        nota_fiscal_id: nf.id,
        forma_pagamento: nf.forma_pagamento,
        conta_contabil_id: nf.conta_contabil_id || null,
      } as any);
    } else {
      const numParcelas = parcelas || 1;
      for (let i = 0; i < numParcelas; i++) {
        const vencimento = calcularVencimentoParcela(nf.data_emissao, i + 1);
        await supabase.from("financeiro_lancamentos").insert({
          tipo: tipo_fin as any,
          descricao: `NF ${nf.numero} - Parcela ${i + 1}/${numParcelas}`,
          valor: calcularValorParcela(valorFin, numParcelas),
          data_vencimento: vencimento,
          status: "aberto",
          fornecedor_id: nf.fornecedor_id || null,
          cliente_id: nf.cliente_id || null,
          nota_fiscal_id: nf.id,
          forma_pagamento: nf.forma_pagamento,
          parcela_numero: i + 1,
          parcela_total: numParcelas,
          conta_contabil_id: nf.conta_contabil_id || null,
        } as any);
      }
    }
  }

  // Update OV billing
  if (nf.tipo === "saida" && nf.ordem_venda_id) {
    await updateOVFaturamento(nf.ordem_venda_id, itens || []);
  }

  // Register event
  await registrarEventoFiscal({
    nota_fiscal_id: nf.id,
    tipo_evento: "confirmacao",
    status_anterior: statusAnterior,
    status_novo: "confirmada",
    descricao: `NF ${nf.numero} confirmada. Estoque: ${nf.movimenta_estoque !== false ? "sim" : "não"}, Financeiro: ${nf.gera_financeiro !== false ? "sim" : "não"}`,
    payload_resumido: { valor_total: nf.valor_total, parcelas },
  });
}

// ── Reverse NF ─────────────────────────────────────────────────────────────────

export async function estornarNotaFiscal(nf: {
  id: string; numero: string; tipo: string;
  movimenta_estoque: boolean; gera_financeiro: boolean;
  ordem_venda_id: string | null; tipo_operacao?: string;
  status?: string;
}) {
  // Idempotency
  const { data: current } = await supabase
    .from("notas_fiscais")
    .select("status")
    .eq("id", nf.id)
    .single();

  if (current?.status === "cancelada") {
    console.warn("[fiscal] NF já cancelada, ignorando duplicidade");
    return;
  }

  const statusAnterior = current?.status || nf.status || "confirmada";

  // 1. Reverse stock
  if (nf.movimenta_estoque !== false) {
    const { data: movimentos } = await supabase
      .from("estoque_movimentos")
      .select("*")
      .eq("documento_id", nf.id)
      .eq("documento_tipo", "fiscal");
    if (movimentos) {
      for (const mov of movimentos) {
        const { data: prod } = await supabase
          .from("produtos")
          .select("estoque_atual")
          .eq("id", mov.produto_id)
          .single();
        const saldoAtual = Number(prod?.estoque_atual || 0);
        const reversao =
          mov.tipo === "entrada"
            ? -Number(mov.quantidade)
            : Number(mov.quantidade);
        const novoSaldo = saldoAtual + reversao;
        await supabase.from("estoque_movimentos").insert({
          produto_id: mov.produto_id,
          tipo: mov.tipo === "entrada" ? "saida" : "entrada",
          quantidade: Number(mov.quantidade),
          saldo_anterior: saldoAtual,
          saldo_atual: novoSaldo,
          documento_tipo: "estorno_fiscal",
          documento_id: nf.id,
          motivo: `Estorno da NF ${nf.numero}`,
        });
        await supabase
          .from("produtos")
          .update({ estoque_atual: novoSaldo })
          .eq("id", mov.produto_id);
      }
    }
  }

  // 2. Cancel financial entries
  if (nf.gera_financeiro !== false) {
    await supabase
      .from("financeiro_lancamentos")
      .update({ status: "cancelado" })
      .or(`nota_fiscal_id.eq.${nf.id},documento_fiscal_id.eq.${nf.id}`);
  }

  // 3. Reverse OV billing
  if (nf.tipo === "saida" && nf.ordem_venda_id) {
    const { data: nfItens } = await supabase
      .from("notas_fiscais_itens")
      .select("*")
      .eq("nota_fiscal_id", nf.id);
    if (nfItens) {
      const { data: ovItens } = await supabase
        .from("ordens_venda_itens")
        .select("id, produto_id, quantidade_faturada")
        .eq("ordem_venda_id", nf.ordem_venda_id);
      if (ovItens) {
        for (const nfItem of nfItens) {
          const ovItem = ovItens.find(
            (oi: any) => oi.produto_id === nfItem.produto_id
          );
          if (ovItem) {
            const newQtd = Math.max(
              0,
              (ovItem.quantidade_faturada || 0) - nfItem.quantidade
            );
            await supabase
              .from("ordens_venda_itens")
              .update({ quantidade_faturada: newQtd })
              .eq("id", ovItem.id);
          }
        }
        const { data: updatedItems } = await supabase
          .from("ordens_venda_itens")
          .select("quantidade, quantidade_faturada")
          .eq("ordem_venda_id", nf.ordem_venda_id);
        const totalQ = (updatedItems || []).reduce(
          (s: number, i: any) => s + Number(i.quantidade),
          0
        );
        const totalF = (updatedItems || []).reduce(
          (s: number, i: any) => s + Number(i.quantidade_faturada || 0),
          0
        );
        const newSt = calcularStatusFaturamentoOV(totalQ, totalF);
        await supabase
          .from("ordens_venda")
          .update({ status_faturamento: newSt })
          .eq("id", nf.ordem_venda_id);
      }
    }
  }

  // 4. Set NF as cancelled
  await supabase
    .from("notas_fiscais")
    .update({ status: "cancelada", status_sefaz: "nao_enviada" } as any)
    .eq("id", nf.id);

  // Register event
  await registrarEventoFiscal({
    nota_fiscal_id: nf.id,
    tipo_evento: "estorno",
    status_anterior: statusAnterior,
    status_novo: "cancelada",
    descricao: `NF ${nf.numero} estornada. Estoque e financeiro revertidos.`,
  });
}

// ── OV Billing update ──────────────────────────────────────────────────────────

async function updateOVFaturamento(ordemVendaId: string, nfItens: any[]) {
  try {
    const { data: ovItens } = await supabase
      .from("ordens_venda_itens")
      .select("id, produto_id, quantidade, quantidade_faturada")
      .eq("ordem_venda_id", ordemVendaId);
    if (!ovItens) return;
    for (const nfItem of nfItens) {
      const ovItem = ovItens.find(
        (oi: any) => oi.produto_id === nfItem.produto_id
      );
      if (ovItem) {
        await supabase
          .from("ordens_venda_itens")
          .update({
            quantidade_faturada:
              (ovItem.quantidade_faturada || 0) + nfItem.quantidade,
          })
          .eq("id", ovItem.id);
      }
    }
    const { data: updatedItems } = await supabase
      .from("ordens_venda_itens")
      .select("quantidade, quantidade_faturada")
      .eq("ordem_venda_id", ordemVendaId);
    const totalQtd = (updatedItems || []).reduce(
      (s: number, i: any) => s + Number(i.quantidade),
      0
    );
    const totalFaturado = (updatedItems || []).reduce(
      (s: number, i: any) => s + Number(i.quantidade_faturada || 0),
      0
    );
    const newStatus = calcularStatusFaturamentoOV(totalQtd, totalFaturado);
    await supabase
      .from("ordens_venda")
      .update({ status_faturamento: newStatus })
      .eq("id", ordemVendaId);
  } catch (err: any) {
    console.error("Erro ao atualizar faturamento OV:", err);
  }
}

/** Re-exported from `@/lib/fiscal` for backward compatibility. */
export { calcularCfopDevolucao } from "@/lib/fiscal";

// ── Process Return ─────────────────────────────────────────────────────────────

export async function processarDevolucao(params: {
  devolucaoNF: {
    id: string;
    numero: string;
    serie: string;
    cliente_id: string;
    modelo_documento: string;
  };
  itensDevolver: any[];
  dataDevolucao: string;
  motivoDevolucao: string;
}) {
  const { devolucaoNF, itensDevolver, dataDevolucao, motivoDevolucao } = params;
  const valorDevolucao = itensDevolver.reduce(
    (s: number, i: any) => s + i.qtd_devolver * Number(i.valor_unitario),
    0
  );

  const { data: nfDev, error } = await supabase
    .from("notas_fiscais")
    .insert({
      tipo: "entrada",
      tipo_operacao: "devolucao",
      nf_referenciada_id: devolucaoNF.id,
      modelo_documento: devolucaoNF.modelo_documento || "55",
      numero: `DEV-${devolucaoNF.numero}`,
      serie: devolucaoNF.serie,
      data_emissao: dataDevolucao,
      cliente_id: devolucaoNF.cliente_id,
      valor_total: valorDevolucao,
      status: "confirmada",
      movimenta_estoque: true,
      gera_financeiro: false,
      origem: "manual",
      observacoes: `Devolução da NF ${devolucaoNF.numero}. Motivo: ${motivoDevolucao}`,
      ativo: true,
    } as any)
    .select()
    .single();
  if (error) throw error;

  for (const item of itensDevolver) {
    await supabase.from("notas_fiscais_itens").insert({
      nota_fiscal_id: nfDev.id,
      produto_id: item.produto_id,
      quantidade: item.qtd_devolver,
      valor_unitario: item.valor_unitario,
      cfop: item.cfop
        ? item.cfop.replace(/^[0-9]/, (d: string) =>
            String(Number(d) > 4 ? Number(d) - 2 : Number(d) + 2)
          )
        : item.cfop,
    });
    const { data: prod } = await supabase
      .from("produtos")
      .select("estoque_atual")
      .eq("id", item.produto_id)
      .single();
    const saldoAnterior = Number(prod?.estoque_atual || 0);
    const novoEstoque = saldoAnterior + item.qtd_devolver;
    await supabase.from("estoque_movimentos").insert({
      produto_id: item.produto_id,
      tipo: "entrada",
      quantidade: item.qtd_devolver,
      saldo_anterior: saldoAnterior,
      saldo_atual: novoEstoque,
      documento_tipo: "devolucao",
      documento_id: nfDev.id,
      motivo: `Devolução da NF ${devolucaoNF.numero}`,
    });
    await supabase
      .from("produtos")
      .update({ estoque_atual: novoEstoque })
      .eq("id", item.produto_id);
  }

  // Register event
  await registrarEventoFiscal({
    nota_fiscal_id: nfDev.id,
    tipo_evento: "criacao",
    status_novo: "confirmada",
    descricao: `Nota de devolução gerada a partir da NF ${devolucaoNF.numero}. Motivo: ${motivoDevolucao}`,
    payload_resumido: {
      nf_origem_id: devolucaoNF.id,
      valor: valorDevolucao,
      itens: itensDevolver.length,
    },
  });

  return nfDev;
}

// ── Duplicate check ────────────────────────────────────────────────────────────

export async function verificarDuplicidadeChave(
  chaveAcesso: string
): Promise<boolean> {
  if (!chaveAcesso || chaveAcesso.length < 44) return false;
  const { data } = await supabase
    .from("notas_fiscais")
    .select("id")
    .eq("chave_acesso", chaveAcesso)
    .limit(1);
  return (data?.length || 0) > 0;
}
