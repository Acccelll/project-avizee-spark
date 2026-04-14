import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { normalizeText, normalizeCpfCnpj } from "@/lib/importacao/normalizers";
import { parseDecimalFlexible } from "@/lib/importacao/parsers";
import { Mapping } from "./types";

export type EnrichmentType =
  | "produtos_fornecedores"
  | "formas_pagamento"
  | "contas_contabeis"
  | "contas_bancarias";

interface EnrichmentPreviewRow {
  _valid: boolean;
  _errors: string[];
  _warnings: string[];
  _action: "inserir" | "atualizar" | "duplicado";
  _originalLine: number;
  [key: string]: unknown;
}

/**
 * Hook de importação para dados de enriquecimento relacional (Fase 3).
 * Suporta: produtos_fornecedores, formas_pagamento, contas_contabeis, contas_bancarias.
 *
 * Fluxo: generatePreview → processImport (staging) → finalizeImport (consolidação direta).
 * Como são cadastros auxiliares menores, a consolidação é feita no client-side
 * com inserções diretas, mas ainda usa importacao_lotes para auditoria.
 */
export function useImportacaoEnriquecimento() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [enrichmentType, setEnrichmentType] = useState<EnrichmentType>("produtos_fornecedores");
  const [previewData, setPreviewData] = useState<EnrichmentPreviewRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loteId, setLoteId] = useState<string | null>(null);

  const onSheetChange = useCallback((sheetName: string, wb: XLSX.WorkBook | null = null) => {
    const activeWb = wb || workbook;
    if (!activeWb) return;
    setCurrentSheet(sheetName);
    const ws = activeWb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (data.length > 0) {
      const headerRow = data[0] as string[];
      setHeaders(headerRow);
      setRawRows(XLSX.utils.sheet_to_json(ws) as Record<string, unknown>[]);
      const initialMapping: Mapping = {};
      headerRow.forEach(h => {
        const cleanH = String(h).trim().toUpperCase();
        if (FIELD_ALIASES[cleanH]) initialMapping[FIELD_ALIASES[cleanH]] = h;
      });
      setMapping(initialMapping);
    }
  }, [workbook]);

  const onFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      try {
        const wb = XLSX.read(bstr, { type: "binary" });
        await XLSX.ensureLoaded(wb);
        setWorkbook(wb);
        setSheets(wb.SheetNames);
        if (wb.SheetNames.length > 0) onSheetChange(wb.SheetNames[0], wb);
      } catch (err: unknown) {
        toast.error(`Erro ao ler arquivo: ${err instanceof Error ? err.message : "Desconhecido"}`);
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, [onSheetChange]);

  // ---- Validators per type ----

  function validateProdutoFornecedor(row: Record<string, unknown>) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const nd: Record<string, unknown> = {
      codigo_produto: normalizeText(String(row.codigo_produto || row.codigo_interno || "")),
      codigo_legado_produto: normalizeText(String(row.codigo_legado_produto || row.codigo_legado || "")),
      cpf_cnpj_fornecedor: normalizeCpfCnpj(String(row.cpf_cnpj_fornecedor || row.cpf_cnpj || "")),
      codigo_legado_fornecedor: normalizeText(String(row.codigo_legado_fornecedor || "")),
      referencia_fornecedor: normalizeText(String(row.referencia_fornecedor || row.referencia || "")),
      descricao_fornecedor: normalizeText(String(row.descricao_fornecedor || "")),
      preco_compra: parseDecimalFlexible(row.preco_compra || row.preco || 0).value || null,
      unidade_fornecedor: normalizeText(String(row.unidade_fornecedor || row.unidade || "")) || null,
      lead_time_dias: row.lead_time_dias ? parseInt(String(row.lead_time_dias)) || null : null,
      eh_principal: String(row.eh_principal || row.principal || "").toUpperCase() === "SIM" || row.eh_principal === true,
    };
    if (!nd.codigo_produto && !nd.codigo_legado_produto) errors.push("Código do produto é obrigatório.");
    if (!nd.cpf_cnpj_fornecedor && !nd.codigo_legado_fornecedor) errors.push("Identificação do fornecedor é obrigatória.");
    return { valid: errors.length === 0, errors, warnings, normalizedData: nd };
  }

  function validateFormaPagamento(row: Record<string, unknown>) {
    const errors: string[] = [];
    const nd: Record<string, unknown> = {
      descricao: normalizeText(String(row.descricao || row.nome || "")),
      tipo: normalizeText(String(row.tipo || "")).toLowerCase() || null,
      parcelas: row.parcelas ? parseInt(String(row.parcelas)) || 1 : 1,
      prazo_dias: row.prazo_dias ? parseInt(String(row.prazo_dias)) || 0 : 0,
      gera_financeiro: row.gera_financeiro !== false && row.gera_financeiro !== "NAO",
    };
    if (!nd.descricao) errors.push("Descrição da forma de pagamento é obrigatória.");
    return { valid: errors.length === 0, errors, warnings: [] as string[], normalizedData: nd };
  }

  function validateContaContabil(row: Record<string, unknown>) {
    const errors: string[] = [];
    const nd: Record<string, unknown> = {
      codigo: normalizeText(String(row.codigo || "")),
      descricao: normalizeText(String(row.descricao || row.nome || "")),
      natureza: normalizeText(String(row.natureza || "")).toLowerCase() || null,
      aceita_lancamento: row.aceita_lancamento !== false && row.aceita_lancamento !== "NAO",
    };
    if (!nd.codigo) errors.push("Código da conta contábil é obrigatório.");
    if (!nd.descricao) errors.push("Descrição é obrigatória.");
    return { valid: errors.length === 0, errors, warnings: [] as string[], normalizedData: nd };
  }

  function validateContaBancaria(row: Record<string, unknown>) {
    const errors: string[] = [];
    const nd: Record<string, unknown> = {
      descricao: normalizeText(String(row.descricao || row.nome || "")),
      banco_nome: normalizeText(String(row.banco || row.banco_nome || "")),
      agencia: normalizeText(String(row.agencia || "")),
      conta: normalizeText(String(row.conta || row.numero_conta || "")),
      titular: normalizeText(String(row.titular || "")),
      saldo_atual: parseDecimalFlexible(row.saldo_atual || row.saldo || 0).value || 0,
    };
    if (!nd.descricao) errors.push("Descrição da conta é obrigatória.");
    return { valid: errors.length === 0, errors, warnings: [] as string[], normalizedData: nd };
  }

  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);
    try {
      const preview: EnrichmentPreviewRow[] = rawRows.map((row, i) => {
        const mapped: Record<string, unknown> = {};
        Object.entries(mapping).forEach(([f, c]) => { mapped[f] = row[c]; });

        let result;
        switch (enrichmentType) {
          case "produtos_fornecedores": result = validateProdutoFornecedor(mapped); break;
          case "formas_pagamento": result = validateFormaPagamento(mapped); break;
          case "contas_contabeis": result = validateContaContabil(mapped); break;
          case "contas_bancarias": result = validateContaBancaria(mapped); break;
        }

        return {
          ...result.normalizedData,
          _valid: result.valid,
          _errors: result.errors,
          _warnings: result.warnings || [],
          _action: "inserir" as const,
          _originalLine: i + 2,
        };
      });
      setPreviewData(preview);
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Desconhecido"}`);
    } finally {
      setIsProcessing(false);
    }
  }, [rawRows, mapping, enrichmentType]);

  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const validos = previewData.filter(i => i._valid);
      const errosCount = previewData.length - validos.length;

      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: enrichmentType,
          arquivo_nome: file?.name,
          status: "staging",
          fase: "enriquecimento",
          total_registros: previewData.length,
          registros_sucesso: 0,
          registros_erro: errosCount,
          usuario_id: user?.user?.id,
          resumo: { validos: validos.length, erros: errosCount },
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      // Store in stg_cadastros with enrichment type marker
      if (validos.length > 0) {
        const rows = validos.map(item => {
          const { _valid, _errors, _warnings, _action, _originalLine, ...rest } = item;
          return {
            lote_id: currentLoteId,
            dados: { ...rest, _tipo_enriquecimento: enrichmentType },
            status: "pendente",
          };
        });
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await supabase.from("stg_cadastros").insert(batch);
          if (error) throw error;
        }
      }

      await supabase.from("importacao_logs").insert({
        lote_id: currentLoteId,
        nivel: "info",
        mensagem: `Staging de ${enrichmentType}: ${validos.length} válidos, ${errosCount} erros.`,
      });

      toast.success(`${validos.length} registros em staging. Confirme para consolidar.`);
      return currentLoteId;
    } catch (error: unknown) {
      toast.error(`Falha: ${error instanceof Error ? error.message : "Desconhecido"}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeImport = async (loteIdParam?: string) => {
    const targetLoteId = loteIdParam || loteId;
    if (!targetLoteId) { toast.error("Nenhum lote selecionado."); return false; }
    setIsProcessing(true);

    try {
      // Update lote status
      await supabase.from("importacao_lotes").update({ status: "consolidando" }).eq("id", targetLoteId);

      // Fetch staging data
      const { data: stgRows, error: stgErr } = await supabase
        .from("stg_cadastros")
        .select("id, dados")
        .eq("lote_id", targetLoteId)
        .eq("status", "pendente");

      if (stgErr) throw stgErr;
      if (!stgRows || stgRows.length === 0) {
        toast.info("Nenhum registro pendente neste lote.");
        return false;
      }

      let inseridos = 0, erros = 0;
      const type = (stgRows[0].dados as Record<string, unknown>)?._tipo_enriquecimento as EnrichmentType;

      for (const row of stgRows) {
        const d = row.dados as Record<string, unknown>;
        try {
          if (type === "produtos_fornecedores") {
            // Resolve produto
            let produtoId: string | null = null;
            if (d.codigo_legado_produto) {
              const { data } = await supabase.from("produtos").select("id").eq("codigo_legado", d.codigo_legado_produto as string).limit(1).single();
              produtoId = data?.id || null;
            }
            if (!produtoId && d.codigo_produto) {
              const { data } = await supabase.from("produtos").select("id").eq("codigo_interno", d.codigo_produto as string).limit(1).single();
              produtoId = data?.id || null;
            }
            // Resolve fornecedor
            let fornecedorId: string | null = null;
            if (d.codigo_legado_fornecedor) {
              const { data } = await supabase.from("fornecedores").select("id").eq("codigo_legado", d.codigo_legado_fornecedor as string).limit(1).single();
              fornecedorId = data?.id || null;
            }
            if (!fornecedorId && d.cpf_cnpj_fornecedor) {
              const { data } = await supabase.from("fornecedores").select("id").eq("cpf_cnpj", d.cpf_cnpj_fornecedor as string).limit(1).single();
              fornecedorId = data?.id || null;
            }

            if (!produtoId || !fornecedorId) {
              await supabase.from("stg_cadastros").update({ status: "erro", erro: `Produto ou fornecedor não encontrado` }).eq("id", row.id);
              erros++;
              continue;
            }

            await supabase.from("produtos_fornecedores").upsert({
              produto_id: produtoId,
              fornecedor_id: fornecedorId,
              eh_principal: d.eh_principal as boolean || false,
              referencia_fornecedor: (d.referencia_fornecedor as string) || null,
              descricao_fornecedor: (d.descricao_fornecedor as string) || null,
              preco_compra: (d.preco_compra as number) || null,
              unidade_fornecedor: (d.unidade_fornecedor as string) || null,
              lead_time_dias: (d.lead_time_dias as number) || null,
            }, { onConflict: "produto_id,fornecedor_id" });

          } else if (type === "formas_pagamento") {
            await supabase.from("formas_pagamento").insert({
              descricao: d.descricao as string,
              tipo: (d.tipo as string) || null,
              parcelas: (d.parcelas as number) || 1,
              prazo_dias: (d.prazo_dias as number) || 0,
              gera_financeiro: d.gera_financeiro as boolean,
            });

          } else if (type === "contas_contabeis") {
            await supabase.from("contas_contabeis").upsert({
              codigo: d.codigo as string,
              descricao: d.descricao as string,
              natureza: (d.natureza as string) || null,
              aceita_lancamento: d.aceita_lancamento as boolean,
            }, { onConflict: "codigo" });

          } else if (type === "contas_bancarias") {
            // Resolve banco
            let bancoId: string | null = null;
            if (d.banco_nome) {
              const { data: banco } = await supabase.from("bancos").select("id").eq("nome", d.banco_nome as string).limit(1).single();
              if (banco) {
                bancoId = banco.id;
              } else {
                const { data: newBanco } = await supabase.from("bancos").insert({ nome: d.banco_nome as string }).select().single();
                bancoId = newBanco?.id || null;
              }
            }

            await supabase.from("contas_bancarias").insert({
              descricao: d.descricao as string,
              banco_id: bancoId,
              agencia: (d.agencia as string) || null,
              conta: (d.conta as string) || null,
              titular: (d.titular as string) || null,
              saldo_atual: (d.saldo_atual as number) || 0,
            });
          }

          await supabase.from("stg_cadastros").update({ status: "consolidado" }).eq("id", row.id);
          inseridos++;
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Erro desconhecido";
          await supabase.from("stg_cadastros").update({ status: "erro", erro: msg }).eq("id", row.id);
          erros++;
        }
      }

      const finalStatus = erros === 0 ? "concluido" : inseridos > 0 ? "parcial" : "erro";
      await supabase.from("importacao_lotes").update({
        status: finalStatus,
        registros_sucesso: inseridos,
        registros_erro: erros,
        resumo: { inseridos, erros },
      }).eq("id", targetLoteId);

      await supabase.from("importacao_logs").insert({
        lote_id: targetLoteId,
        nivel: "info",
        mensagem: `Consolidação de ${type}: ${inseridos} inseridos, ${erros} erros.`,
      });

      toast.success(`${inseridos} registros consolidados.`);
      return true;
    } catch (error: unknown) {
      toast.error(`Falha: ${error instanceof Error ? error.message : "Desconhecido"}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelLote = async (loteIdParam?: string) => {
    const targetLoteId = loteIdParam || loteId;
    if (!targetLoteId) return;
    try {
      await supabase.from("stg_cadastros").delete().eq("lote_id", targetLoteId);
      await supabase.from("importacao_lotes").update({ status: "cancelado" }).eq("id", targetLoteId);
      toast.info("Lote cancelado.");
    } catch (err: unknown) {
      toast.error(`Erro: ${err instanceof Error ? err.message : "Desconhecido"}`);
    }
  };

  return {
    file, sheets, currentSheet, headers, mapping, previewData, isProcessing,
    enrichmentType, loteId,
    onFileChange, onSheetChange, setMapping, setEnrichmentType,
    generatePreview, processImport, finalizeImport, cancelLote,
  };
}
