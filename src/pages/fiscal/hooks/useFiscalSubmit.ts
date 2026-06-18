import { toast } from "sonner";
import { notifyError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import {
  registrarEventoFiscal,
  upsertNotaFiscalComItens,
} from "@/services/fiscal.service";
import {
  gerarFinanceiroNfeEntrada,
  gerarFinanceiroNfeSaida,
  atualizarFinanceiroNota,
} from "@/services/fiscal/lifecycle.service";
import { INVALIDATION_KEYS } from "@/services/_invalidationKeys";
import { isFiscalStructurallyLocked } from "@/lib/fiscalStatus";
import type { NotaFiscal } from "@/types/domain";
import type { GridItem } from "@/components/ui/ItemsGrid";
import type {
  FiscalFormState as FiscalForm,
  NfItemFiscalData,
} from "@/pages/fiscal/hooks/useFiscalNotaForm";
import type { ParcelaPlano } from "@/pages/fiscal/components/ParcelasFiscalEditor";
import type { TraducaoLinha } from "@/pages/fiscal/hooks/useNFeXmlImport";
import type { useConfirmarNotaFiscal } from "@/pages/fiscal/hooks/useNotaFiscalLifecycle";
import type { useInvalidateAfterMutation } from "@/hooks/useInvalidateAfterMutation";

type ConfirmarMutation = ReturnType<typeof useConfirmarNotaFiscal>;
type InvalidateFn = ReturnType<typeof useInvalidateAfterMutation>;

export type XmlOriginInfo = {
  fornecedorId: string;
  fornecedorNome: string;
  clienteId?: string;
  clienteNome?: string;
  tipo?: "entrada" | "saida";
  cobranca?: import("@/lib/nfeXmlParser").NFeCobranca;
} | null;

export interface UseFiscalSubmitArgs {
  // Estado do form/itens.
  form: FiscalForm;
  items: GridItem[];
  mode: "create" | "edit";
  selected: NotaFiscal | null;
  parcelas: number;
  parcelasPlano: ParcelaPlano[];
  totalNF: number;
  valorProdutos: number;
  itemContaContabil: Record<number, string>;
  itemFiscalData: Record<number, NfItemFiscalData>;
  traducaoLinhas: TraducaoLinha[];
  xmlOriginInfo: XmlOriginInfo;
  // Permissões e infra.
  canEditAvancado: boolean;
  confirmarMutation: ConfirmarMutation;
  invalidate: InvalidateFn;
  // Setters / efeitos.
  setSaving: (b: boolean) => void;
  setModalOpen: (open: boolean) => void;
  fetchData: () => void;
}

/**
 * Extrai o `handleSubmit` da página Fiscal (Etapa 6.3).
 *
 * Mantém intacta a árvore de decisão original:
 *  - Atalho de edição privilegiada em NF estruturalmente travada → apenas
 *    `atualizarFinanceiroNota`.
 *  - `upsertNotaFiscalComItens` (RPC canônica) + `registrarEventoFiscal`.
 *  - Geração de financeiro condicional (XML entrada/saída, cartão, manual)
 *    seguida de auto-confirmação quando a condição financeira está completa.
 *  - Cobrança recorrente (NF de entrada) usando `criarRecorrenciaParaNfe`.
 *  - Pós-edição admin: `atualizarFinanceiroNota` quando travada e gera_financeiro.
 *
 * Nada de comportamento muda — só sai do god-component para um hook testável.
 */
export function useFiscalSubmit(args: UseFiscalSubmitArgs) {
  const {
    form, items, mode, selected, parcelas, parcelasPlano,
    totalNF, valorProdutos, itemContaContabil, itemFiscalData,
    traducaoLinhas, xmlOriginInfo,
    canEditAvancado, confirmarMutation, invalidate,
    setSaving, setModalOpen, fetchData,
  } = args;

  const buildNfItemsPayload = (nfId: string) => items.map((i, idx) => {
    if (!i.produto_id) {
      throw new Error(`Item ${idx + 1} sem vínculo de produto. Vincule todos os itens antes de salvar.`);
    }
    const fiscal = itemFiscalData[idx] || {};
    const traducao = traducaoLinhas.find((t) => t.index === idx);
    const td = (form as unknown as { tipo_documento?: string }).tipo_documento;
    const categoria = td === "nfse" ? "servico" : td === "cte" ? "frete" : "produto";
    return {
      nota_fiscal_id: nfId,
      produto_id: i.produto_id,
      categoria,
      quantidade: i.quantidade,
      valor_unitario: i.valor_unitario,
      conta_contabil_id: itemContaContabil[idx] || null,
      cfop: fiscal.cfop ?? null,
      cst: fiscal.cst ?? null,
      ncm: fiscal.ncm ?? null,
      unidade: fiscal.unidade ?? null,
      descricao: fiscal.descricao ?? i.descricao ?? null,
      icms_valor: fiscal.icms_valor ?? null,
      icms_aliquota: fiscal.icms_aliquota ?? null,
      icms_base: fiscal.icms_base ?? null,
      ipi_valor: fiscal.ipi_valor ?? null,
      ipi_aliquota: fiscal.ipi_aliquota ?? null,
      pis_valor: fiscal.pis_valor ?? null,
      pis_aliquota: fiscal.pis_aliquota ?? null,
      base_pis: fiscal.base_pis ?? null,
      cofins_valor: fiscal.cofins_valor ?? null,
      cofins_aliquota: fiscal.cofins_aliquota ?? null,
      base_cofins: fiscal.base_cofins ?? null,
      valor_st: fiscal.valor_st ?? null,
      base_st: fiscal.base_st ?? null,
      csosn: fiscal.csosn ?? null,
      cst_pis: fiscal.cst_pis ?? null,
      cst_cofins: fiscal.cst_cofins ?? null,
      cst_ipi: fiscal.cst_ipi ?? null,
      desconto: fiscal.desconto ?? null,
      codigo_produto: fiscal.codigo_produto ?? i.codigo ?? null,
      codigo_produto_origem: traducao?.xmlCodigo ?? null,
      descricao_produto_origem: traducao?.xmlDescricao ?? null,
      unidade_origem: traducao?.xmlUnidade ?? null,
      quantidade_origem: traducao?.xmlQuantidade ?? null,
      valor_unitario_origem: traducao?.xmlValorUnitario ?? null,
      valor_total_origem: traducao?.xmlValorTotal ?? null,
      match_status: traducao ? (traducao.matchStatus || null) : null,
    };
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numero) { toast.error("Número é obrigatório"); return; }
    if (form.tipo === "entrada" && !form.fornecedor_id) { toast.error("Fornecedor é obrigatório para notas de entrada"); return; }
    if (form.tipo === "saida" && !form.cliente_id) { toast.error("Cliente é obrigatório para notas de saída"); return; }
    if (form.forma_pagamento === "cartao_credito" && !form.cartao_id) {
      toast.error("Selecione o cartão de crédito.");
      return;
    }
    // NF estruturalmente travada (confirmada/importada): só pagamento é editável.
    // Exceção: Admin/Financeiro com edição privilegiada pulam este atalho.
    if (
      mode === "edit" &&
      selected &&
      !canEditAvancado &&
      isFiscalStructurallyLocked(selected.status, (selected as { status_sefaz?: string }).status_sefaz)
    ) {
      setSaving(true);
      try {
        const total = totalNF || form.valor_total || Number(selected.valor_total || 0);
        const planoFinal =
          form.condicao_pagamento === "a_prazo" && parcelas > 1
            ? (parcelasPlano.length === parcelas ? parcelasPlano : [])
            : [{
                numero: 1,
                vencimento: form.condicao_pagamento === "a_prazo"
                  ? (form.data_vencimento || selected.data_emissao || new Date().toISOString().split("T")[0])
                  : (selected.data_emissao || new Date().toISOString().split("T")[0]),
                valor: total,
              }];
        if (form.condicao_pagamento === "a_prazo" && parcelas > 1 && planoFinal.length !== parcelas) {
          toast.error("Defina o plano de parcelas antes de salvar.");
          setSaving(false);
          return;
        }
        await atualizarFinanceiroNota({
          notaId: selected.id,
          formaPagamento: form.forma_pagamento,
          condicaoPagamento: form.condicao_pagamento,
          parcelas: planoFinal as never,
        });
        toast.success("Pagamento atualizado e lançamentos regenerados.");
        setModalOpen(false);
        await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
      } catch (err) {
        notifyError(err);
      } finally {
        setSaving(false);
      }
      return;
    }
    const unlinkedCount = items.filter(i => !i.produto_id).length;
    if (unlinkedCount > 0) {
      toast.error(`${unlinkedCount} item(ns) sem produto vinculado. Vincule todos os itens ou remova-os antes de salvar.`);
      return;
    }
    setSaving(true);
    try {
      const savedTotal = totalNF || form.valor_total;
      const recorrente = Boolean((form as Record<string, unknown>).recorrente);
      if (recorrente) {
        if (form.tipo !== "entrada") {
          toast.error("Cobrança recorrente disponível apenas para NF de entrada.");
          setSaving(false);
          return;
        }
        if (!(form as Record<string, unknown>).recorrencia_data_inicio) {
          toast.error("Informe a data de início da recorrência.");
          setSaving(false);
          return;
        }
      }
      const planoParcelas =
        !recorrente && form.condicao_pagamento === "a_prazo" && parcelas > 1
          ? parcelasPlano
          : null;
      const chaveLimpa = (form.chave_acesso || "").replace(/\D/g, "");
      const formAny = form as Record<string, unknown>;
      const {
        recorrente: _r1,
        recorrencia_periodicidade: _r2,
        recorrencia_dia_vencimento: _r3,
        recorrencia_data_inicio: _r4,
        recorrencia_data_fim: _r5,
        recorrencia_qtd_ciclos: _r6,
        recorrencia_encerramento: _r7,
        ...formForPayload
      } = formAny;
      void _r1; void _r2; void _r3; void _r4; void _r5; void _r6; void _r7;
      const payload = {
        ...(formForPayload as typeof form),
        fornecedor_id: form.fornecedor_id || null,
        cliente_id: form.cliente_id || null,
        ordem_venda_id: form.ordem_venda_id || null,
        conta_contabil_id: form.conta_contabil_id || null,
        cartao_id: form.cartao_id || null,
        chave_acesso: chaveLimpa.length === 44 ? chaveLimpa : null,
        valor_total: savedTotal,
        valor_produtos: valorProdutos,
        parcelas: planoParcelas,
      };
      const nfId = await upsertNotaFiscalComItens({
        mode: mode === "create" ? "create" : "edit",
        nfId: selected?.id,
        payload: payload as never,
        itemsBuilder: (id) => buildNfItemsPayload(id) as never,
      });
      if (mode === "create") {
        await registrarEventoFiscal({
          nota_fiscal_id: nfId,
          tipo_evento: form.origem === "xml_importado" ? "importacao_xml" : "criacao",
          status_novo: "pendente",
          descricao: form.origem === "xml_importado"
            ? `NF ${form.numero} criada via importação de XML.`
            : `NF ${form.numero} criada manualmente.`,
          payload_resumido: { valor_total: savedTotal, itens: items.length },
        });
        if (recorrente) {
          try {
            const { criarRecorrenciaParaNfe } = await import("@/services/recorrencias.service");
            const encerramento = String(formAny.recorrencia_encerramento || "indeterminado");
            await criarRecorrenciaParaNfe({
              nfeId: nfId,
              payload: {
                tipo: "pagar",
                descricao: `NF ${form.numero} — recorrência`,
                valor: savedTotal,
                periodicidade: String(formAny.recorrencia_periodicidade || "mensal") as "mensal" | "bimestral" | "trimestral" | "semestral" | "anual",
                dia_vencimento:
                  form.forma_pagamento === "cartao_credito"
                    ? null
                    : (Number(formAny.recorrencia_dia_vencimento) || null),
                data_inicio: String(formAny.recorrencia_data_inicio),
                proxima_geracao: String(formAny.recorrencia_data_inicio),
                data_fim: encerramento === "data" ? String(formAny.recorrencia_data_fim) : null,
                qtd_ciclos_max: encerramento === "qtd" ? Number(formAny.recorrencia_qtd_ciclos) : null,
                status: "ativa",
                forma_pagamento: String(form.forma_pagamento || "") || null,
                cartao_id: form.cartao_id || null,
                fornecedor_id: form.fornecedor_id || null,
                conta_contabil_id: form.conta_contabil_id || null,
                observacoes: `Gerado a partir da NF ${form.numero}`,
              },
            });
            toast.success("Recorrência criada — 1º ciclo lançado no financeiro.");
            try {
              await confirmarMutation.mutateAsync({
                nfId,
                tipoDocumento:
                  ((form as unknown as { tipo_documento?: "nfe" | "nfse" | "cte" })
                    .tipo_documento) ?? "nfe",
              });
              await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
            } catch (confErr) {
              logger.error("[fiscal] auto-confirmar NF recorrente:", confErr);
            }
          } catch (recErr) {
            logger.error("[fiscal] criar recorrência da NF:", recErr);
            toast.warning("NF salva, mas houve falha ao criar a recorrência. Verifique manualmente.");
          }
          setModalOpen(false); fetchData(); setSaving(false); return;
        }
        let financeiroOk: boolean | null = null;
        let financeiroMotivo = "";
        if (
          form.tipo === "entrada" &&
          form.origem === "xml_importado" &&
          xmlOriginInfo?.cobranca?.duplicatas?.length
        ) {
          try {
            const { mapTPagSefaz } = await import("@/lib/financeiro");
            const formaPag = xmlOriginInfo.cobranca.tPag
              ? mapTPagSefaz(xmlOriginInfo.cobranca.tPag)
              : "boleto_dda";
            await gerarFinanceiroNfeEntrada(
              nfId,
              xmlOriginInfo.cobranca.duplicatas.map((d) => ({
                numero: d.numero,
                vencimento: d.vencimento,
                valor: d.valor,
              })),
              formaPag,
              form.cartao_id || null,
            );
            toast.success(`${xmlOriginInfo.cobranca.duplicatas.length} parcela(s) gerada(s) em Contas a Pagar.`);
            financeiroOk = true;
          } catch (rpcErr) {
            logger.error("[fiscal] gerar financeiro NFe:", rpcErr);
            toast.warning("NF salva, mas houve falha ao gerar parcelas no financeiro. Lance manualmente.");
            financeiroOk = false;
            financeiroMotivo = "falha ao gerar parcelas do XML";
          }
        } else if (
          form.tipo === "entrada" &&
          form.origem === "xml_importado" &&
          !xmlOriginInfo?.cobranca?.duplicatas?.length
        ) {
          toast.info("XML sem duplicatas/condição financeira clara — informe a condição manualmente.");
          financeiroOk = false;
          financeiroMotivo = "XML sem duplicatas — informe forma/condição";
        } else if (
          form.tipo === "saida" &&
          form.origem === "xml_importado" &&
          xmlOriginInfo?.cobranca?.duplicatas?.length
        ) {
          try {
            const { mapTPagSefaz } = await import("@/lib/financeiro");
            const formaPag = xmlOriginInfo.cobranca.tPag
              ? mapTPagSefaz(xmlOriginInfo.cobranca.tPag)
              : "boleto";
            await gerarFinanceiroNfeSaida(
              nfId,
              xmlOriginInfo.cobranca.duplicatas.map((d) => ({
                numero: d.numero,
                vencimento: d.vencimento,
                valor: d.valor,
              })),
              formaPag,
            );
            toast.success(`${xmlOriginInfo.cobranca.duplicatas.length} parcela(s) gerada(s) em Contas a Receber.`);
            financeiroOk = true;
          } catch (rpcErr) {
            logger.error("[fiscal] gerar financeiro NFe saida:", rpcErr);
            toast.warning("NF salva, mas houve falha ao gerar parcelas a receber. Lance manualmente.");
            financeiroOk = false;
            financeiroMotivo = "falha ao gerar parcelas a receber";
          }
        } else if (
          form.tipo === "saida" &&
          form.origem === "xml_importado" &&
          !xmlOriginInfo?.cobranca?.duplicatas?.length
        ) {
          toast.info("XML sem duplicatas — informe a condição financeira manualmente.");
          financeiroOk = false;
          financeiroMotivo = "XML sem duplicatas — informe forma/condição";
        } else if (
          form.tipo === "entrada" &&
          form.gera_financeiro &&
          form.forma_pagamento === "cartao_credito" &&
          form.cartao_id
        ) {
          const duplicatas =
            form.condicao_pagamento === "a_prazo" && parcelasPlano.length > 0
              ? parcelasPlano.map((p, i) => ({
                  numero: String(i + 1),
                  vencimento: p.vencimento,
                  valor: p.valor,
                }))
              : [{ numero: "1", vencimento: form.data_emissao, valor: savedTotal }];
          try {
            await gerarFinanceiroNfeEntrada(
              nfId,
              duplicatas,
              "cartao_credito",
              form.cartao_id,
            );
            toast.success(`${duplicatas.length} parcela(s) lançada(s) na fatura do cartão.`);
            financeiroOk = true;
          } catch (rpcErr) {
            logger.error("[fiscal] gerar financeiro cartao:", rpcErr);
            toast.warning("NF salva, mas houve falha ao gerar parcelas no cartão.");
            financeiroOk = false;
            financeiroMotivo = "falha ao gerar parcelas do cartão";
          }
        }

        if (financeiroOk === null) {
          if (!form.gera_financeiro) {
            financeiroOk = true;
          } else if (!form.forma_pagamento) {
            financeiroOk = false;
            financeiroMotivo = "forma de pagamento não informada";
          } else if (form.condicao_pagamento === "a_vista") {
            financeiroOk = true;
          } else if (form.condicao_pagamento === "a_prazo") {
            if (parcelas > 1 && parcelasPlano.length !== parcelas) {
              financeiroOk = false;
              financeiroMotivo = "plano de parcelas incompleto";
            } else {
              financeiroOk = true;
            }
          } else {
            financeiroOk = false;
            financeiroMotivo = "condição de pagamento não informada";
          }
        }

        if (financeiroOk) {
          try {
            await confirmarMutation.mutateAsync({
              nfId,
              tipoDocumento:
                ((form as unknown as { tipo_documento?: "nfe" | "nfse" | "cte" })
                  .tipo_documento) ?? "nfe",
            });
            toast.success("Nota fiscal salva e confirmada! Estoque e financeiro atualizados.");
            await invalidate(INVALIDATION_KEYS.fiscalLifecycle);
          } catch (confirmErr) {
            logger.error("[fiscal] auto-confirmar NF:", confirmErr);
            toast.warning("NF salva, mas a confirmação automática falhou. Use 'Concluir lançamento' para finalizar.");
          }
        } else {
          toast.warning(`NF salva como pendente — ${financeiroMotivo || "complete a condição financeira"} e use 'Concluir lançamento'.`);
        }
      } else if (selected) {
        await registrarEventoFiscal({
          nota_fiscal_id: selected.id,
          tipo_evento: "edicao",
          descricao: `NF ${form.numero} editada. Novo total: R$ ${savedTotal.toFixed(2)}.`,
          payload_resumido: { valor_total: savedTotal, itens: items.length },
        });
        const wasLocked = isFiscalStructurallyLocked(
          selected.status,
          (selected as { status_sefaz?: string }).status_sefaz,
        );
        if (canEditAvancado && wasLocked && form.gera_financeiro) {
          try {
            const totalRegen = savedTotal;
            const planoFinal =
              form.condicao_pagamento === "a_prazo" && parcelas > 1
                ? (parcelasPlano.length === parcelas ? parcelasPlano : [])
                : [{
                    numero: 1,
                    vencimento: form.condicao_pagamento === "a_prazo"
                      ? (form.data_vencimento || form.data_emissao || selected.data_emissao || new Date().toISOString().split("T")[0])
                      : (form.data_emissao || selected.data_emissao || new Date().toISOString().split("T")[0]),
                    valor: totalRegen,
                  }];
            if (form.condicao_pagamento === "a_prazo" && parcelas > 1 && planoFinal.length !== parcelas) {
              toast.warning("NF salva, mas o plano de parcelas está incompleto — financeiro não foi regenerado.");
            } else {
              await atualizarFinanceiroNota({
                notaId: selected.id,
                formaPagamento: form.forma_pagamento,
                condicaoPagamento: form.condicao_pagamento,
                parcelas: planoFinal as never,
              });
              toast.success("Nota fiscal salva e lançamentos financeiros regenerados.");
            }
          } catch (regenErr) {
            logger.error("[fiscal] regenerar financeiro pós-edição admin:", regenErr);
            toast.warning("NF salva, mas houve falha ao regenerar os lançamentos. Revise o financeiro vinculado.");
          }
        } else {
          toast.success("Nota fiscal salva!");
        }
      }
      setModalOpen(false); fetchData();
    } catch (err: unknown) { logger.error('[fiscal] salvar NF:', err); notifyError(err); }
    setSaving(false);
  };

  return { handleSubmit, buildNfItemsPayload };
}