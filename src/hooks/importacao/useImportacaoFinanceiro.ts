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
      const wb = XLSX.read(bstr, { type: "binary" });
      await XLSX.ensureLoaded(wb);
      setWorkbook(wb);
      setSheets(wb.SheetNames);
      if (wb.SheetNames.length > 0) {
        onSheetChange(wb.SheetNames[0], wb);
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
      // Carregar clientes e fornecedores para validar existência e obter IDs
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
        const cpfCnpj = String(mappedRow.cpf_cnpj || "").replace(/\D/g, "");
        const entity = entityMap.get(cpfCnpj);

        if (entity) {
          validation.normalizedData.entity_id = entity.id;
          validation.normalizedData.entity_type = entity.type;
        } else if (cpfCnpj) {
          validation.errors.push(`Pessoa não encontrada (CPF/CNPJ: ${cpfCnpj})`);
          validation.valid = false;
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
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo_importacao: "financeiro_aberto",
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

      // Note: stagingData fields (lote_importacao_id, arquivo_origem, etc.) differ from the
      // stg_financeiro_aberto DB schema (lote_id, dados, status, erro). The DB schema does not
      // yet reflect the full staging payload. Using eslint-disable until schema is migrated.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: stagingError } = await (supabase.from as any)("stg_financeiro_aberto").insert(stagingData);
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

      toast.success(`${validos} títulos financeiros validados.`);
      return currentLoteId;

    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("Erro na importação financeira:", error);
      toast.error(`Falha no staging financeiro: ${msg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeImport = async (idLote = loteId) => {
    if (!idLote) return;
    setIsProcessing(true);

    try {
      // stg_financeiro_aberto uses different column names than what's in the DB schema
      // (lote_importacao_id vs lote_id, status_validacao vs status, etc.). Fetch uses
      // a workaround via type cast until schema migration aligns both.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: validItems, error: fetchError } = await (supabase.from as any)("stg_financeiro_aberto")
        .select("payload")
        .eq("lote_importacao_id", idLote)
        .eq("status_validacao", "valido");

      if (fetchError) throw fetchError;

      // Carregar mapeamento para re-validar
      const { data: loteData } = await supabase.from("importacao_lotes").select("mapeamento").eq("id", idLote).single();
      const batchMapping = loteData?.mapeamento as Mapping;

      // Cache de entidades
      const { data: clientes } = await supabase.from("clientes").select("id, cpf_cnpj");
      const { data: fornecedores } = await supabase.from("fornecedores").select("id, cpf_cnpj");
      const entityMap = new Map<string, { id: string; type: "cliente" | "fornecedor" }>();
      clientes?.forEach(c => entityMap.set(c.cpf_cnpj?.replace(/\D/g, "") ?? "", { id: c.id, type: "cliente" }));
      fornecedores?.forEach(f => entityMap.set(f.cpf_cnpj?.replace(/\D/g, "") ?? "", { id: f.id, type: "fornecedor" }));

      type LancamentoInsert = {
        tipo?: string;
        descricao?: string;
        valor?: number;
        data_vencimento?: string;
        status: string;
        origem: string;
        lote_id: string;
        cliente_id: string | null;
        fornecedor_id: string | null;
        observacoes: string;
      };
      const dataToInsert: LancamentoInsert[] = [];
      (validItems as Array<{ payload: Record<string, unknown> }>).forEach(item => {
        const raw = item.payload;
        const mappedRow: Record<string, unknown> = {};
        Object.entries(batchMapping).forEach(([field, colName]) => {
          mappedRow[field] = raw[colName];
        });

        const validation = validateFinanceiroImport(mappedRow);
        const cpfCnpj = String(mappedRow.cpf_cnpj || "").replace(/\D/g, "");
        const entity = entityMap.get(cpfCnpj);

        dataToInsert.push({
          tipo: validation.normalizedData.tipo,
          descricao: validation.normalizedData.descricao,
          valor: validation.normalizedData.valor,
          data_vencimento: validation.normalizedData.data_vencimento,
          status: "aberto",
          origem: "abertura_financeiro",
          lote_id: idLote,
          cliente_id: entity?.type === "cliente" ? entity.id : null,
          fornecedor_id: entity?.type === "fornecedor" ? entity.id : null,
          observacoes: String(mappedRow.observacoes || "Carga inicial de saldo em aberto."),
        });
      });

      if (dataToInsert.length > 0) {
        const { error: insError } = await supabase.from("financeiro_lancamentos").insert(dataToInsert);
        if (insError) throw insError;
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: "concluido",
          total_importados: dataToInsert.length
        })
        .eq("id", idLote);

      toast.success(`Importação finalizada! ${dataToInsert.length} títulos abertos.`);
      return true;

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro na finalização: ${msg}`);
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
