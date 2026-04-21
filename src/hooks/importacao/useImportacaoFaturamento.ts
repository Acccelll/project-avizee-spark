import { useState, useCallback } from "react";
import * as XLSX from "@/lib/xlsx-compat";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { validateFaturamentoImport } from "@/lib/importacao/validators";
import { FIELD_ALIASES, FATURAMENTO_FIELD_ALIASES } from "@/lib/importacao/aliases";
import { validarChaveAcesso, extrairInformacoesChave } from "@/services/fiscal/validadores/chaveAcesso.validator";
import { normalizeText } from "@/lib/importacao/normalizers";
import { Mapping } from "./types";

export interface GroupedNF {
  numero: string;
  serie: string;
  cliente_nome: string;
  cliente_id?: string | null;
  cpf_cnpj_destinatario?: string | null;
  chave_acesso?: string | null;
  municipio?: string | null;
  uf?: string | null;
  data_emissao: string;
  valor_total: number;
  itens_count: number;
  status: "valido" | "erro" | "duplicado";
  errors: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  itens: any[];
}

/**
 * Hook de importação de faturamento histórico com staging real.
 *
 * Fluxo:
 *  1. generatePreview — valida, agrupa NFs, resolve cliente/produto (sem escrita)
 *  2. processImport  — grava em stg_faturamento + importacao_lotes (status "staging")
 *  3. finalizeImport — chama RPC consolidar_lote_faturamento
 */
export function useImportacaoFaturamento() {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>("");
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
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
      } catch (err: unknown) {
        toast.error(`Erro ao ler arquivo: ${err instanceof Error ? err.message : String(err)}`);
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
        // Faturamento usa um mapa específico (resolve ambiguidades como TOTAL/QUANTIDADE).
        // Se não houver match no específico, recai para o global.
        const target = FATURAMENTO_FIELD_ALIASES[cleanH] || FIELD_ALIASES[cleanH];
        if (target && !initialMapping[target]) {
          initialMapping[target] = h;
        }
      });
      setMapping(initialMapping);
    }
  }, [workbook]);

  const generatePreview = useCallback(async () => {
    if (rawRows.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: clientes } = await supabase
        .from("clientes")
        .select("id, nome_razao_social, cpf_cnpj");
      const clienteByCpf = new Map(
        clientes?.filter((c: any) => c.cpf_cnpj).map((c: any) => [String(c.cpf_cnpj).replace(/\D/g, ""), c.id]) || []
      );
      const clienteByName = new Map(
        clientes?.map((c: any) => [String(c.nome_razao_social).toUpperCase(), c.id]) || []
      );

      const { data: produtosBanco } = await supabase
        .from("produtos")
        .select("id, codigo_interno, codigo_legado, nome");
      const prodByLegado = new Map(
        produtosBanco?.filter((p: any) => p.codigo_legado).map((p: any) => [p.codigo_legado, p.id]) || []
      );
      const prodByInterno = new Map(
        produtosBanco?.filter((p: any) => p.codigo_interno).map((p: any) => [p.codigo_interno, p.id]) || []
      );

      // Aba Produtos do mesmo workbook (1031 itens com COD./GRUPO/Nome/Custo).
      // Usada SOMENTE para enriquecer o lookup das NFs (não persiste cadastro).
      // Resolve códigos da NF que não batem com codigo_legado/codigo_interno do banco
      // mas casam por nome aproximado de produto.
      const prodAuxByCodigo = new Map<string, { nome: string; grupo?: string }>();
      const prodIdByNomeNorm = new Map<string, string>();
      (produtosBanco ?? []).forEach((p: any) => {
        if (p.nome) prodIdByNomeNorm.set(String(p.nome).toUpperCase().trim(), p.id);
      });
      if (workbook) {
        const sheetProdutos = workbook.SheetNames.find(
          n => n.toUpperCase().trim() === "PRODUTOS"
        );
        if (sheetProdutos) {
          const wsProd = workbook.Sheets[sheetProdutos];
          const rowsProd = XLSX.utils.sheet_to_json(wsProd) as Record<string, unknown>[];
          rowsProd.forEach(r => {
            const cod = r["COD."] ?? r["Cod."] ?? r["CÓDIGO"] ?? r["CODIGO"];
            const nome = r["Nome"] ?? r["NOME"] ?? r["DESCRIÇÃO"];
            if (cod && nome) {
              prodAuxByCodigo.set(String(cod).trim(), {
                nome: String(nome).trim(),
                grupo: r["GRUPO"] ? String(r["GRUPO"]).trim() : undefined,
              });
            }
          });
        }
      }

      const grouped = new Map<string, GroupedNF>();

      rawRows.forEach((row, index) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mappedRow: any = {};
        Object.entries(mapping).forEach(([field, colName]) => {
          mappedRow[field] = row[colName];
        });

        const validation = validateFaturamentoImport(mappedRow);
        const nd = validation.normalizedData;
        const numero = nd.numero_nota || `S/N-${index}`;

        // Extrai série real da chave de acesso (posições 22-25). Fallback "1".
        let serieReal = "1";
        const chaveLimpa = String(nd.chave_acesso || "").replace(/\D/g, "");
        if (chaveLimpa.length === 44 && validarChaveAcesso(chaveLimpa)) {
          serieReal = String(parseInt(extrairInformacoesChave(chaveLimpa).serie, 10));
        }

        // Chave do agrupamento: numero + serie + data (uma NF por combinação).
        const groupKey = `${numero}|${serieReal}|${nd.data_emissao || ""}`;

        if (!grouped.has(groupKey)) {
          const cpfClean = String(nd.cpf_cnpj_destinatario || "").replace(/\D/g, "");
          const clienteId = (cpfClean && clienteByCpf.get(cpfClean))
            || clienteByName.get(String(nd.cliente_nome || "").toUpperCase())
            || null;

          grouped.set(groupKey, {
            numero: numero as string,
            serie: serieReal,
            cliente_nome: nd.cliente_nome as string,
            cliente_id: clienteId,
            cpf_cnpj_destinatario: nd.cpf_cnpj_destinatario as string,
            chave_acesso: nd.chave_acesso as string,
            data_emissao: nd.data_emissao as string,
            municipio: nd.municipio as string,
            uf: nd.uf as string,
            valor_total: 0,
            itens_count: 0,
            status: "valido",
            errors: [...validation.errors],
            itens: []
          });
        }

        const nf = grouped.get(groupKey)!;

        const codigoProduto = nd.codigo_produto_nf || nd.codigo_legado_produto || "";
        let produtoId = (nd.codigo_legado_produto && prodByLegado.get(nd.codigo_legado_produto as string))
          || (nd.codigo_produto_nf && prodByInterno.get(nd.codigo_produto_nf as string))
          || null;

        // Fallback: se o código da NF bate com a aba Produtos do workbook,
        // tenta resolver pelo nome do produto da aba auxiliar.
        if (!produtoId && codigoProduto) {
          const aux = prodAuxByCodigo.get(String(codigoProduto).trim());
          if (aux?.nome) {
            produtoId = prodIdByNomeNorm.get(aux.nome.toUpperCase().trim()) || null;
          }
        }
        // Último fallback: nome do produto da própria NF.
        if (!produtoId && nd.nome_produto) {
          produtoId = prodIdByNomeNorm.get(String(nd.nome_produto).toUpperCase().trim()) || null;
        }

        nd.produto_id = produtoId;
        nf.itens.push({ ...nd, _originalLine: index + 2, _originalRow: row });
        nf.itens_count++;
        // Soma valor por linha (cada linha = 1 item). valor_total já foi resolvido
        // pelo validator priorizando T. PRODUTOS (subtotal por item) sobre TOTAL (total da NF).
        nf.valor_total += Number(nd.valor_total || 0);
        if (!validation.valid) {
          nf.status = "erro";
          nf.errors.push(...validation.errors);
        }
      });

      // Dedup contra banco: prioriza chave_acesso; fallback por numero+serie+data.
      const todas = Array.from(grouped.values());
      const chaves = todas.map(n => n.chave_acesso).filter(Boolean) as string[];
      const numeros = todas.map(n => n.numero);
      const [{ data: porChave }, { data: porNumero }] = await Promise.all([
        chaves.length
          ? supabase.from("notas_fiscais").select("chave_acesso").in("chave_acesso", chaves)
          : Promise.resolve({ data: [] as { chave_acesso: string | null }[] }),
        numeros.length
          ? supabase.from("notas_fiscais")
              .select("numero, serie, data_emissao")
              .eq("origem", "importacao_historica")
              .in("numero", numeros)
          : Promise.resolve({ data: [] as { numero: string; serie: string | null; data_emissao: string | null }[] }),
      ]);
      const chavesExistentes = new Set((porChave ?? []).map(r => r.chave_acesso).filter(Boolean) as string[]);
      const triplas = new Set(
        (porNumero ?? []).map(r => `${r.numero}|${String(r.serie ?? "1")}|${String(r.data_emissao ?? "").slice(0, 10)}`)
      );
      grouped.forEach(nf => {
        const chaveOk = nf.chave_acesso && chavesExistentes.has(nf.chave_acesso);
        const tripla = `${nf.numero}|${nf.serie}|${String(nf.data_emissao ?? "").slice(0, 10)}`;
        if (chaveOk || triplas.has(tripla)) {
          nf.status = "duplicado";
          nf.errors.push("NF já cadastrada (histórico).");
        }
      });

      setPreviewData(Array.from(grouped.values()));
    } catch (err: unknown) {
      toast.error(`Erro ao gerar prévia: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [rawRows, mapping, workbook]);

  /**
   * Faz staging + consolidação em uma única chamada (sem etapa manual de confirmação).
   */
  const processImport = async () => {
    if (previewData.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      const validos = previewData.filter(i => i.status === "valido");
      const errosCount = previewData.length - validos.length;
      const totalItens = validos.reduce((s, nf) => s + nf.itens_count, 0);
      const totalValor = validos.reduce((s, nf) => s + nf.valor_total, 0);
      const comCliente = validos.filter(nf => nf.cliente_id).length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const comProduto = validos.reduce((s, nf) => s + nf.itens.filter((i: any) => i.produto_id).length, 0);

      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: "faturamento",
          arquivo_nome: file?.name,
          status: "staging",
          fase: "faturamento",
          total_registros: rawRows.length,
          registros_sucesso: 0,
          registros_erro: errosCount,
          usuario_id: user?.user?.id,
          resumo: {
            nfs: validos.length,
            itens: totalItens,
            valor_total: totalValor,
            pct_com_cliente: validos.length > 0 ? Math.round((comCliente / validos.length) * 100) : 0,
            pct_com_produto: totalItens > 0 ? Math.round((comProduto / totalItens) * 100) : 0,
          },
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      // Write each NF as a single staging row with itens embedded
      if (validos.length > 0) {
        const stagingRows = validos.map(nf => ({
          lote_id: currentLoteId,
          dados: {
            numero: nf.numero,
            serie: nf.serie || "1",
            data_emissao: nf.data_emissao,
            chave_acesso: nf.chave_acesso,
            valor_total: nf.valor_total,
            valor_produtos: nf.valor_total,
            cpf_cnpj_cliente: nf.cpf_cnpj_destinatario,
            cliente_nome: nf.cliente_nome,
            cliente_cidade: nf.municipio,
            cliente_uf: nf.uf,
            natureza_operacao: "VENDA",
            tipo: "saida",
            tipo_operacao: "venda",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            itens: nf.itens.map((item: any) => ({
              codigo_produto: item.codigo_produto_nf,
              codigo_legado_produto: item.codigo_legado_produto,
              produto_id: item.produto_id || null,
              descricao: item.nome_produto || item.descricao || "Item",
              quantidade: item.quantidade || 1,
              unidade: item.unidade || "UN",
              valor_unitario: item.valor_unitario || 0,
              valor_total: item.valor_total || 0,
              ncm: item.ncm,
              cfop: item.cfop,
              cst: item.cst,
              icms_valor: item.icms_valor || 0,
              ipi_valor: item.ipi_valor || 0,
              pis_valor: item.pis_valor || 0,
              cofins_valor: item.cofins_valor || 0,
            })),
          },
          status: "pendente",
        }));

        for (let i = 0; i < stagingRows.length; i += 200) {
          const batch = stagingRows.slice(i, i + 200);
          const { error: stgError } = await supabase.from("stg_faturamento").insert(batch);
          if (stgError) throw stgError;
        }
      }

      await supabase.from("importacao_logs").insert({
        lote_id: currentLoteId,
        nivel: "info",
        mensagem: `Staging de faturamento: ${validos.length} NFs, ${totalItens} itens, valor total R$ ${totalValor.toFixed(2)}.`,
      });

      // Consolida automaticamente — sem etapa manual de confirmação
      const { data: consolidData, error: consolidError } = await supabase.rpc(
        "consolidar_lote_faturamento",
        { p_lote_id: currentLoteId }
      );
      if (consolidError) throw consolidError;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = consolidData as any;
      if (result?.erro) {
        toast.error(`Erro na consolidação: ${result.erro}`);
        return currentLoteId;
      }

      await supabase.from("importacao_logs").insert({
        lote_id: currentLoteId,
        nivel: "info",
        mensagem: `Consolidação automática: ${result?.nfs_inseridas ?? 0} NFs, ${result?.itens_inseridos ?? 0} itens, ${result?.erros ?? 0} erros.`,
      });

      toast.success(
        `Importação concluída: ${result?.nfs_inseridas ?? validos.length} NFs e ${result?.itens_inseridos ?? totalItens} itens gravados.`
      );
      return currentLoteId;

    } catch (error: unknown) {
      console.error("Erro na importação de faturamento:", error);
      toast.error(`Falha no processamento: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Mantido por compatibilidade com a UI atual; o processImport já consolidou.
  const finalizeImport = async (_loteIdParam?: string) => {
    return true;
  };

  const cancelLote = async (loteIdParam?: string) => {
    const targetLoteId = loteIdParam || loteId;
    if (!targetLoteId) return;
    try {
      await supabase.from("stg_faturamento").delete().eq("lote_id", targetLoteId);
      await supabase.from("importacao_lotes").update({ status: "cancelado" }).eq("id", targetLoteId);
      toast.info("Lote cancelado.");
    } catch (err: unknown) {
      toast.error(`Erro ao cancelar: ${err instanceof Error ? err.message : String(err)}`);
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
    cancelLote,
    loteId
  };
}
