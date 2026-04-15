
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
            } catch (err: unknown) {
              results.push({ fileName: zipFile.name, data: null, status: "erro", error: err instanceof Error ? err.message : String(err) });
            }
          }
        } else if (file.name.endsWith(".xml")) {
          const content = await file.text();
          try {
            const parsed = parseNFeXml(content);
            results.push({ fileName: file.name, data: parsed, status: "pendente" });
          } catch (err: unknown) {
            results.push({ fileName: file.name, data: null, status: "erro", error: err instanceof Error ? err.message : String(err) });
          }
        }
      }

      // Check for duplicate chaveAcesso
      const chaves = results
        .filter(r => r.data?.chaveAcesso)
        .map(r => r.data!.chaveAcesso);

      if (chaves.length > 0) {
        const { data: existentes } = await supabase
          .from("notas_fiscais")
          .select("chave_acesso")
          .in("chave_acesso", chaves);

        const existSet = new Set(existentes?.map(e => e.chave_acesso));
        results.forEach(r => {
          if (r.data?.chaveAcesso && existSet.has(r.data.chaveAcesso)) {
            r.status = "duplicado";
            r.error = "Chave de acesso já cadastrada.";
          } else if (r.status === "pendente") {
            r.status = "valido";
          }
        });
      } else {
        results.forEach(r => {
          if (r.status === "pendente") r.status = "valido";
        });
      }

      setXmlData(results);
    } catch (err: unknown) {
      toast.error(`Erro ao processar arquivos: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const processImport = async () => {
    if (xmlData.length === 0) return;
    setIsProcessing(true);

    try {
      const { data: user } = await supabase.auth.getUser();
      const validos = xmlData.filter(i => i.status === "valido");
      const errosCount = xmlData.length - validos.length;

      const { data: lote, error: loteError } = await supabase
        .from("importacao_lotes")
        .insert({
          tipo: "compras_xml",
          arquivo_nome: files.length === 1 ? files[0].name : `${files.length} arquivos`,
          status: "processando",
          total_registros: xmlData.length,
          registros_sucesso: validos.length,
          registros_erro: errosCount,
          usuario_id: user?.user?.id,
        })
        .select()
        .single();

      if (loteError) throw loteError;
      const currentLoteId = lote.id;
      setLoteId(currentLoteId);

      // Import valid XMLs directly into compras
      const { data: vendors } = await supabase.from("fornecedores").select("id, cpf_cnpj");
      const vendorMap = new Map(vendors?.map(v => [v.cpf_cnpj?.replace(/\D/g, ""), v.id]));

      const itemsComDados = validos.filter((i): i is XmlImportItem & { data: NFeData } => i.data !== null);

      // Split by whether the supplier is registered
      const semFornecedor = itemsComDados.filter(item => !vendorMap.get(item.data.emitente.cnpj.replace(/\D/g, "")));
      const comFornecedor = itemsComDados.filter(item => vendorMap.get(item.data.emitente.cnpj.replace(/\D/g, "")));

      // Batch-insert all "no vendor" error logs in one round-trip
      if (semFornecedor.length > 0) {
        await supabase.from("importacao_logs").insert(
          semFornecedor.map(item => ({
            lote_id: currentLoteId,
            nivel: "error",
            mensagem: `Fornecedor não cadastrado (CNPJ: ${item.data.emitente.cnpj.replace(/\D/g, "")}) para a nota ${item.data.numero}`,
          }))
        );
      }

      // Insert all valid compras in parallel
      const insertResults = await Promise.all(
        comFornecedor.map(item => {
          const nfe = item.data;
          const fornecedorId = vendorMap.get(nfe.emitente.cnpj.replace(/\D/g, ""));
          return supabase.from("compras").insert({
            fornecedor_id: fornecedorId,
            numero: nfe.numero,
            data_compra: nfe.dataEmissao,
            valor_total: nfe.valorTotal,
            status: "confirmado",
            observacoes: `Importação XML - Chave: ${nfe.chaveAcesso}`,
          }).then(({ error }) => ({ nfe, error }));
        })
      );

      // Batch-insert error logs for any failed inserts
      const failures = insertResults.filter(r => r.error);
      if (failures.length > 0) {
        await supabase.from("importacao_logs").insert(
          failures.map(({ nfe, error: cError }) => ({
            lote_id: currentLoteId,
            nivel: "error",
            mensagem: `Erro ao criar compra ${nfe.numero}: ${cError?.message ?? 'Erro desconhecido'}`,
          }))
        );
      }

      const importedCount = insertResults.filter(r => !r.error).length;

      await supabase
        .from("importacao_lotes")
        .update({
          status: errosCount > 0 ? "parcial" : "concluido",
          registros_sucesso: importedCount,
        })
        .eq("id", currentLoteId);

      toast.success(`${importedCount} notas XML importadas.`);
      setIsProcessing(false);
      return currentLoteId;

    } catch (error: unknown) {
      console.error("Erro na importação XML:", error);
      toast.error(`Falha na importação: ${error instanceof Error ? error.message : String(error)}`);
      setIsProcessing(false);
    }
  };

  const finalizeImport = async () => {
    toast.info("Importação já foi concluída no passo anterior.");
    return true;
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
