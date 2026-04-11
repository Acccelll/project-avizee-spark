// @ts-nocheck
import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
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
      const { data: user } = await supabase.auth.getUser();

      const validos = previewData.filter(i => i._valid);
      const errosCount = previewData.length - validos.length;

      // Create batch record using actual importacao_lotes schema
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: importType,
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

      // Insert valid records directly into target table
      if (validos.length > 0) {
        const dataToInsert = validos.map(item => {
          const { _valid, _errors, _originalLine, _originalRow, ...rest } = item;
          return rest;
        });

        let query;
        if (importType === "produtos") {
          query = supabase.from("produtos").upsert(dataToInsert, { onConflict: "codigo_interno" });
        } else {
          const targetTable = importType === "clientes" ? "clientes" : "fornecedores";
          // Map fields to match DB schema
          const mapped = dataToInsert.map(d => ({
            nome_razao_social: d.nome,
            cpf_cnpj: d.cpf_cnpj,
            email: d.email,
            telefone: d.telefone,
            cidade: d.cidade,
            uf: d.uf,
          }));
          query = supabase.from(targetTable).insert(mapped);
        }

        const { error: insertError } = await query;
        if (insertError) throw insertError;
      }

      // Update batch with final status
      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: validos.length,
          registros_erro: errosCount
        })
        .eq("id", currentLoteId);

      toast.success(`${validos.length} registros importados com sucesso.`);
      setIsProcessing(false);
      return currentLoteId;

    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error(`Falha no processamento: ${error.message}`);
      setIsProcessing(false);
    }
  };

  // finalizeImport kept for API compatibility but processImport now does everything
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
