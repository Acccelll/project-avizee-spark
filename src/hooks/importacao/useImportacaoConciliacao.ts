import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  parseConciliacaoWorkbook,
  type ConciliacaoBundle,
  type FinanceiroConciliacaoRow,
  type FCRow,
  type PlanoContasRow,
  normalizeNomeMatch,
} from "@/lib/importacao/conciliacaoParser";

/**
 * Hook do fluxo "Conciliação / Financeiro".
 *
 * Lê a planilha `Conciliação_FluxoCaixa 2026.xlsx`, monta preview unificado
 * (CR/CP/FOPAG/Plano de Contas/FC/Pendências), grava em staging e dispara as
 * RPCs `consolidar_lote_enriquecimento` (plano de contas) e
 * `consolidar_lote_financeiro` (CR/CP/FOPAG com dedup determinístico).
 *
 * FC nunca vira lançamento — vai só para `importacao_logs` como conferência.
 */

export type MatchVia = "codigo_legado" | "cpf_cnpj" | "nome" | "pendente";

export interface PreviewFinanceiroLinha extends FinanceiroConciliacaoRow {
  _valid: boolean;
  _errors: string[];
  _warnings: string[];
  _match: MatchVia;
  _entity_id: string | null;
  _duplicado: boolean;
}

export interface PreviewPlanoLinha extends PlanoContasRow {
  _action: "criar" | "atualizar" | "ignorar";
}

export interface ReconciliacaoFC {
  totalFC: number;
  totalDerivado: number;
  divergencias: number;
  detalhes: Array<{
    fc: FCRow;
    encontrado: boolean;
    divergencia?: string;
  }>;
}

export interface PreviewConciliacaoBundle {
  cr: PreviewFinanceiroLinha[];
  cp: PreviewFinanceiroLinha[];
  fopag: PreviewFinanceiroLinha[];
  plano: PreviewPlanoLinha[];
  fc: FCRow[];
  reconciliacao: ReconciliacaoFC;
  abasDetectadas: string[];
  abasFaltantes: string[];
  resumo: {
    total: number;
    validos: number;
    pendentes: number;
    duplicados: number;
    erros: number;
  };
}

export function useImportacaoConciliacao() {
  const [file, setFile] = useState<File | null>(null);
  const [bundle, setBundle] = useState<ConciliacaoBundle | null>(null);
  const [preview, setPreview] = useState<PreviewConciliacaoBundle | null>(null);
  const [loteId, setLoteId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setBundle(null);
    setPreview(null);
    setLoteId(null);
    try {
      setIsProcessing(true);
      const b = await parseConciliacaoWorkbook(f);
      setBundle(b);
      const tot = b.cr.length + b.cp.length + b.fopag.length;
      toast.success(
        `Planilha lida: ${b.cr.length} CR, ${b.cp.length} CP, ${b.fopag.length} FOPAG, ${b.planoContas.length} contas, ${b.fc.length} FC (total ${tot} títulos).`,
      );
      if (b.abasFaltantes.length) {
        toast.warning(`Abas não encontradas: ${b.abasFaltantes.join(", ")}`);
      }
    } catch (err) {
      toast.error(`Erro ao ler planilha: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const generatePreview = useCallback(async () => {
    if (!bundle) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }
    setIsProcessing(true);
    try {
      // Carrega cadastros existentes
      const [{ data: clientes }, { data: fornecedores }, { data: contas }] = await Promise.all([
        supabase.from("clientes").select("id, nome_razao_social, nome_fantasia, cpf_cnpj, codigo_legado").eq("ativo", true),
        supabase.from("fornecedores").select("id, nome_razao_social, nome_fantasia, cpf_cnpj, codigo_legado").eq("ativo", true),
        supabase.from("contas_contabeis").select("id, codigo, descricao").eq("ativo", true),
      ]);

      // Índices em memória (inclui clientes/fornecedores da planilha como apoio
      // para resolver CPF/CNPJ a partir de código quando o cadastro real não existir ainda)
      const auxByLegadoCli = new Map(bundle.clientes.map((p) => [p.codigo_legado, p]));
      const auxByLegadoForn = new Map(bundle.fornecedores.map((p) => [p.codigo_legado, p]));

      const cliByLegado = new Map((clientes ?? []).filter((c) => c.codigo_legado).map((c) => [String(c.codigo_legado), c]));
      const cliByCpf = new Map((clientes ?? []).filter((c) => c.cpf_cnpj).map((c) => [String(c.cpf_cnpj), c]));
      const cliByNome = new Map<string, { id: string; count: number }>();
      (clientes ?? []).forEach((c) => {
        for (const n of [c.nome_razao_social, c.nome_fantasia]) {
          if (!n) continue;
          const key = normalizeNomeMatch(n);
          const cur = cliByNome.get(key);
          cliByNome.set(key, { id: c.id, count: (cur?.count ?? 0) + 1 });
        }
      });

      const fornByLegado = new Map((fornecedores ?? []).filter((f) => f.codigo_legado).map((f) => [String(f.codigo_legado), f]));
      const fornByCpf = new Map((fornecedores ?? []).filter((f) => f.cpf_cnpj).map((f) => [String(f.cpf_cnpj), f]));
      const fornByNome = new Map<string, { id: string; count: number }>();
      (fornecedores ?? []).forEach((f) => {
        for (const n of [f.nome_razao_social, f.nome_fantasia]) {
          if (!n) continue;
          const key = normalizeNomeMatch(n);
          const cur = fornByNome.get(key);
          fornByNome.set(key, { id: f.id, count: (cur?.count ?? 0) + 1 });
        }
      });

      const contasByCodigo = new Map((contas ?? []).map((c) => [c.codigo, c]));

      const dedupKeys = new Set<string>();
      const dedupKey = (r: FinanceiroConciliacaoRow, entityId: string | null) =>
        [r.tipo, r.data_vencimento, r.valor.toFixed(2), entityId ?? "", r.titulo ?? ""].join("|");

      const enrich = (rows: FinanceiroConciliacaoRow[]): PreviewFinanceiroLinha[] => {
        return rows.map((r) => {
          const errors: string[] = [];
          const warnings: string[] = [];

          if (!r.data_vencimento && r.origem !== "FOPAG") errors.push("Sem data de vencimento.");
          if (r.valor <= 0) errors.push("Valor inválido (zero ou negativo).");

          // Resolução de pessoa
          let entityId: string | null = null;
          let matchVia: MatchVia = "pendente";
          const isCli = r.tipo === "receber";
          const byLegado = isCli ? cliByLegado : fornByLegado;
          const byCpf = isCli ? cliByCpf : fornByCpf;
          const byNome = isCli ? cliByNome : fornByNome;
          const auxByLegado = isCli ? auxByLegadoCli : auxByLegadoForn;

          if (r.codigo_legado_pessoa) {
            const found = byLegado.get(r.codigo_legado_pessoa);
            if (found) {
              entityId = found.id;
              matchVia = "codigo_legado";
            }
          }
          // Se não achou por código direto, tenta resolver CPF/CNPJ via aba auxiliar da planilha
          if (!entityId && r.codigo_legado_pessoa) {
            const aux = auxByLegado.get(r.codigo_legado_pessoa);
            if (aux?.cpf_cnpj) {
              const found = byCpf.get(aux.cpf_cnpj);
              if (found) {
                entityId = found.id;
                matchVia = "cpf_cnpj";
              }
            }
          }
          if (!entityId && r.nome_abreviado) {
            const key = normalizeNomeMatch(r.nome_abreviado);
            const found = byNome.get(key);
            if (found && found.count === 1) {
              entityId = found.id;
              matchVia = "nome";
            }
          }

          if (!entityId && r.origem !== "FOPAG") {
            warnings.push(
              `Pessoa não vinculada (cod: ${r.codigo_legado_pessoa ?? "—"}, nome: ${r.nome_abreviado ?? "—"}).`,
            );
          }

          // Conta contábil
          if (r.conta_contabil_codigo && !contasByCodigo.has(r.conta_contabil_codigo)) {
            warnings.push(`Conta contábil ${r.conta_contabil_codigo} será criada/sincronizada.`);
          }

          // Dedup determinístico (no escopo do próprio lote)
          const k = dedupKey(r, entityId);
          const duplicado = dedupKeys.has(k);
          if (duplicado) warnings.push("Linha equivalente já apareceu antes neste lote.");
          dedupKeys.add(k);

          return {
            ...r,
            _valid: errors.length === 0,
            _errors: errors,
            _warnings: warnings,
            _match: matchVia,
            _entity_id: entityId,
            _duplicado: duplicado,
          };
        });
      };

      const cr = enrich(bundle.cr);
      const cp = enrich(bundle.cp);
      const fopag = enrich(bundle.fopag);

      // Plano de contas: criar se não existir
      const plano: PreviewPlanoLinha[] = bundle.planoContas.map((p) => ({
        ...p,
        _action: contasByCodigo.has(p.codigo) ? "atualizar" : "criar",
      }));

      // Reconciliação FC
      const consolidados = [...cr, ...cp, ...fopag].filter((x) => x._valid && !x._duplicado);
      const derivKey = (tipo: string | null, venc: string | null, valor: number) =>
        `${tipo ?? ""}|${venc ?? ""}|${valor.toFixed(2)}`;
      const derivIndex = new Set(consolidados.map((c) => derivKey(c.tipo, c.data_vencimento, c.valor)));

      const detalhes = bundle.fc.map((fc) => {
        const k = derivKey(fc.tipo, fc.data_vencimento, fc.valor);
        return {
          fc,
          encontrado: derivIndex.has(k),
          divergencia: derivIndex.has(k) ? undefined : "Sem correspondente em CR/CP/FOPAG",
        };
      });
      const divergencias = detalhes.filter((d) => !d.encontrado).length;

      const all = [...cr, ...cp, ...fopag];
      const resumo = {
        total: all.length,
        validos: all.filter((x) => x._valid).length,
        pendentes: all.filter((x) => x._match === "pendente" && x.origem !== "FOPAG").length,
        duplicados: all.filter((x) => x._duplicado).length,
        erros: all.filter((x) => !x._valid).length,
      };

      const out: PreviewConciliacaoBundle = {
        cr,
        cp,
        fopag,
        plano,
        fc: bundle.fc,
        reconciliacao: { totalFC: bundle.fc.length, totalDerivado: consolidados.length, divergencias, detalhes },
        abasDetectadas: bundle.abasDetectadas,
        abasFaltantes: bundle.abasFaltantes,
        resumo,
      };
      setPreview(out);
      toast.success("Prévia gerada.");
    } catch (err) {
      toast.error(`Erro ao gerar prévia: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [bundle]);

  const processImport = useCallback(async (): Promise<string | null> => {
    if (!preview) {
      toast.error("Gere a prévia primeiro.");
      return null;
    }
    setIsProcessing(true);
    try {
      const { data: user } = await supabase.auth.getUser();

      // Cria 1 lote consolidado
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: "conciliacao_financeiro",
          fase: "conciliacao",
          status: "staging",
          arquivo_nome: file?.name ?? null,
          total_registros: preview.resumo.total + preview.plano.length,
          registros_sucesso: 0,
          registros_erro: preview.resumo.erros,
          usuario_id: user?.user?.id ?? null,
          resumo: {
            cr: preview.cr.length,
            cp: preview.cp.length,
            fopag: preview.fopag.length,
            plano_contas: preview.plano.length,
            fc_total: preview.fc.length,
            fc_divergencias: preview.reconciliacao.divergencias,
            pendencias_vinculo: preview.resumo.pendentes,
            duplicados_estimados: preview.resumo.duplicados,
          },
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const newLoteId = lote.id;
      setLoteId(newLoteId);

      // Staging financeiro (CR + CP + FOPAG válidos)
      const all = [...preview.cr, ...preview.cp, ...preview.fopag].filter((x) => x._valid && !x._duplicado);
      const stgRows = all.map((r) => ({
        lote_id: newLoteId,
        status: "pendente",
        dados: {
          origem: r.origem,
          tipo: r.tipo,
          data_emissao: r.data_emissao,
          data_vencimento: r.data_vencimento,
          data_pagamento: r.data_pagamento,
          valor: r.valor,
          valor_pago: r.valor_pago,
          descricao: r.descricao,
          titulo: r.titulo,
          parcela_numero: r.parcela_numero,
          parcela_total: r.parcela_total,
          forma_pagamento: r.forma_pagamento,
          banco: r.banco,
          conta_contabil_codigo: r.conta_contabil_codigo,
          codigo_legado_pessoa: r.codigo_legado_pessoa,
          nome_abreviado: r.nome_abreviado,
          pmv_pmp: r.pmv_pmp,
          socio: r.socio,
          observacoes: null,
        },
      }));
      for (let i = 0; i < stgRows.length; i += 500) {
        const chunk = stgRows.slice(i, i + 500);
        const { error } = await supabase.from("stg_financeiro_aberto").insert(chunk);
        if (error) throw error;
      }

      // Staging plano de contas (via stg_cadastros + _tipo_enriquecimento)
      const planoRows = preview.plano.map((p) => ({
        lote_id: newLoteId,
        status: "pendente",
        dados: {
          _tipo_enriquecimento: "contas_contabeis",
          codigo: p.codigo,
          descricao: p.descricao,
          natureza: null,
          aceita_lancamento: true,
          i_level: p.i_level,
        },
      }));
      if (planoRows.length) {
        for (let i = 0; i < planoRows.length; i += 500) {
          const chunk = planoRows.slice(i, i + 500);
          const { error } = await supabase.from("stg_cadastros").insert(chunk);
          if (error) throw error;
        }
      }

      // FC e Centro de Custo: apenas log
      await supabase.from("importacao_logs").insert({
        lote_id: newLoteId,
        nivel: "info",
        etapa: "conciliacao_fc",
        mensagem: JSON.stringify({
          fc_total: preview.fc.length,
          divergencias: preview.reconciliacao.divergencias,
          consolidado_derivado: preview.reconciliacao.totalDerivado,
        }),
      });

      toast.success(
        `Lote staged: ${stgRows.length} títulos + ${planoRows.length} contas. FC: ${preview.fc.length} (${preview.reconciliacao.divergencias} divergências).`,
      );
      return newLoteId;
    } catch (err) {
      toast.error(`Erro no staging: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [preview, file]);

  const finalizeImport = useCallback(
    async (loteIdParam?: string): Promise<boolean> => {
      const target = loteIdParam ?? loteId;
      if (!target) {
        toast.error("Lote não definido.");
        return false;
      }
      setIsProcessing(true);
      try {
        // 1) Plano de contas via consolidar_lote_enriquecimento
        const { error: errEnr } = await supabase.rpc("consolidar_lote_enriquecimento", { p_lote_id: target });
        if (errEnr) throw errEnr;

        // 2) Financeiro
        const { data, error } = await supabase.rpc("consolidar_lote_financeiro", { p_lote_id: target });
        if (error) throw error;
        const r = data as Record<string, unknown> & { erro?: string };
        if (r?.erro) {
          toast.error(`Erro: ${String(r.erro)}`);
          return false;
        }
        toast.success(
          `Consolidado: ${r.inseridos} inseridos, ${r.duplicados} duplicados, ${r.pendentes_vinculo} pendentes, ${r.erros} erros.`,
        );
        return true;
      } catch (err) {
        toast.error(`Falha na consolidação: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      } finally {
        setIsProcessing(false);
      }
    },
    [loteId],
  );

  return {
    file,
    bundle,
    previewData: preview,
    sheets: bundle?.abasDetectadas ?? [],
    isProcessing,
    loteId,
    onFileChange,
    generatePreview,
    processImport,
    finalizeImport,
  };
}
