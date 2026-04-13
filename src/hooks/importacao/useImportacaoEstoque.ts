import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateEstoqueInicialImport } from "@/lib/importacao/validators";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { Mapping } from "./types";
import { logger } from '@/utils/logger';

export function useImportacaoEstoque() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
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
      setRawRows(XLSX.utils.sheet_to_json(ws));

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
        toast.error(`Erro ao ler arquivo: ${err.message}`);
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, [onSheetChange]);

  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);

    try {
      // Load all products — prefetch by codigo_legado and codigo_interno
      const { data: produtosBanco } = await supabase
        .from("produtos")
        .select("id, codigo_interno, codigo_legado, nome, preco_custo, preco_venda, estoque_atual");

      const prodByLegado = new Map(produtosBanco?.filter(p => p.codigo_legado).map(p => [p.codigo_legado, p]));
      const prodByInterno = new Map(produtosBanco?.filter(p => p.codigo_interno).map(p => [p.codigo_interno, p]));

      const preview = rawRows.map((row, index) => {
        const mappedRow: Record<string, unknown> = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateEstoqueInicialImport(mappedRow);
        const nd = validation.normalizedData;

        // Resolve product — prioriza codigo_legado
        const produtoInfo = (nd.codigo_legado && prodByLegado.get(nd.codigo_legado))
          || (nd.codigo_produto && prodByInterno.get(nd.codigo_produto));

        if (!produtoInfo) {
          validation.valid = false;
          const chave = nd.codigo_legado || nd.codigo_produto || '(sem código)';
          validation.errors.push(`Produto não encontrado: ${chave}`);
        } else {
          nd.produto_id = produtoInfo.id;
          nd.nome_produto = produtoInfo.nome;
          nd.custo_unitario = nd.custo_unitario ?? produtoInfo.preco_custo ?? 0;
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
      toast.error(`Erro ao validar dados: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [rawRows, mapping]);

  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      const validos = previewData.filter(i => i._valid);
      const errosCount = previewData.length - validos.length;
      const today = new Date().toISOString().split('T')[0];

      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: "estoque_inicial",
          arquivo_nome: file?.name,
          status: "processando",
          total_registros: previewData.length,
          registros_sucesso: validos.length,
          registros_erro: errosCount,
          usuario_id: user?.user?.id,
          erros: errosCount > 0
            ? previewData
                .filter(i => !i._valid)
                .slice(0, 50)
                .map(i => ({ linha: i._originalLine, erros: i._errors }))
            : null,
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      if (validos.length > 0) {
        const { data: allProds } = await supabase
          .from("produtos")
          .select("id, codigo_interno, codigo_legado, estoque_atual")
          .in("id", validos.map(i => i.produto_id).filter(Boolean));

        const prodById = new Map(allProds?.map(p => [p.id, p]));

        const movements: Record<string, unknown>[] = [];
        const productUpdates: { id: string; estoque_atual: number }[] = [];

        validos.forEach(item => {
          const prod = prodById.get(item.produto_id);
          if (!prod) return;

          const saldo_anterior = Number(prod.estoque_atual || 0);
          const saldo_atual = item.quantidade;
          const diff = saldo_atual - saldo_anterior;

          // Use the date from the file; fallback to today
          const dataMovimento = item.data_estoque_inicial || today;

          movements.push({
            produto_id: prod.id,
            tipo: diff >= 0 ? "entrada" : "saida",
            quantidade: Math.abs(diff),
            saldo_anterior,
            saldo_atual,
            motivo: `Estoque inicial via migração (Lote: ${currentLoteId})`,
            documento_tipo: "abertura",
            documento_id: currentLoteId,
            created_at: dataMovimento,
          });

          productUpdates.push({ id: prod.id, estoque_atual: saldo_atual });
        });

        if (movements.length > 0) {
          const { error: movError } = await supabase.from("estoque_movimentos").insert(movements);
          if (movError) throw movError;

          await Promise.all(
            productUpdates.map(({ id, estoque_atual }) =>
              supabase.from("produtos").update({ estoque_atual }).eq("id", id)
            )
          );
        }
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: validos.length,
        })
        .eq("id", currentLoteId);

      toast.success(`${validos.length} saldos de estoque atualizados.`);
      return currentLoteId;

    } catch (error: unknown) {
      logger.error("Erro na importação de estoque:", error);
      toast.error(`Falha no processamento: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeImport = async () => {
    toast.info("Importação já foi concluída no passo anterior.");
    return true;
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
    loteId
  };
}

