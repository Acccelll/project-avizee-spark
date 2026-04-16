
import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateEstoqueInicialImport } from "@/lib/importacao/validators";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { Mapping } from "./types";

/**
 * Hook de importação de estoque inicial com staging real.
 *
 * Fluxo:
 *  1. generatePreview — valida, resolve produto, monta preview (sem escrita)
 *  2. processImport  — grava em stg_estoque_inicial + importacao_lotes (status "staging")
 *  3. finalizeImport — chama RPC consolidar_lote_estoque
 */
export function useImportacaoEstoque() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewData, setPreviewData] = useState<any[]>([]);
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
        if (FIELD_ALIASES[cleanH]) {
          initialMapping[FIELD_ALIASES[cleanH]] = h;
        }
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
        if (wb.SheetNames.length > 0) {
          onSheetChange(wb.SheetNames[0], wb);
        }
      } catch (err: unknown) {
        toast.error(`Erro ao ler arquivo: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, [onSheetChange]);

  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: produtosBanco } = await supabase
        .from("produtos")
        .select("id, codigo_interno, codigo_legado, nome, preco_custo, preco_venda, estoque_atual");

      const prodByLegado = new Map(produtosBanco?.filter((p: any) => p.codigo_legado).map((p: any) => [p.codigo_legado, p]));
      const prodByInterno = new Map(produtosBanco?.filter((p: any) => p.codigo_interno).map((p: any) => [p.codigo_interno, p]));

      const preview = rawRows.map((row, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedRow: any = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateEstoqueInicialImport(mappedRow);
        const nd = validation.normalizedData;

        const produtoInfo = (nd.codigo_legado && prodByLegado.get(nd.codigo_legado as string))
          || (nd.codigo_produto && prodByInterno.get(nd.codigo_produto as string));

        if (!produtoInfo) {
          validation.valid = false;
          const chave = nd.codigo_legado || nd.codigo_produto || '(sem código)';
          validation.errors.push(`Produto não encontrado: ${chave}`);
        } else {
          nd.produto_id = (produtoInfo as any).id;
          nd.nome_produto = (produtoInfo as any).nome;
          nd.estoque_atual_sistema = (produtoInfo as any).estoque_atual || 0;
          nd.diferenca = Number(nd.quantidade) - ((produtoInfo as any).estoque_atual || 0);
          nd.custo_unitario = nd.custo_unitario ?? (produtoInfo as any).preco_custo ?? 0;
        }

        return {
          ...nd,
          _valid: validation.valid,
          _errors: validation.errors,
          _warnings: validation.warnings || [],
          _originalLine: index + 2,
          _originalRow: row
        };
      });

      setPreviewData(preview);
    } catch (err: unknown) {
      toast.error(`Erro ao validar dados: ${err instanceof Error ? err.message : String(err)}`);
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
      const { data: user } = await supabase.auth.getUser();
      const validos = previewData.filter(i => i._valid);
      const errosCount = previewData.length - validos.length;

      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: "estoque_inicial",
          arquivo_nome: file?.name,
          status: "staging",
          fase: "estoque",
          total_registros: previewData.length,
          registros_sucesso: 0,
          registros_erro: errosCount,
          usuario_id: user?.user?.id,
          resumo: {
            total_itens: validos.length,
            total_unidades: validos.reduce((s, i) => s + (i.quantidade || 0), 0),
            total_valor: validos.reduce((s, i) => s + (i.quantidade || 0) * (i.custo_unitario || 0), 0),
          },
          erros: errosCount > 0
            ? previewData.filter(i => !i._valid).slice(0, 50).map(i => ({ linha: i._originalLine, erros: i._errors }))
            : null,
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      if (validos.length > 0) {
        const stagingRows = validos.map(item => {
          const { _valid, _errors, _warnings, _originalLine, _originalRow, estoque_atual_sistema, diferenca, nome_produto, ...rest } = item;
          return {
            lote_id: currentLoteId,
            dados: rest,
            status: "pendente",
          };
        });

        for (let i = 0; i < stagingRows.length; i += 500) {
          const batch = stagingRows.slice(i, i + 500);
          const { error: stgError } = await supabase.from("stg_estoque_inicial").insert(batch);
          if (stgError) throw stgError;
        }
      }

      await supabase.from("importacao_logs").insert({
        lote_id: currentLoteId,
        nivel: "info",
        mensagem: `Staging de estoque: ${validos.length} itens válidos, ${errosCount} erros.`,
      });

      toast.success(`${validos.length} itens enviados para staging. Confirme para consolidar.`);
      return currentLoteId;

    } catch (error: unknown) {
      console.error("Erro na importação de estoque:", error);
      toast.error(`Falha no processamento: ${error instanceof Error ? error.message : String(error)}`);
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
      const { data, error } = await supabase.rpc("consolidar_lote_estoque", {
        p_lote_id: targetLoteId,
      });

      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = data as any;
      if (result?.erro) {
        toast.error(`Erro na consolidação: ${result.erro}`);
        return false;
      }

      await supabase.from("importacao_logs").insert({
        lote_id: targetLoteId,
        nivel: "info",
        mensagem: `Consolidação de estoque: ${result.inseridos} movimentos criados, ${result.erros} erros.`,
      });

      toast.success(`${result.inseridos} saldos de estoque atualizados.`);
      return true;
    } catch (error: unknown) {
      console.error("Erro na consolidação de estoque:", error);
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
      await supabase.from("stg_estoque_inicial").delete().eq("lote_id", targetLoteId);
      await supabase.from("importacao_lotes").update({ status: "cancelado" }).eq("id", targetLoteId);
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
