// @ts-nocheck
import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateFaturamentoImport } from "@/lib/importacao/validators";
import { FIELD_ALIASES } from "@/lib/importacao/aliases";
import { Mapping } from "./types";

export interface GroupedNF {
  numero: string;
  cliente_nome: string;
  data_emissao: string;
  valor_total: number;
  itens_count: number;
  status: "valido" | "erro";
  errors: string[];
  itens: any[];
}

export function useImportacaoFaturamento() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [previewData, setPreviewData] = useState<GroupedNF[]>([]);
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

  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);

    try {
      const grouped = new Map<string, GroupedNF>();

      rawRows.forEach((row, index) => {
        const mappedRow: any = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateFaturamentoImport(mappedRow);
        const numero = validation.normalizedData.numero_nota || `S/N-${index}`;

        if (!grouped.has(numero)) {
          grouped.set(numero, {
            numero,
            cliente_nome: validation.normalizedData.cliente_nome,
            data_emissao: validation.normalizedData.data_emissao,
            valor_total: 0,
            itens_count: 0,
            status: "valido",
            errors: [...validation.errors],
            itens: []
          });
        }

        const nf = grouped.get(numero)!;
        nf.itens.push({ ...validation.normalizedData, _originalLine: index + 2, _originalRow: row });
        nf.itens_count++;
        nf.valor_total += validation.normalizedData.valor_total;
        if (!validation.valid) {
          nf.status = "erro";
          nf.errors.push(...validation.errors);
        }
      });

      // Check duplicates in DB
      const numeros = Array.from(grouped.keys());
      const { data: existentes } = await supabase
        .from("notas_fiscais")
        .select("numero")
        .in("numero", numeros);

      const existentesSet = new Set(existentes?.map(e => e.numero));
      grouped.forEach(nf => {
        if (existentesSet.has(nf.numero)) {
          nf.status = "erro";
          nf.errors.push("Nota Fiscal já cadastrada no sistema.");
        }
      });

      setPreviewData(Array.from(grouped.values()));
    } catch (err: any) {
      toast.error(`Erro ao gerar prévia: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, [rawRows, mapping]);

  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      const validos = previewData.filter(i => i.status === "valido");
      const errosCount = previewData.length - validos.length;

      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: "faturamento",
          arquivo_nome: file?.name,
          status: "processando",
          total_registros: rawRows.length,
          registros_sucesso: validos.length,
          registros_erro: errosCount,
          usuario_id: user?.user?.id,
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      // Insert valid invoices directly
      const { data: clients } = await supabase.from("clientes").select("id, nome_razao_social");
      const clientMap = new Map(clients?.map(c => [c.nome_razao_social.toUpperCase(), c.id]));

      // Parallel inserts for all valid invoices
      const results = await Promise.all(
        validos.map((nf) => {
          const clientId = clientMap.get(nf.cliente_nome?.toUpperCase());
          return supabase.from("notas_fiscais").insert({
            tipo: "saida",
            numero: nf.numero,
            data_emissao: nf.data_emissao,
            valor_total: nf.valor_total,
            cliente_id: clientId || null,
            status: "confirmada",
            origem: "importacao_historica",
            observacoes: `Importação histórica - Lote ${currentLoteId}`
          }).then(({ error }) => {
            if (error) console.error(`Erro ao criar NF ${nf.numero}:`, error.message);
            return !error;
          });
        })
      );

      const importedCount = results.filter(Boolean).length;

      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: importedCount,
        })
        .eq("id", currentLoteId);

      toast.success(`${importedCount} notas fiscais históricas importadas.`);
      return currentLoteId;

    } catch (error: any) {
      console.error("Erro na importação de faturamento:", error);
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
