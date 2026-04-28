
import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { toast } from "sonner";
import { validateFinanceiroImport } from "@/lib/importacao/validators";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { Mapping, PreviewFinanceiroRow } from "./types";
import {
  listClientesLookup,
  listFornecedoresLookup,
  createImportacaoLote,
  insertStagingChunks,
  logImportacao,
  consolidarFinanceiro,
  cancelarLote,
} from "@/services/importacao.service";

/**
 * Hook de importação financeira com staging real.
 *
 * Fluxo:
 *  1. generatePreview — valida, resolve pessoa, monta preview (sem escrita)
 *  2. processImport  — grava em stg_financeiro_aberto + importacao_lotes (status "staging")
 *  3. finalizeImport — chama RPC consolidar_lote_financeiro
 */
export function useImportacaoFinanceiro() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [previewData, setPreviewData] = useState<PreviewFinanceiroRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loteId, setLoteId] = useState<string | null>(null);

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
        if (wb.SheetNames.length > 0) {
          onSheetChange(wb.SheetNames[0], wb);
        }
      } catch (err: unknown) {
        toast.error(`Erro ao ler arquivo: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, []);

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
        if (FIELD_ALIASES[cleanH]) {
          initialMapping[FIELD_ALIASES[cleanH]] = h;
        }
      });
      setMapping(initialMapping);
    }
  }, [workbook]);

  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);

    try {
      const [clientes, fornecedores] = await Promise.all([
        listClientesLookup(),
        listFornecedoresLookup(),
      ]);

      const entityByLegado = new Map<string, { id: string; type: "cliente" | "fornecedor" }>();
      const entityByCpf = new Map<string, { id: string; type: "cliente" | "fornecedor" }>();

      clientes.forEach((c) => {
        if (c.codigo_legado) entityByLegado.set(c.codigo_legado, { id: c.id, type: "cliente" });
        if (c.cpf_cnpj) entityByCpf.set(String(c.cpf_cnpj).replace(/\D/g, ""), { id: c.id, type: "cliente" });
      });
      fornecedores.forEach((f) => {
        if (f.codigo_legado) entityByLegado.set(f.codigo_legado, { id: f.id, type: "fornecedor" });
        if (f.cpf_cnpj) entityByCpf.set(String(f.cpf_cnpj).replace(/\D/g, ""), { id: f.id, type: "fornecedor" });
      });

      const preview: PreviewFinanceiroRow[] = rawRows.map((row, index) => {
        const mappedRow: Record<string, unknown> = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateFinanceiroImport(mappedRow);
        const nd = validation.normalizedData;

        const cpfClean = String(nd.cpf_cnpj || "").replace(/\D/g, "");
        const legado = String(nd.codigo_legado_pessoa || "");

        const entity = (legado && entityByLegado.get(legado)) || (cpfClean && entityByCpf.get(cpfClean)) || null;

        if (entity) {
          nd.entity_id = entity.id;
          nd.entity_type = entity.type;
        } else if (cpfClean || legado) {
          validation.warnings = validation.warnings || [];
          validation.warnings.push(`Pessoa não encontrada (legado: ${legado || 'n/a'}, CPF/CNPJ: ${cpfClean || 'n/a'})`);
        }

        return {
          ...nd,
          _valid: validation.valid,
          _errors: validation.errors,
          _warnings: validation.warnings || [],
          _originalLine: index + 2,
          _originalRow: row,
        } as PreviewFinanceiroRow;
      });

      setPreviewData(preview);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao gerar prévia: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  }, [rawRows, mapping]);

  /**
   * Write to staging only — no final table writes.
   */
  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);

    try {
      const validos = previewData.filter(i => i._valid);
      const errosCount = previewData.length - validos.length;

      const totalCP = validos.filter(i => i.tipo === 'pagar').reduce((s, i) => s + (i.valor || 0), 0);
      const totalCR = validos.filter(i => i.tipo === 'receber').reduce((s, i) => s + (i.valor || 0), 0);
      const abertos = validos.filter(i => !i.data_pagamento).length;
      const baixados = validos.filter(i => !!i.data_pagamento).length;

      const currentLoteId = await createImportacaoLote({
        tipo: "financeiro_aberto",
        arquivo_nome: file?.name,
        fase: "financeiro",
        total_registros: previewData.length,
        registros_erro: errosCount,
        resumo: { totalCP, totalCR, abertos, baixados, semVinculo: validos.filter(i => !i.entity_id).length },
        erros: errosCount > 0
          ? previewData.filter(i => !i._valid).slice(0, 50).map(i => ({ linha: i._originalLine, erros: i._errors }))
          : null,
      });
      setLoteId(currentLoteId);

      const stagingRows = validos.map(item => ({
        lote_id: currentLoteId,
        dados: {
          tipo: item.tipo === 'receber' ? 'receber' : 'pagar',
          descricao: item.descricao || item.titulo || 'Carga via migração',
          titulo: item.titulo,
          data_emissao: item.data_emissao,
          data_vencimento: item.data_vencimento,
          data_pagamento: item.data_pagamento,
          valor: item.valor,
          valor_pago: item.valor_pago,
          forma_pagamento: item.forma_pagamento,
          banco: item.banco,
          parcela_numero: item.parcela_numero,
          parcela_total: item.parcela_total,
          cpf_cnpj: item.cpf_cnpj,
          codigo_legado_pessoa: item.codigo_legado_pessoa,
          entity_id: item.entity_id,
          entity_type: item.entity_type,
          observacoes: item.observacoes,
        },
        status: "pendente" as const,
      }));
      await insertStagingChunks("stg_financeiro_aberto", stagingRows);
      await logImportacao(
        currentLoteId,
        "info",
        `Staging financeiro: ${validos.length} títulos (CP: ${totalCP.toFixed(2)}, CR: ${totalCR.toFixed(2)}), ${errosCount} erros.`,
      );

      toast.success(`${validos.length} títulos enviados para staging. Confirme para consolidar.`);
      return currentLoteId;

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro na importação financeira:", error);
      toast.error(`Falha no processamento: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeImport = async (loteIdParam?: string) => {
    const targetLoteId = loteIdParam || loteId;
    if (!targetLoteId) {
      toast.error("Nenhum lote selecionado para consolidar.");
      return false;
    }

    setIsProcessing(true);
    try {
      const result = await consolidarFinanceiro(targetLoteId);
      if (result.erro) {
        toast.error(`Erro na consolidação: ${result.erro}`);
        return false;
      }
      await logImportacao(
        targetLoteId,
        "info",
        `Consolidação financeira: ${result.inseridos ?? 0} lançamentos criados, ${result.erros ?? 0} erros.`,
      );
      toast.success(`${result.inseridos} lançamentos financeiros consolidados.`);
      return true;
    } catch (error: unknown) {
      console.error("Erro na consolidação financeira:", error);
      toast.error(`Falha na consolidação: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelLote = async (loteIdParam?: string) => {
    const targetLoteId = loteIdParam || loteId;
    if (!targetLoteId) return;
    try {
      await cancelarLote(targetLoteId, "stg_financeiro_aberto");
      toast.info("Lote cancelado.");
    } catch (err: unknown) {
      toast.error(`Erro ao cancelar: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return {
    file,
    sheets,
    currentSheet,
    headers,
    mapping,
    previewData,
    isProcessing,
    onFileChange,
    onSheetChange,
    setMapping,
    generatePreview,
    processImport,
    finalizeImport,
    cancelLote,
    loteId
  };
}
