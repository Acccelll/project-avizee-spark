import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  validateProdutoImport,
  validateClienteImport,
  validateFornecedorImport
} from "@/lib/importacao/validators";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { ImportType, Mapping } from "./types";

export function useImportacaoCadastros() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [importType, setImportType] = useState<ImportType>("produtos");
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

      // Auto-mapping based on aliases
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

  const generatePreview = useCallback(() => {
    if (rawRows.length === 0) return;

    const preview = rawRows.map((row, index) => {
      const mappedRow: any = {};
      Object.entries(mapping).forEach(([field, colName]) => {
        mappedRow[field] = row[colName];
      });

      let validation;
      if (importType === "produtos") validation = validateProdutoImport(mappedRow);
      else if (importType === "clientes") validation = validateClienteImport(mappedRow);
      else validation = validateFornecedorImport(mappedRow);

      return {
        ...validation.normalizedData,
        _valid: validation.valid,
        _errors: validation.errors,
        _originalLine: index + 2,
        _originalRow: row
      };
    });

    setPreviewData(preview);
    return preview;
  }, [rawRows, mapping, importType]);

  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);

    try {
      // 1. Criar Lote
      const { data: user } = await supabase.auth.getUser();
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo_importacao: importType,
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

      // 2. Salvar em Staging
      const stagingTable = `stg_${importType === "produtos" ? "produtos" : importType === "clientes" ? "clientes" : "fornecedores"}`;
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

      const { error: stagingError } = await supabase.from(stagingTable as any).insert(stagingData as any);
      if (stagingError) throw stagingError;

      // 3. Atualizar Lote com contagens
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

      toast.success(`${validos} registros validados e prontos para carga.`);
      setIsProcessing(false);
      return currentLoteId;

    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(`Falha no processamento: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const finalizeImport = async (idLote = loteId) => {
    if (!idLote) return;
    setIsProcessing(true);

    try {
      // 1. Recuperar mapeamento do lote
      const { data: loteData } = await supabase
        .from("importacao_lotes")
        .select("mapeamento, tipo_importacao")
        .eq("id", idLote)
        .single();

      const batchMapping = loteData?.mapeamento as Mapping;
      const batchType = loteData?.tipo_importacao as ImportType;

      // 2. Carregar registros válidos de staging
      const stagingTable = `stg_${batchType === "produtos" ? "produtos" : batchType === "clientes" ? "clientes" : "fornecedores"}`;

      const { data: validItems, error: fetchError } = await (supabase
        .from(stagingTable as any)
        .select("payload, linha_origem")
        .eq("lote_importacao_id", idLote)
        .eq("status_validacao", "valido") as any);

      if (fetchError) throw fetchError;
      if (!validItems || validItems.length === 0) {
        toast.warning("Nenhum registro válido para importar.");
        setIsProcessing(false);
        return;
      }

      // 3. Processar em lotes para melhor performance e respeitar o mapeamento
      const dataToInsert: any[] = [];
      validItems.forEach(item => {
        const raw = item.payload;
        const mappedRow: any = {};
        Object.entries(batchMapping).forEach(([field, colName]) => {
          mappedRow[field] = raw[colName];
        });

        let validated;
        if (batchType === "produtos") validated = validateProdutoImport(mappedRow);
        else if (batchType === "clientes") validated = validateClienteImport(mappedRow);
        else validated = validateFornecedorImport(mappedRow);

        dataToInsert.push(validated.normalizedData);
      });

      // 4. Upsert em bloco
      let query;
      if (batchType === "produtos") {
        query = supabase.from("produtos").upsert(dataToInsert, { onConflict: "codigo_interno" });
      } else {
        query = supabase.from(batchType as any).upsert(dataToInsert, { onConflict: "cpf_cnpj" });
      }

      const { error: insertError } = await query;

      if (insertError) {
        throw insertError;
      }

      const importedCount = dataToInsert.length;

      // Atualizar Lote Final
      await supabase
        .from("importacao_lotes")
        .update({
          status: "concluido",
          total_importados: importedCount,
          observacoes: `Carga finalizada com ${importedCount} registros inseridos/atualizados.`
        })
        .eq("id", idLote);

      toast.success(`Importação finalizada! ${importedCount} registros carregados.`);
      setIsProcessing(false);
      return true;

    } catch (error: any) {
      console.error("Erro na finalização:", error);
      toast.error(`Falha na carga final: ${error.message}`);
      setIsProcessing(false);
    }
  };

  return {
    file,
    sheets,
    currentSheet,
    headers,
    mapping,
    importType,
    previewData,
    isProcessing,
    onFileChange,
    onSheetChange,
    setMapping,
    setImportType,
    generatePreview,
    processImport,
    finalizeImport,
    loteId
  };
}
