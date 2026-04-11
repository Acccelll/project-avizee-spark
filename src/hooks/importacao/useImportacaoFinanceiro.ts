// @ts-nocheck
import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateFinanceiroImport } from "@/lib/importacao/validators";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { Mapping, PreviewFinanceiroRow } from "./types";

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
      } catch (err: any) {
        toast.error(`Erro ao ler arquivo: ${err.message}`);
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
      const { data: clientes } = await supabase.from("clientes").select("id, nome_razao_social, cpf_cnpj");
      const { data: fornecedores } = await supabase.from("fornecedores").select("id, nome_razao_social, cpf_cnpj");

      const entityMap = new Map<string, { id: string; type: "cliente" | "fornecedor" }>();
      clientes?.forEach(c => entityMap.set(c.cpf_cnpj?.replace(/\D/g, "") ?? "", { id: c.id, type: "cliente" }));
      fornecedores?.forEach(f => entityMap.set(f.cpf_cnpj?.replace(/\D/g, "") ?? "", { id: f.id, type: "fornecedor" }));

      const preview: PreviewFinanceiroRow[] = rawRows.map((row, index) => {
        const mappedRow: Record<string, unknown> = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateFinanceiroImport(mappedRow);
        const cpfCnpj = String(mappedRow.cpf_cnpj || mappedRow["CPF/CNPJ"] || "").replace(/\D/g, "");
        const entity = entityMap.get(cpfCnpj);

        if (entity) {
          validation.normalizedData.entity_id = entity.id;
          validation.normalizedData.entity_type = entity.type;
        } else if (cpfCnpj) {
          validation.warnings = validation.warnings || [];
          validation.warnings.push(`Pessoa não encontrada (CPF/CNPJ: ${cpfCnpj})`);
        }

        return {
          ...validation.normalizedData,
          _valid: validation.valid,
          _errors: validation.errors,
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
          tipo: "financeiro_aberto",
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

      // Insert valid records directly into financeiro_lancamentos
      if (validos.length > 0) {
        const dataToInsert = validos.map(item => ({
          tipo: item.tipo || "receber",
          descricao: item.descricao,
          valor: item.valor,
          data_vencimento: item.data_vencimento,
          status: "aberto",
          cliente_id: item.entity_type === "cliente" ? item.entity_id : null,
          fornecedor_id: item.entity_type === "fornecedor" ? item.entity_id : null,
          observacoes: item.observacoes || "Carga inicial de saldo em aberto.",
        }));

        const { error: insError } = await supabase.from("financeiro_lancamentos").insert(dataToInsert);
        if (insError) throw insError;
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: validos.length,
        })
        .eq("id", currentLoteId);

      toast.success(`${validos.length} títulos financeiros importados.`);
      return currentLoteId;

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro na importação financeira:", error);
      toast.error(`Falha no processamento: ${msg}`);
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
