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

/**
 * Hook de importação de cadastros (produtos, clientes, fornecedores).
 *
 * Fluxo staging real:
 *  1. generatePreview — valida e monta preview (sem escrita)
 *  2. processImport  — grava em stg_cadastros + importacao_lotes (status "staging")
 *  3. finalizeImport — chama RPC consolidar_lote_cadastros, atualiza status
 */
export function useImportacaoCadastros() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [importType, setImportType] = useState<ImportType>("produtos");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loteId, setLoteId] = useState<string | null>(null);

  const onSheetChange = useCallback((sheetName: string, wb: XLSX.WorkBook | null = null) => {
    const activeWb = wb || workbook;
    if (!activeWb) return;

    setCurrentSheet(sheetName);
    // Auto-inferir tipo_item=insumo quando a aba for "INSUMOS"
    if (importType === "produtos" && sheetName.toUpperCase().includes("INSUMO")) {
      // Sinaliza para o generatePreview forçar o tipo
    }
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
  }, [workbook, importType]);

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

  /**
   * Step 1: Validate and build preview (no DB writes).
   * Enriches each row with _action: 'inserir' | 'atualizar' | 'duplicado'.
   */
  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);

    try {
      // Pre-fetch existing records for dedup detection
      const existingByLegado = new Map<string, string>();
      const existingByKey = new Map<string, string>(); // codigo_interno or cpf_cnpj

      if (importType === "produtos") {
        const { data: prods } = await supabase.from("produtos").select("id, codigo_legado, codigo_interno");
        prods?.forEach(p => {
          if (p.codigo_legado) existingByLegado.set(p.codigo_legado, p.id);
          if (p.codigo_interno) existingByKey.set(p.codigo_interno, p.id);
        });
      } else {
        const table = importType === "clientes" ? "clientes" : "fornecedores";
        const { data: entities } = await supabase.from(table).select("id, codigo_legado, cpf_cnpj");
        entities?.forEach(e => {
          if (e.codigo_legado) existingByLegado.set(e.codigo_legado, e.id);
          if (e.cpf_cnpj) existingByKey.set(e.cpf_cnpj.replace(/\D/g, ""), e.id);
        });
      }

      const preview = rawRows.map((row, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedRow: any = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });
        // Forçar tipo_item=insumo quando a aba ativa contém "INSUMO"
        if (importType === "produtos" && currentSheet.toUpperCase().includes("INSUMO")) {
          mappedRow.tipo_item = "insumo";
        }

        let validation;
        if (importType === "produtos") validation = validateProdutoImport(mappedRow);
        else if (importType === "clientes") validation = validateClienteImport(mappedRow);
        else validation = validateFornecedorImport(mappedRow);

        const nd = validation.normalizedData;

        // Determine action: inserir/atualizar
        let _action: 'inserir' | 'atualizar' | 'duplicado' = 'inserir';
        const legadoKey = nd.codigo_legado;
        const secondaryKey = importType === "produtos" ? nd.codigo_interno : nd.cpf_cnpj?.replace(/\D/g, "");

        if (legadoKey && existingByLegado.has(legadoKey)) {
          _action = 'atualizar';
        } else if (secondaryKey && existingByKey.has(secondaryKey)) {
          _action = 'atualizar';
        }

        return {
          ...nd,
          _valid: validation.valid,
          _errors: validation.errors,
          _warnings: validation.warnings || [],
          _action,
          _originalLine: index + 2,
          _originalRow: row
        };
      });

      setPreviewData(preview);
      return preview;
    } catch (err: unknown) {
      toast.error(`Erro ao gerar prévia: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [rawRows, mapping, importType, currentSheet]);

  /**
   * Step 2: Write to staging (stg_cadastros + importacao_lotes).
   * NO data is written to final tables here.
   */
  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: user } = await supabase.auth.getUser();

      const validos = previewData.filter(i => i._valid);
      const errosCount = previewData.length - validos.length;
      const novos = validos.filter(i => i._action === 'inserir').length;
      const atualizados = validos.filter(i => i._action === 'atualizar').length;

      // Create lote with status "staging"
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: importType,
          arquivo_nome: file?.name,
          status: "staging",
          fase: "cadastros",
          total_registros: previewData.length,
          registros_sucesso: 0,
          registros_erro: errosCount,
          registros_atualizados: 0,
          registros_duplicados: 0,
          registros_ignorados: 0,
          usuario_id: user?.user?.id,
          resumo: { novos, atualizados, erros: errosCount },
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

      // Write valid records to stg_cadastros
      if (validos.length > 0) {
        const tipoEntidade = importType === "produtos" ? "produto" :
                            importType === "clientes" ? "cliente" : "fornecedor";

        const stagingRows = validos.map(item => {
          const { _valid, _errors, _warnings, _action, _originalLine, _originalRow, ...rest } = item;
          return {
            lote_id: currentLoteId,
            dados: { ...rest, _tipo_entidade: tipoEntidade },
            status: "pendente",
          };
        });

        // Insert in batches of 500
        for (let i = 0; i < stagingRows.length; i += 500) {
          const batch = stagingRows.slice(i, i + 500);
          const { error: stgError } = await supabase.from("stg_cadastros").insert(batch);
          if (stgError) throw stgError;
        }
      }

      // Log
      await supabase.from("importacao_logs").insert({
        lote_id: currentLoteId,
        nivel: "info",
        mensagem: `Staging concluído: ${validos.length} válidos (${novos} novos, ${atualizados} atualizações), ${errosCount} erros.`,
      });

      toast.success(`${validos.length} registros enviados para staging. Confirme para consolidar.`);
      setIsProcessing(false);
      return currentLoteId;

    } catch (error: unknown) {
      console.error("Erro na importação:", error);
      toast.error(`Falha no processamento: ${error instanceof Error ? error.message : String(error)}`);
      setIsProcessing(false);
    }
  };

  /**
   * Step 3: Consolidate staging → final tables via RPC.
   */
  const finalizeImport = async (loteIdParam?: string) => {
    const targetLoteId = loteIdParam || loteId;
    if (!targetLoteId) {
      toast.error("Nenhum lote selecionado para consolidar.");
      return false;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.rpc("consolidar_lote_cadastros", {
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
        mensagem: `Consolidação concluída: ${result.inseridos} inseridos, ${result.atualizados} atualizados, ${result.erros} erros, ${result.ignorados} ignorados.`,
      });

      toast.success(
        `Consolidação concluída: ${result.inseridos} inseridos, ${result.atualizados} atualizados.`
      );
      return true;
    } catch (error: unknown) {
      console.error("Erro na consolidação:", error);
      toast.error(`Falha na consolidação: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Cancel a staging lote (mark as cancelled, clean staging data).
   */
  const cancelLote = async (loteIdParam?: string) => {
    const targetLoteId = loteIdParam || loteId;
    if (!targetLoteId) return;

    try {
      await supabase.from("stg_cadastros").delete().eq("lote_id", targetLoteId);
      await supabase.from("importacao_lotes").update({ status: "cancelado" }).eq("id", targetLoteId);
      await supabase.from("importacao_logs").insert({
        lote_id: targetLoteId,
        nivel: "warn",
        mensagem: "Lote cancelado pelo usuário.",
      });
      toast.info("Lote cancelado com sucesso.");
    } catch (err: unknown) {
      toast.error(`Erro ao cancelar lote: ${err instanceof Error ? err.message : String(err)}`);
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
    cancelLote,
    loteId
  };
}
