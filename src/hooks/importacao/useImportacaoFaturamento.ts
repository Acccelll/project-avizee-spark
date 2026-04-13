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
  cliente_id?: string | null;
  cpf_cnpj_destinatario?: string | null;
  chave_acesso?: string | null;
  municipio?: string | null;
  uf?: string | null;
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
      // Prefetch clientes by cpf_cnpj (priority) and name (fallback)
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome_razao_social, cpf_cnpj");
      const clienteByCpf = new Map(
        clientes?.filter(c => c.cpf_cnpj).map(c => [c.cpf_cnpj.replace(/\D/g, ""), c.id]) || []
      );
      const clienteByName = new Map(
        clientes?.map(c => [c.nome_razao_social.toUpperCase(), c.id]) || []
      );

      // Prefetch products for item lookup: by codigo_legado first, then codigo_interno
      const { data: produtosBanco } = await supabase
        .from("produtos")
        .select("id, codigo_interno, codigo_legado, nome");
      const prodByLegado = new Map(
        produtosBanco?.filter(p => p.codigo_legado).map(p => [p.codigo_legado, p.id]) || []
      );
      const prodByInterno = new Map(
        produtosBanco?.filter(p => p.codigo_interno).map(p => [p.codigo_interno, p.id]) || []
      );

      const grouped = new Map<string, GroupedNF>();

      rawRows.forEach((row, index) => {
        const mappedRow: any = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateFaturamentoImport(mappedRow);
        const nd = validation.normalizedData;
        const numero = nd.numero_nota || `S/N-${index}`;

        if (!grouped.has(numero)) {
          // Resolve client: try cpf_cnpj, then name
          const cpfClean = nd.cpf_cnpj_destinatario?.replace(/\D/g, "") || "";
          const clienteId = (cpfClean && clienteByCpf.get(cpfClean))
            || clienteByName.get(nd.cliente_nome?.toUpperCase() || "")
            || null;

          if (nd.cliente_nome && !clienteId) {
            nd._cliente_lookup_warning = `Cliente não localizado: "${nd.cliente_nome}" – será importado sem vínculo.`;
          }

          grouped.set(numero, {
            numero,
            cliente_nome: nd.cliente_nome,
            cliente_id: clienteId,
            cpf_cnpj_destinatario: nd.cpf_cnpj_destinatario,
            chave_acesso: nd.chave_acesso,
            data_emissao: nd.data_emissao,
            municipio: nd.municipio,
            uf: nd.uf,
            valor_total: 0,
            itens_count: 0,
            status: "valido",
            errors: [...validation.errors],
            itens: []
          });
        }

        const nf = grouped.get(numero)!;

        // Resolve product for item
        const codigoProduto = nd.codigo_produto_nf || nd.codigo_legado_produto || "";
        const produtoId = (nd.codigo_legado_produto && prodByLegado.get(nd.codigo_legado_produto))
          || (nd.codigo_produto_nf && prodByInterno.get(nd.codigo_produto_nf))
          || null;

        if (codigoProduto && !produtoId) {
          nd._produto_lookup_warning = `Produto não localizado: "${codigoProduto}" – item sem vínculo.`;
        }

        nd.produto_id = produtoId;
        nf.itens.push({ ...nd, _originalLine: index + 2, _originalRow: row });
        nf.itens_count++;
        nf.valor_total += nd.valor_total || 0;
        if (!validation.valid) {
          nf.status = "erro";
          nf.errors.push(...validation.errors);
        }
      });

      // Check duplicates in DB by numero
      const numeros = Array.from(grouped.keys());
      if (numeros.length > 0) {
        const { data: existentes } = await supabase
          .from("notas_fiscais")
          .select("numero")
          .eq("origem", "importacao_historica")
          .in("numero", numeros);

        const existentesSet = new Set(existentes?.map(e => e.numero));
        grouped.forEach(nf => {
          if (existentesSet.has(nf.numero)) {
            nf.status = "erro";
            nf.errors.push("Nota Fiscal já cadastrada no sistema (histórico).");
          }
        });
      }

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

      // Insert NF headers + items sequentially to get IDs for item FK
      let importedCount = 0;
      for (const nf of validos) {
        const { data: nfRow, error: nfError } = await supabase
          .from("notas_fiscais")
          .insert({
            tipo: "saida",
            numero: nf.numero,
            chave_acesso: nf.chave_acesso || null,
            data_emissao: nf.data_emissao,
            valor_total: nf.valor_total,
            cliente_id: nf.cliente_id || null,
            status: "confirmada",
            origem: "importacao_historica",
            // ⬇ Historical document: must NOT generate stock or financial entries
            movimenta_estoque: false,
            gera_financeiro: false,
            observacoes: `Faturamento histórico – Lote ${currentLoteId}`,
          })
          .select("id")
          .single();

        if (nfError) {
          console.error(`Erro ao criar NF ${nf.numero}:`, nfError.message);
          continue;
        }

        const nfId = nfRow.id;

        // Insert all items for this NF
        if (nf.itens && nf.itens.length > 0) {
          const itensPayload = nf.itens.map((item: any) => ({
            nota_fiscal_id: nfId,
            produto_id: item.produto_id || null,
            descricao: item.nome_produto || item.descricao || "Item",
            cfop: item.cfop || null,
            ncm: item.ncm || null,
            cst: item.cst || null,
            unidade: item.unidade || "UN",
            quantidade: item.quantidade || 1,
            valor_unitario: item.valor_unitario || 0,
            valor_total: item.valor_total || 0,
            icms_valor: item.icms_valor || 0,
            ipi_valor: item.ipi_valor || 0,
            pis_valor: item.pis_valor || 0,
            cofins_valor: item.cofins_valor || 0,
          }));

          const { error: itensError } = await supabase
            .from("notas_fiscais_itens")
            .insert(itensPayload);

          if (itensError) {
            console.error(`Erro ao inserir itens da NF ${nf.numero}:`, itensError.message);
          }
        }

        importedCount++;
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: importedCount,
        })
        .eq("id", currentLoteId);

      toast.success(`${importedCount} notas fiscais históricas importadas (sem impacto em estoque/financeiro).`);
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
