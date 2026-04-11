// @ts-nocheck
import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateEstoqueInicialImport } from "@/lib/importacao/validators";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { Mapping } from "./types";

export function useImportacaoEstoque() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
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
      } catch (err: any) {
        toast.error(`Erro ao ler arquivo: ${err.message}`);
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
        .select("id, codigo_interno, nome, preco_custo, preco_venda");

      const prodMap = new Map(produtosBanco?.map(p => [p.codigo_interno, p]));

      const preview = rawRows.map((row, index) => {
        const mappedRow: any = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateEstoqueInicialImport(mappedRow);
        const produtoInfo = prodMap.get(validation.normalizedData.codigo_produto);

        if (!produtoInfo) {
          validation.valid = false;
          validation.errors.push(`Produto não encontrado: ${validation.normalizedData.codigo_produto}`);
        } else {
          validation.normalizedData.produto_id = produtoInfo.id;
          validation.normalizedData.nome_produto = produtoInfo.nome;
          validation.normalizedData.custo_unitario = mappedRow.custo_unitario || produtoInfo.preco_custo || 0;
        }

        return {
          ...validation.normalizedData,
          _valid: validation.valid,
          _errors: validation.errors,
          _originalLine: index + 2,
          _originalRow: row
        };
      });

      setPreviewData(preview);
    } catch (err: any) {
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

      // Insert stock movements directly
      if (validos.length > 0) {
        const { data: allProds } = await supabase.from("produtos").select("id, codigo_interno, estoque_atual");
        const prodMap = new Map(allProds?.map(p => [p.codigo_interno, p]));

        const movements: any[] = [];
        const productUpdates: { id: string; estoque_atual: number }[] = [];

        validos.forEach(item => {
          const prod = prodMap.get(item.codigo_produto);
          if (prod) {
            const saldo_anterior = Number(prod.estoque_atual || 0);
            const saldo_atual = item.quantidade;
            const diff = saldo_atual - saldo_anterior;

            movements.push({
              produto_id: prod.id,
              tipo: diff >= 0 ? "entrada" : "saida",
              quantidade: Math.abs(diff),
              saldo_anterior,
              saldo_atual,
              motivo: `Abertura de estoque inicial via migração (Lote: ${currentLoteId})`,
              documento_tipo: "abertura",
              documento_id: currentLoteId
            });

            productUpdates.push({ id: prod.id, estoque_atual: saldo_atual });
          }
        });

        if (movements.length > 0) {
          const { error: movError } = await supabase.from("estoque_movimentos").insert(movements);
          if (movError) throw movError;

          const { error: updError } = await supabase
            .from("produtos")
            .upsert(productUpdates as any, { onConflict: "id" });
          if (updError) throw updError;
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

    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(`Falha no staging: ${error.message}`);
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
