import { useCallback, useState } from "react";
import { toast } from "sonner";
import { parseConciliacaoWorkbook, type ConciliacaoBundle } from "@/lib/importacao/conciliacaoParser";
import {
  createImportacaoLote,
  insertStagingChunks,
  logImportacao,
  cargaInicialConciliacao,
  cargaInicialProcessarExtras,
  mergeLoteConciliacao,
} from "@/services/importacao.service";

/**
 * Hook orquestrador da CARGA INICIAL DE PRODUÇÃO (insert-only).
 *
 * Lê a planilha de Conciliação, popula staging em uma única transação
 * (1 lote `tipo='conciliacao_carga_inicial'`) e dispara a RPC
 * `carga_inicial_conciliacao` que falha se houver dados pré-existentes.
 *
 * Ordem de inserção (na RPC):
 *   grupos → plano de contas → fornecedores → clientes → produtos+insumos
 *   → produtos_fornecedores → estoque inicial → CR → CP
 * FC permanece apenas como conferência (log).
 */

export interface CargaInicialResumo {
  abasDetectadas: string[];
  abasFaltantes: string[];
  contagens: {
    grupos: number; planoContas: number; sinteticas: number; centrosCusto: number;
    fornecedores: number; clientes: number;
    produtos: number; insumos: number;
    estoque: number; cr: number; cp: number;
    fc: number;
  };
}

export function useCargaInicial() {
  const [file, setFile] = useState<File | null>(null);
  const [bundle, setBundle] = useState<ConciliacaoBundle | null>(null);
  const [resumo, setResumo] = useState<CargaInicialResumo | null>(null);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setBundle(null); setResumo(null); setLoteId(null); setResultado(null);
    try {
      setIsProcessing(true);
      const b = await parseConciliacaoWorkbook(f);
      setBundle(b);
      const grupos = new Set([...b.produtos, ...b.insumos].map(p => p.grupo_nome).filter(Boolean) as string[]);
      setResumo({
        abasDetectadas: b.abasDetectadas,
        abasFaltantes: b.abasFaltantes,
        contagens: {
          grupos: grupos.size,
          planoContas: b.planoContas.length,
          sinteticas: b.sinteticas.length,
          centrosCusto: b.centroCusto.length,
          fornecedores: b.fornecedores.length,
          clientes: b.clientes.length,
          produtos: b.produtos.length,
          insumos: b.insumos.length,
          estoque: b.produtos.filter(p => p.estoque_inicial > 0).length + b.insumos.filter(p => p.estoque_inicial > 0).length,
          cr: b.cr.length, cp: b.cp.length, fc: b.fc.length,
        },
      });
      toast.success(`Planilha lida. ${b.cr.length} CR, ${b.cp.length} CP, ${b.produtos.length + b.insumos.length} itens.`);
    } catch (err) {
      toast.error(`Erro ao ler planilha: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const stageAll = useCallback(async (): Promise<string | null> => {
    if (!bundle) { toast.error("Selecione um arquivo primeiro."); return null; }
    setIsProcessing(true);
    try {
      const grupos = Array.from(new Set([...bundle.produtos, ...bundle.insumos].map(p => p.grupo_nome).filter(Boolean) as string[]));
      const totalReg = grupos.length + bundle.planoContas.length + bundle.fornecedores.length + bundle.clientes.length + bundle.produtos.length + bundle.insumos.length + bundle.cr.length + bundle.cp.length;

      const newLoteId = await createImportacaoLote({
        tipo: "conciliacao_carga_inicial",
        fase: "carga_inicial",
        arquivo_nome: file?.name ?? null,
        total_registros: totalReg,
        resumo: { ...resumo?.contagens },
      });
      setLoteId(newLoteId);

      // stg_cadastros: grupos + plano + fornecedores + clientes + produtos + insumos
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cadRows: any[] = [];
      grupos.forEach(g => cadRows.push({ lote_id: newLoteId, status: "pendente", dados: { _tipo: "grupo", nome: g } }));
      bundle.sinteticas.forEach(s => cadRows.push({ lote_id: newLoteId, status: "pendente", dados: { _tipo: "sintetica", codigo: s.codigo, descricao: s.descricao, nivel: s.nivel, conta_pai_codigo: s.conta_pai_codigo } }));
      bundle.planoContas.forEach(p => cadRows.push({ lote_id: newLoteId, status: "pendente", dados: { _tipo: "plano_conta", codigo: p.codigo, descricao: p.descricao, i_level: p.i_level } }));
      bundle.centroCusto.forEach(c => cadRows.push({ lote_id: newLoteId, status: "pendente", dados: { _tipo: "centro_custo", codigo: c.codigo, descricao: c.descricao, responsavel: c.responsavel } }));
      bundle.fornecedores.forEach(f => cadRows.push({ lote_id: newLoteId, status: "pendente", dados: { _tipo: "fornecedor", ...f } }));
      bundle.clientes.forEach(c => cadRows.push({ lote_id: newLoteId, status: "pendente", dados: { _tipo: "cliente", ...c } }));
      [...bundle.produtos, ...bundle.insumos].forEach(p => cadRows.push({ lote_id: newLoteId, status: "pendente", dados: { _tipo: p.tipo_item, ...p } }));

      await insertStagingChunks("stg_cadastros", cadRows);

      // stg_estoque_inicial
      const estqRows = [...bundle.produtos, ...bundle.insumos]
        .filter(p => p.estoque_inicial > 0)
        .map(p => ({ lote_id: newLoteId, status: "pendente", dados: { codigo_legado_produto: p.codigo_legado, quantidade: p.estoque_inicial } }));
      await insertStagingChunks("stg_estoque_inicial", estqRows);

      // stg_financeiro_aberto: CR + CP
      const finRows = [...bundle.cr, ...bundle.cp].map(r => ({
        lote_id: newLoteId, status: "pendente",
        dados: {
          origem: r.origem, tipo: r.tipo,
          data_emissao: r.data_emissao, data_vencimento: r.data_vencimento, data_pagamento: r.data_pagamento,
          valor: r.valor, valor_pago: r.valor_pago,
          descricao: r.descricao, titulo: r.titulo,
          codigo_legado_pessoa: r.codigo_legado_pessoa, nome_abreviado: r.nome_abreviado,
          forma_pagamento: r.forma_pagamento, banco: r.banco,
          conta_contabil_codigo: r.conta_contabil_codigo,
          parcela_numero: r.parcela_numero, parcela_total: r.parcela_total,
        },
      }));
      await insertStagingChunks("stg_financeiro_aberto", finRows);

      // FC: log de conferência
      await logImportacao(
        newLoteId,
        "info",
        JSON.stringify({ fc_total: bundle.fc.length, primeiros: bundle.fc.slice(0, 5) }),
        "fc_conferencia",
      );

      toast.success(`Staging completo: ${cadRows.length} cadastros, ${estqRows.length} estoque, ${finRows.length} financeiro.`);
      return newLoteId;
    } catch (err) {
      toast.error(`Falha no staging: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally { setIsProcessing(false); }
  }, [bundle, file, resumo]);

  const consolidar = useCallback(async (force = false): Promise<boolean> => {
    if (!loteId) { toast.error("Faça o staging primeiro."); return false; }
    setIsProcessing(true);
    try {
      const r = await cargaInicialConciliacao(loteId, force) as Record<string, unknown> & { erro?: string };
      if (r?.erro) { toast.error(`Bloqueado: ${String(r.erro)}`); setResultado(r); return false; }
      // Processar extras (centros de custo + sintéticas)
      try {
        const extras = await cargaInicialProcessarExtras(loteId);
        if (extras) Object.assign(r as object, { extras });
      } catch (e) {
        console.warn("Falha ao processar extras (centro_custo/sinteticas):", e);
      }
      setResultado(r);
      toast.success(`Carga inicial concluída: ${r.fornecedores} forn, ${r.clientes} cli, ${r.produtos} prod, ${r.insumos} insumos, ${r.cr} CR, ${r.cp} CP.`);
      return true;
    } catch (err) {
      toast.error(`Falha na consolidação: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally { setIsProcessing(false); }
  }, [loteId]);

  /** Modo merge: tolerante a dados existentes — UPSERT por código legado. */
  const consolidarMerge = useCallback(async (): Promise<boolean> => {
    if (!loteId) { toast.error("Faça o staging primeiro."); return false; }
    setIsProcessing(true);
    try {
      const r = await mergeLoteConciliacao(loteId) as Record<string, unknown> & { erro?: string };
      if (r?.erro) { toast.error(`Erro: ${String(r.erro)}`); setResultado(r); return false; }
      setResultado(r);
      toast.success(
        `Merge concluído: ${r.inseridos} novos, ${r.atualizados} atualizados, ${r.estoque} ajustes de estoque, ${r.duplicados} duplicados.`,
      );
      return true;
    } catch (err) {
      toast.error(`Falha no merge: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally { setIsProcessing(false); }
  }, [loteId]);

  return { file, bundle, resumo, loteId, resultado, isProcessing, onFileChange, stageAll, consolidar, consolidarMerge };
}
