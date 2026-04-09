import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
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
      // Agrupar itens por nota fiscal (numero)
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

      // Validar duplicidades no banco por numero_nota
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
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo_importacao: "faturamento",
          arquivo_nome: file?.name,
          status: "processando",
          total_lidos: rawRows.length,
          mapeamento: mapping,
          criado_por: user?.user?.id
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      // Staging de faturamento (agrupado em payload jsonb)
      const stagingData = previewData.map(nf => ({
        lote_importacao_id: currentLoteId,
        arquivo_origem: file?.name,
        aba_origem: currentSheet,
        payload: nf,
        status_validacao: nf.status === "valido" ? "valido" : "erro",
        motivo_erro: Array.from(new Set(nf.errors)).join(", "),
        criado_por: user?.user?.id
      }));

      const { error: stagingError } = await supabase.from("stg_faturamento").insert(stagingData as any);
      if (stagingError) throw stagingError;

      const validos = previewData.filter(i => i.status === "valido").length;
      const erros = previewData.length - validos;

      await supabase
        .from("importacao_lotes")
        .update({
          status: erros > 0 ? "parcial" : "validado",
          total_validos: validos,
          total_erros: erros
        })
        .eq("id", currentLoteId);

      toast.success(`${validos} notas fiscais prontas para importação histórica.`);
      return currentLoteId;

    } catch (error: any) {
      console.error("Erro na importação de faturamento:", error);
      toast.error(`Falha no staging: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalizeImport = async (idLote = loteId, somenteConsulta = true) => {
    if (!idLote) return;
    setIsProcessing(true);

    try {
      const { data: validItems, error: fetchError } = await supabase
        .from("stg_faturamento")
        .select("payload")
        .eq("lote_importacao_id", idLote)
        .eq("status_validacao", "valido");

      if (fetchError) throw fetchError;

      // Carregar clientes para cache
      const { data: clients } = await supabase.from("clientes").select("id, nome_razao_social");
      const clientMap = new Map(clients?.map(c => [c.nome_razao_social.toUpperCase(), c.id]));

      let importedCount = 0;
      for (const item of validItems) {
        const nf = item.payload as unknown as GroupedNF;
        const clientId = clientMap.get(nf.cliente_nome.toUpperCase());

        // Criar Cabeçalho da Nota
        const { data: newNf, error: nfError } = await (supabase.from("notas_fiscais").insert({
          tipo: "saida",
          numero: nf.numero,
          data_emissao: nf.data_emissao,
          valor_total: nf.valor_total,
          cliente_id: clientId,
          status: "confirmada",
          observacoes: `Importação histórica - Lote ${idLote}`
        } as any).select().single() as any);

        if (nfError) {
          await supabase.from("importacao_logs").insert({
            lote_importacao_id: idLote,
            nivel: "error",
            etapa: "carga_final",
            mensagem: `Erro ao criar NF ${nf.numero}: ${nfError.message}`
          } as any);
          continue;
        }

        // Criar Itens da Nota (Lógica simplificada)
        // ... (Para itens reais, precisaríamos mapear produtos)

        importedCount++;
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: "concluido",
          total_importados: importedCount
        })
        .eq("id", idLote);

      toast.success(`Importação concluída! ${importedCount} notas históricas criadas.`);
      return true;

    } catch (err: any) {
      toast.error(`Erro na finalização: ${err.message}`);
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
