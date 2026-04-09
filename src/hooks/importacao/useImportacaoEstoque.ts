import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
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
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      setWorkbook(wb);
      setSheets(wb.SheetNames);
      if (wb.SheetNames.length > 0) {
        onSheetChange(wb.SheetNames[0], wb);
      }
    };
    reader.readAsBinaryString(selectedFile);
  }, [onSheetChange]);

  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);

    try {
      // Carregar produtos do banco para validar existência
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
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo_importacao: "estoque_inicial",
          arquivo_nome: file?.name,
          status: "processando",
          total_lidos: previewData.length,
          mapeamento: mapping,
          criado_por: user?.user?.id
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      const stagingData = previewData.map(item => ({
        lote_importacao_id: currentLoteId,
        arquivo_origem: file?.name,
        aba_origem: currentSheet,
        linha_origem: item._originalLine,
        payload: item._originalRow,
        status_validacao: item._valid ? "valido" : "erro",
        motivo_erro: item._errors.join(", "),
        criado_por: user?.user?.id
      }));

      const { error: stagingError } = await supabase.from("stg_estoque_inicial").insert(stagingData);
      if (stagingError) throw stagingError;

      const validos = previewData.filter(i => i._valid).length;
      const erros = previewData.length - validos;

      await supabase
        .from("importacao_lotes")
        .update({
          status: erros > 0 ? "parcial" : "validado",
          total_validos: validos,
          total_erros: erros
        })
        .eq("id", currentLoteId);

      toast.success(`${validos} registros prontos para abertura de saldo.`);
      return currentLoteId;

    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(`Falha no staging: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeImport = async (idLote = loteId) => {
    if (!idLote) return;
    setIsProcessing(true);

    try {
      // 1. Recuperar mapeamento e dados de staging
      const { data: loteData } = await supabase
        .from("importacao_lotes")
        .select("mapeamento")
        .eq("id", idLote)
        .single();

      const batchMapping = loteData?.mapeamento as Mapping;

      const { data: validItems, error: fetchError } = await supabase
        .from("stg_estoque_inicial")
        .select("payload, linha_origem")
        .eq("lote_importacao_id", idLote)
        .eq("status_validacao", "valido");

      if (fetchError) throw fetchError;
      if (!validItems || validItems.length === 0) {
        toast.warning("Nenhum registro válido para importar.");
        setIsProcessing(false);
        return;
      }

      // 2. Carregar produtos para calcular saldos e obter IDs
      const { data: allProds } = await supabase.from("produtos").select("id, codigo_interno, estoque_atual");
      const prodMap = new Map(allProds?.map(p => [p.codigo_interno, p]));

      // 3. Preparar dados para inserção em bloco
      const movements: any[] = [];
      const productUpdates: { id: string, estoque_atual: number }[] = [];

      validItems.forEach(item => {
        const raw = item.payload;
        const mappedRow: any = {};
        Object.entries(batchMapping).forEach(([field, colName]) => {
          mappedRow[field] = raw[colName];
        });

        const validation = validateEstoqueInicialImport(mappedRow);
        const prod = prodMap.get(validation.normalizedData.codigo_produto);

        if (prod) {
          const saldo_anterior = Number(prod.estoque_atual || 0);
          const saldo_atual = validation.normalizedData.quantidade;
          const diff = saldo_atual - saldo_anterior;

          movements.push({
            produto_id: prod.id,
            tipo: diff >= 0 ? "entrada" : "saida",
            quantidade: Math.abs(diff),
            saldo_anterior,
            saldo_atual,
            motivo: `Abertura de estoque inicial via migração (Lote: ${idLote})`,
            documento_tipo: "abertura",
            documento_id: idLote
          });

          productUpdates.push({ id: prod.id, estoque_atual: saldo_atual });
        }
      });

      // 4. Executar operações em bloco
      if (movements.length > 0) {
        const { error: movError } = await supabase.from("estoque_movimentos").insert(movements);
        if (movError) throw movError;

        // Atualização de produtos (Supabase/PostgREST não suporta bulk update com IDs diferentes de forma nativa facilmente via insert/upsert)
        // Usaremos uma estratégia de upsert para as colunas específicas
        const { error: updError } = await supabase
          .from("produtos")
          .upsert(productUpdates as any, { onConflict: "id" });

        if (updError) throw updError;
      }

      const importedCount = movements.length;

      await supabase
        .from("importacao_lotes")
        .update({
          status: "concluido",
          total_importados: importedCount,
          observacoes: `Abertura de saldo concluída para ${importedCount} produtos.`
        })
        .eq("id", idLote);

      toast.success(`Importação finalizada! ${importedCount} saldos atualizados.`);
      return true;

    } catch (error: any) {
      console.error("Erro na finalização:", error);
      toast.error(`Falha na carga final: ${error.message}`);
    } finally {
      setIsProcessing(false);
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
    loteId
  };
}
