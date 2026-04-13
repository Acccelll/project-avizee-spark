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
      // Build lookup maps: by codigo_legado, by cpf_cnpj (stripped), by name
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome_razao_social, cpf_cnpj, codigo_legado");
      const { data: fornecedores } = await supabase
        .from("fornecedores")
        .select("id, nome_razao_social, cpf_cnpj, codigo_legado");

      const entityByLegado = new Map<string, { id: string; type: "cliente" | "fornecedor" }>();
      const entityByCpf = new Map<string, { id: string; type: "cliente" | "fornecedor" }>();
      const entityByName = new Map<string, { id: string; type: "cliente" | "fornecedor" }>();

      clientes?.forEach(c => {
        if (c.codigo_legado) entityByLegado.set(c.codigo_legado, { id: c.id, type: "cliente" });
        if (c.cpf_cnpj) entityByCpf.set(c.cpf_cnpj.replace(/\D/g, ""), { id: c.id, type: "cliente" });
        entityByName.set(c.nome_razao_social.toUpperCase(), { id: c.id, type: "cliente" });
      });
      fornecedores?.forEach(f => {
        if (f.codigo_legado) entityByLegado.set(f.codigo_legado, { id: f.id, type: "fornecedor" });
        if (f.cpf_cnpj) entityByCpf.set(f.cpf_cnpj.replace(/\D/g, ""), { id: f.id, type: "fornecedor" });
        entityByName.set(f.nome_razao_social.toUpperCase(), { id: f.id, type: "fornecedor" });
      });

      const preview: PreviewFinanceiroRow[] = rawRows.map((row, index) => {
        const mappedRow: Record<string, unknown> = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateFinanceiroImport(mappedRow);
        const nd = validation.normalizedData;

        const cpfClean = nd.cpf_cnpj?.replace(/\D/g, "") || "";
        const legado = nd.codigo_legado_pessoa || "";

        // Priority: codigo_legado → cpf_cnpj → (not found)
        let entity = (legado && entityByLegado.get(legado)) || (cpfClean && entityByCpf.get(cpfClean)) || null;

        if (entity) {
          nd.entity_id = entity.id;
          nd.entity_type = entity.type;
        } else if (cpfClean || legado) {
          validation.warnings = validation.warnings || [];
          validation.warnings.push(`Pessoa não encontrada (legado: ${legado || 'n/a'}, CPF/CNPJ: ${cpfClean || 'n/a'})`);
        }

        return {
          ...nd,
          _valid: validation.valid,
          _errors: validation.errors,
          _warnings: validation.warnings || [],
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

      if (validos.length > 0) {
        const dataToInsert = validos.map(item => {
          // Map tipo CP/CR → pagar/receber (DB default is 'pagar')
          const tipoDb = item.tipo === 'receber' ? 'receber' : 'pagar';
          const isBaixado = item.status === 'baixado' && !!item.data_pagamento;

          return {
            tipo: tipoDb,
            descricao: item.descricao || item.titulo || 'Carga de saldo via migração',
            valor: item.valor,
            data_emissao: item.data_emissao || null,
            data_vencimento: item.data_vencimento,
            data_pagamento: isBaixado ? item.data_pagamento : null,
            valor_pago: isBaixado ? (item.valor_pago ?? item.valor) : null,
            status: isBaixado ? 'baixado' : 'aberto',
            forma_pagamento: item.forma_pagamento || null,
            banco: item.banco || null,
            parcela_numero: item.parcela_numero || null,
            parcela_total: item.parcela_total || null,
            cliente_id: item.entity_type === "cliente" ? item.entity_id : null,
            fornecedor_id: item.entity_type === "fornecedor" ? item.entity_id : null,
            observacoes: [
              item.observacoes,
              item.titulo ? `Doc: ${item.titulo}` : null,
              `Migração lote ${currentLoteId}`,
            ].filter(Boolean).join(' | '),
          };
        });

        const { error: insError } = await supabase
          .from("financeiro_lancamentos")
          .insert(dataToInsert);
        if (insError) throw insError;
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: validos.length,
        })
        .eq("id", currentLoteId);

      const baixados = validos.filter(i => i.status === 'baixado').length;
      const abertos = validos.length - baixados;
      toast.success(
        `${validos.length} títulos importados (${abertos} em aberto, ${baixados} baixados).`
      );
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

