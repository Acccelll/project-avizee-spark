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
import { logger } from '@/utils/logger';

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
        _warnings: validation.warnings || [],
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

      let importedCount = 0;
      if (validos.length > 0) {
        const { _valid, _errors, _warnings, _originalLine, _originalRow, ...rest } = validos[0];
        void rest;

        if (importType === "produtos") {
          // Fetch existing products by codigo_legado and codigo_interno to avoid duplicates
          const legadoCodes = validos.map(i => i.codigo_legado).filter(Boolean);
          const internosCodes = validos.map(i => i.codigo_interno).filter(Boolean);

          const existingByLegado = new Map<string, string>();
          if (legadoCodes.length > 0) {
            const { data: ex } = await supabase
              .from("produtos")
              .select("id, codigo_legado")
              .in("codigo_legado", legadoCodes);
            ex?.forEach(p => existingByLegado.set(p.codigo_legado, p.id));
          }
          const existingByInterno = new Map<string, string>();
          if (internosCodes.length > 0) {
            const { data: ex } = await supabase
              .from("produtos")
              .select("id, codigo_interno")
              .in("codigo_interno", internosCodes);
            ex?.forEach(p => existingByInterno.set(p.codigo_interno, p.id));
          }

          // Resolve grupo_id by name
          const grupoNames = [...new Set(validos.map(i => i.grupo).filter(Boolean))];
          const grupoMap = new Map<string, string>();
          if (grupoNames.length > 0) {
            const { data: grupos } = await supabase
              .from("grupos_produto")
              .select("id, nome")
              .in("nome", grupoNames);
            grupos?.forEach(g => grupoMap.set(g.nome.toUpperCase(), g.id));
          }

          const toInsert: any[] = [];
          const toUpdate: any[] = [];

          validos.forEach(item => {
            const { _valid, _errors, _warnings, _originalLine, _originalRow, grupo, ...rest } = item;
            const payload = {
              ...rest,
              grupo_id: grupo ? (grupoMap.get(grupo.toUpperCase()) || null) : null,
            };

            const existingId = (item.codigo_legado && existingByLegado.get(item.codigo_legado))
              || (item.codigo_interno && existingByInterno.get(item.codigo_interno));

            if (existingId) {
              toUpdate.push({ id: existingId, ...payload });
            } else {
              toInsert.push(payload);
            }
          });

          const results = await Promise.all([
            toInsert.length > 0
              ? supabase.from("produtos").insert(toInsert).then(({ error }) => {
                  if (error) { logger.error("Erro ao inserir produtos:", error.message); return 0; }
                  return toInsert.length;
                })
              : Promise.resolve(0),
            ...toUpdate.map(({ id, ...data }) =>
              supabase.from("produtos").update(data).eq("id", id).then(({ error }) => {
                if (error) { logger.error(`Erro ao atualizar produto ${id}:`, error.message); return 0; }
                return 1;
              })
            )
          ]);
          importedCount = results.reduce((a, b) => a + (b as number), 0);

        } else {
          // Clientes ou Fornecedores
          const targetTable = importType === "clientes" ? "clientes" : "fornecedores";

          // Fetch existing by codigo_legado and cpf_cnpj to detect duplicates
          const legadoCodes = validos.map(i => i.codigo_legado).filter(Boolean);
          const cpfCnpjs = validos.map(i => i.cpf_cnpj).filter(Boolean);

          const existingByLegado = new Map<string, string>();
          if (legadoCodes.length > 0) {
            const { data: ex } = await supabase
              .from(targetTable)
              .select("id, codigo_legado")
              .in("codigo_legado", legadoCodes);
            ex?.forEach(p => existingByLegado.set(p.codigo_legado, p.id));
          }
          const existingByCpf = new Map<string, string>();
          if (cpfCnpjs.length > 0) {
            const { data: ex } = await supabase
              .from(targetTable)
              .select("id, cpf_cnpj")
              .in("cpf_cnpj", cpfCnpjs);
            ex?.forEach(p => existingByCpf.set(p.cpf_cnpj, p.id));
          }

          const toInsert: any[] = [];
          const toUpdate: any[] = [];

          validos.forEach(item => {
            const { _valid, _errors, _warnings, _originalLine, _originalRow, ...payload } = item;
            const existingId = (item.codigo_legado && existingByLegado.get(item.codigo_legado))
              || (item.cpf_cnpj && existingByCpf.get(item.cpf_cnpj));

            if (existingId) {
              toUpdate.push({ id: existingId, ...payload });
            } else {
              toInsert.push(payload);
            }
          });

          const results = await Promise.all([
            toInsert.length > 0
              ? supabase.from(targetTable).insert(toInsert).then(({ error }) => {
                  if (error) { logger.error(`Erro ao inserir ${targetTable}:`, error.message); return 0; }
                  return toInsert.length;
                })
              : Promise.resolve(0),
            ...toUpdate.map(({ id, ...data }) =>
              supabase.from(targetTable).update(data).eq("id", id).then(({ error }) => {
                if (error) { logger.error(`Erro ao atualizar ${id}:`, error.message); return 0; }
                return 1;
              })
            )
          ]);
          importedCount = results.reduce((a, b) => a + (b as number), 0);
        }
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: importedCount,
          registros_erro: errosCount
        })
        .eq("id", currentLoteId);

      toast.success(`${importedCount} registros importados com sucesso.`);
      setIsProcessing(false);
      return currentLoteId;

    } catch (error: any) {
      logger.error("Erro na importação:", error);
      toast.error(`Falha no processamento: ${error.message}`);
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

