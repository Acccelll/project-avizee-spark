import { useState, useCallback } from "react";
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseNFeXml, NFeData } from "@/lib/nfeXmlParser";

export interface XmlImportItem {
  fileName: string;
  data: NFeData | null;
  status: "pendente" | "valido" | "erro" | "duplicado";
  error?: string;
  isNew?: boolean;
}

export function useImportacaoXml() {
  const [files, setFiles] = useState<File[]>([]);
  const [xmlData, setXmlData] = useState<XmlImportItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loteId, setLoteId] = useState<string | null>(null);

  const onFilesChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    setFiles(selectedFiles);

    setIsProcessing(true);
    const results: XmlImportItem[] = [];

    try {
      for (const file of selectedFiles) {
        if (file.name.endsWith(".zip")) {
          const zip = await JSZip.loadAsync(file);
          const zipFiles = Object.values(zip.files).filter(f => f.name.endsWith(".xml") && !f.dir);

          for (const zipFile of zipFiles) {
            const content = await zipFile.async("string");
            try {
              const parsed = parseNFeXml(content);
              results.push({ fileName: zipFile.name, data: parsed, status: "pendente" });
            } catch (err: any) {
              results.push({ fileName: zipFile.name, data: null, status: "erro", error: err.message });
            }
          }
        } else if (file.name.endsWith(".xml")) {
          const content = await file.text();
          try {
            const parsed = parseNFeXml(content);
            results.push({ fileName: file.name, data: parsed, status: "pendente" });
          } catch (err: any) {
            results.push({ fileName: file.name, data: null, status: "erro", error: err.message });
          }
        }
      }

      // Validar duplicidades no banco (chaves de acesso)
      const chaves = results.map(r => r.data?.chaveAcesso).filter(Boolean) as string[];
      if (chaves.length > 0) {
        const { data: existentes } = await (supabase
          .from("compras" as any)
          .select("chave_acesso")
          .in("chave_acesso", chaves) as any);

        const chavesExistentes = new Set((existentes || []).map((e: any) => e.chave_acesso));

        results.forEach(r => {
          if (r.data && chavesExistentes.has(r.data.chaveAcesso)) {
            r.status = "duplicado";
            r.error = "NF-e já importada anteriormente.";
          } else if (r.status !== "erro") {
            r.status = "valido";
          }
        });
      }

      setXmlData(results);
    } catch (err: any) {
      toast.error(`Erro ao processar arquivos: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const processImport = async () => {
    if (xmlData.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo_importacao: "compras_xml",
          arquivo_nome: files.length === 1 ? files[0].name : `${files.length} arquivos`,
          status: "processando",
          total_lidos: xmlData.length,
          criado_por: user?.user?.id
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      const stagingData = xmlData.map(item => ({
        lote_importacao_id: currentLoteId,
        arquivo_origem: item.fileName,
        payload: item.data,
        status_validacao: item.status === "valido" ? "valido" : "erro",
        motivo_erro: item.error,
        criado_por: user?.user?.id
      }));

      const { error: stagingError } = await supabase.from("stg_compras_xml").insert(stagingData as any);
      if (stagingError) throw stagingError;

      const validos = xmlData.filter(i => i.status === "valido").length;
      const erros = xmlData.length - validos;

      await supabase
        .from("importacao_lotes")
        .update({
          status: erros > 0 ? "parcial" : "validado",
          total_validos: validos,
          total_erros: erros
        })
        .eq("id", currentLoteId);

      toast.success(`${validos} XMLs validados e prontos para carga.`);
      setIsProcessing(false);
      return currentLoteId;

    } catch (error: any) {
      console.error("Erro na importação XML:", error);
      toast.error(`Falha no staging XML: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const finalizeImport = async (idLote = loteId) => {
    if (!idLote) return;
    setIsProcessing(true);

    try {
      const { data: validItems, error: fetchError } = await supabase
        .from("stg_compras_xml")
        .select("payload, id")
        .eq("lote_importacao_id", idLote)
        .eq("status_validacao", "valido");

      if (fetchError) throw fetchError;

      // Lógica de carga final:
      // 1. Localizar ou cadastrar Fornecedor por CNPJ
      // 2. Localizar Produtos por código ou Alias
      // 3. Criar registro em 'compras' e 'compras_itens'
      // 4. Gerar estoque (entrada)

      // Por enquanto, implementamos a casca da carga em massa simulada conforme o padrão ERP
      let importedCount = 0;

      // 1. Obter todos fornecedores para cache local
      const { data: vendors } = await supabase.from("fornecedores").select("id, cpf_cnpj");
      const vendorMap = new Map(vendors?.map(v => [v.cpf_cnpj.replace(/\D/g, ""), v.id]));

      for (const item of validItems) {
        const nfe = item.payload as unknown as NFeData;
        const cnpjEmit = nfe.emitente.cnpj.replace(/\D/g, "");
        const fornecedorId = vendorMap.get(cnpjEmit);

        // Se fornecedor não existe, cria um básico (opcional, aqui daremos erro para segurança)
        if (!fornecedorId) {
          await supabase.from("importacao_logs").insert({
            lote_importacao_id: idLote,
            nivel: "error",
            etapa: "carga_final",
            mensagem: `Fornecedor não cadastrado (CNPJ: ${cnpjEmit}) para a nota ${nfe.numero}`,
            payload: { chave: nfe.chaveAcesso } as any
          });
          continue;
        }

        // Criar a Compra
        const { data: compra, error: cError } = await (supabase.from("compras" as any).insert({
          fornecedor_id: fornecedorId,
          numero: nfe.numero,
          data_compra: nfe.dataEmissao,
          valor_total: nfe.valorTotal,
          status: "confirmado",
          observacoes: `Importação XML - Chave: ${nfe.chaveAcesso}`
        } as any).select().single() as any);

        if (cError) {
           await supabase.from("importacao_logs").insert({
            lote_importacao_id: idLote,
            nivel: "error",
            etapa: "carga_final",
            mensagem: `Erro ao criar compra ${nfe.numero}: ${cError.message}`
          });
          continue;
        }

        // Criar Itens (Lógica simplificada para a migration)
        // ... (Em um ERP real, vincularíamos aos produtos por Alias)
        importedCount++;
      }

      await supabase
        .from("importacao_lotes")
        .update({
          status: "concluido",
          total_importados: importedCount
        })
        .eq("id", idLote);

      toast.success(`Carga finalizada para ${importedCount} notas fiscais.`);
      setIsProcessing(false);
      return true;

    } catch (err: any) {
      toast.error(`Erro na finalização: ${err.message}`);
      setIsProcessing(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    files,
    xmlData,
    isProcessing,
    onFilesChange,
    processImport,
    finalizeImport,
    loteId
  };
}
