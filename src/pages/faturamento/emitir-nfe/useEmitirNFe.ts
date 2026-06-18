import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { aplicarMatrizFiscal } from "@/services/fiscal/tributacao.service";
import { notifyError } from "@/utils/errorMessages";
import {
  fetchClienteParaWizard,
  fetchNFReferenciadaParaWizard,
  fetchOrdemVendaParaWizard,
} from "@/services/fiscal/emitirNfe/wizardLoaders.service";
import { salvarRascunhoNFe } from "@/services/fiscal/emitirNfe/salvarRascunho.service";
import {
  STEPS,
  WIZARD_DEFAULTS,
  wizardSchema,
  type WizardData,
  type WizardItem,
} from "./schema";

/**
 * Orquestração do wizard NF-e:
 * - form (react-hook-form + zod);
 * - cálculos de totais;
 * - auto-preenchimento via querystring (cliente_id, ovId, refNFeId);
 * - navegação (next/prev/validarStep);
 * - persistência do rascunho.
 *
 * Comportamento idêntico ao monólito anterior (`EmitirNFeWizard.tsx`).
 */
export function useEmitirNFe() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const form = useForm<WizardData>({
    resolver: zodResolver(wizardSchema),
    defaultValues: WIZARD_DEFAULTS,
  });

  const itens = form.watch("itens");
  const frete = form.watch("frete_valor") ?? 0;
  const desconto = form.watch("desconto_valor") ?? 0;
  const outras = form.watch("outras_despesas") ?? 0;

  const totalProdutos = useMemo(
    () => (itens || []).reduce((s, i) => s + Number(i.valor_total || 0), 0),
    [itens],
  );
  const totalNF = useMemo(
    () => +(totalProdutos + Number(frete) + Number(outras) - Number(desconto)).toFixed(2),
    [totalProdutos, frete, outras, desconto],
  );

  const carregarOrdemVenda = useCallback(
    async (ovId: string) => {
      try {
        const ov = await fetchOrdemVendaParaWizard(ovId);
        if (!ov) {
          toast.error("Ordem de venda não encontrada.");
          return;
        }
        const cli = ov.cliente;
        form.setValue("ordem_venda_id", ov.id);
        form.setValue("ordem_venda_numero", ov.numero);
        if (cli) {
          form.setValue("cliente_id", cli.id);
          form.setValue("cliente_nome", cli.nome_razao_social);
          form.setValue("cliente_uf", (cli.uf ?? "").toUpperCase());
          form.setValue("cliente_municipio_ibge", cli.codigo_ibge_municipio ?? "");
        }
        const freteMap: Record<string, WizardData["frete_modalidade"]> = {
          cif: "0", fob: "1", terceiros: "2", proprio: "3", sem_frete: "9",
        };
        if (ov.frete_tipo) form.setValue("frete_modalidade", freteMap[ov.frete_tipo] ?? "9");
        form.setValue("frete_valor", Number(ov.frete_valor ?? 0));
        const obsBase = `Ref. Pedido de Venda nº ${ov.numero}`;
        form.setValue("observacoes", ov.observacoes ? `${obsBase}. ${ov.observacoes}` : obsBase);

        const itensWizard = (ov.itens ?? [])
          .map((it) => {
            const restante = Number(it.quantidade ?? 0) - Number(it.quantidade_faturada ?? 0);
            if (restante <= 0) return null;
            const vu = Number(it.valor_unitario ?? 0);
            const total = +(restante * vu).toFixed(2);
            return {
              produto_id: it.produto_id,
              codigo_produto: it.codigo_snapshot ?? "",
              descricao: it.descricao_snapshot ?? "",
              ncm: (it.produto?.ncm ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8),
              cfop: "5102",
              cst: "00",
              origem_mercadoria: "0",
              unidade: it.unidade ?? "UN",
              quantidade: restante,
              valor_unitario: vu,
              valor_total: total,
              icms_aliquota: 0, icms_base: total, icms_valor: 0,
              ipi_aliquota: 0, ipi_valor: 0,
              pis_aliquota: 0, pis_valor: 0,
              cofins_aliquota: 0, cofins_valor: 0,
              matriz_aplicada: false,
            } as WizardItem;
          })
          .filter((x): x is WizardItem => x !== null);

        form.setValue("itens", itensWizard);
        toast.success(
          `Pedido ${ov.numero} carregado: ${itensWizard.length} ${itensWizard.length === 1 ? "item" : "itens"} prontos para faturar. Aplique a matriz fiscal nos itens.`,
        );

        const ufDestino = form.getValues("cliente_uf");
        if (ufDestino && itensWizard.length > 0) {
          toast.info("Aplicando matriz fiscal automaticamente…");
          let aplicadas = 0;
          for (let i = 0; i < itensWizard.length; i++) {
            const it = itensWizard[i];
            if (!it.produto_id) continue;
            try {
              const mr = await aplicarMatrizFiscal({
                produtoId: it.produto_id,
                ufDestino,
                tipoOperacao: "saida",
              });
              if (mr?.matched) {
                if (mr.cfop) form.setValue(`itens.${i}.cfop`, mr.cfop);
                if (mr.cst_csosn) form.setValue(`itens.${i}.cst`, mr.cst_csosn);
                form.setValue(`itens.${i}.icms_aliquota`, Number(mr.aliquota_icms ?? 0));
                form.setValue(`itens.${i}.pis_aliquota`, Number(mr.aliquota_pis ?? 0));
                form.setValue(`itens.${i}.cofins_aliquota`, Number(mr.aliquota_cofins ?? 0));
                form.setValue(`itens.${i}.matriz_aplicada`, true);
                aplicadas++;
              }
            } catch {
              /* segue: matriz pode ser ajustada manualmente */
            }
          }
          if (aplicadas > 0) {
            toast.success(`Matriz fiscal aplicada em ${aplicadas} de ${itensWizard.length} itens.`);
          }
        }
      } catch (err) {
        notifyError(err);
      }
    },
    [form],
  );

  const carregarNFReferenciada = useCallback(
    async (nfId: string, finalidade: WizardData["finalidade"]) => {
      try {
        const nfRef = await fetchNFReferenciadaParaWizard(nfId);
        if (!nfRef) {
          toast.error("NF de referência não encontrada.");
          return;
        }
        const ehDevolucao = finalidade === "4";
        form.setValue("finalidade", finalidade);
        if (ehDevolucao) {
          form.setValue("tipo_operacao", "entrada");
        }
        form.setValue("nf_referenciada_id", nfRef.id);
        form.setValue("nf_referenciada_chave", nfRef.chave_acesso ?? "");

        const cli = nfRef.cliente;
        if (cli) {
          form.setValue("cliente_id", cli.id);
          form.setValue("cliente_nome", cli.nome_razao_social);
          form.setValue("cliente_uf", (cli.uf ?? "").toUpperCase());
          form.setValue("cliente_municipio_ibge", cli.codigo_ibge_municipio ?? "");
        }

        const obsRef = `Ref. NF-e nº ${nfRef.numero}/${nfRef.serie} chave ${nfRef.chave_acesso ?? "—"}`;
        const obsAtual = nfRef.observacoes ?? "";
        form.setValue("observacoes", obsAtual ? `${obsRef}. ${obsAtual}` : obsRef);

        const inverterCfop = (cfop: string | null): string => {
          if (!cfop || cfop.length !== 4) return cfop ?? "1202";
          if (cfop.startsWith("5")) return "1" + cfop.slice(1);
          if (cfop.startsWith("6")) return "2" + cfop.slice(1);
          return cfop;
        };

        const itensRef = nfRef.itens ?? [];
        const itensWizard = itensRef.map((it) => {
          const cfopOriginal = (it.cfop as string | null) ?? null;
          return {
            produto_id: (it.produto_id as string | null) ?? null,
            codigo_produto: (it.codigo_produto as string | null) ?? "",
            descricao: (it.descricao as string | null) ?? "",
            ncm: ((it.ncm as string | null) ?? "").replace(/\D/g, "").padStart(8, "0").slice(-8),
            cfop: ehDevolucao ? inverterCfop(cfopOriginal) : (cfopOriginal ?? "5102"),
            cst: (it.cst as string | null) ?? "00",
            origem_mercadoria: (it.origem_mercadoria as string | null) ?? "0",
            unidade: (it.unidade as string | null) ?? "UN",
            quantidade: Number(it.quantidade ?? 0),
            valor_unitario: Number(it.valor_unitario ?? 0),
            valor_total: Number(it.valor_total ?? 0),
            icms_aliquota: Number(it.icms_aliquota ?? 0),
            icms_base: Number(it.icms_base ?? 0),
            icms_valor: Number(it.icms_valor ?? 0),
            ipi_aliquota: Number(it.ipi_aliquota ?? 0),
            ipi_valor: Number(it.ipi_valor ?? 0),
            pis_aliquota: Number(it.pis_aliquota ?? 0),
            pis_valor: Number(it.pis_valor ?? 0),
            cofins_aliquota: Number(it.cofins_aliquota ?? 0),
            cofins_valor: Number(it.cofins_valor ?? 0),
            matriz_aplicada: false,
          } as WizardItem;
        });

        form.setValue("itens", itensWizard);
        toast.success(
          ehDevolucao
            ? `NF ${nfRef.numero} carregada como devolução (CFOP invertido). Revise quantidades e tributos.`
            : `NF ${nfRef.numero} carregada como complementar.`,
        );
      } catch (err) {
        notifyError(err);
      }
    },
    [form],
  );

  // Pre-seleção via querystring
  useEffect(() => {
    const cid = searchParams.get("cliente_id");
    if (cid && !form.getValues("cliente_id")) {
      void fetchClienteParaWizard(cid).then((data) => {
        if (!data) return;
        form.setValue("cliente_id", data.id);
        form.setValue("cliente_nome", data.nome_razao_social);
        form.setValue("cliente_uf", (data.uf ?? "").toUpperCase());
        form.setValue("cliente_municipio_ibge", data.codigo_ibge_municipio ?? "");
      });
    }
    const ovId = searchParams.get("ovId");
    if (ovId && !form.getValues("ordem_venda_id")) {
      void carregarOrdemVenda(ovId);
    }
    const refNFeId = searchParams.get("refNFeId");
    const finalidadeQS = searchParams.get("finalidade");
    if (refNFeId) {
      const fin = (finalidadeQS === "2" || finalidadeQS === "3" || finalidadeQS === "4")
        ? finalidadeQS as WizardData["finalidade"]
        : "4";
      void carregarNFReferenciada(refNFeId, fin);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validarStep = useCallback(
    async (n: number): Promise<boolean> => {
      const fields: Record<number, (keyof WizardData)[]> = {
        0: ["natureza_codigo", "natureza_descricao", "data_emissao"],
        1: ["cliente_id", "cliente_uf", "cliente_municipio_ibge"],
        2: ["itens"],
        3: [],
      };
      const ok = await form.trigger(fields[n]);
      if (!ok) toast.error("Corrija os campos destacados antes de avançar.");
      return ok;
    },
    [form],
  );

  const next = useCallback(async () => {
    if (await validarStep(step)) setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }, [step, validarStep]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(s - 1, 0));
  }, []);

  const salvarRascunho = useCallback(async () => {
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Há erros nos passos anteriores. Revise e tente novamente.");
      return;
    }
    const data = form.getValues();
    setSaving(true);
    try {
      const { id } = await salvarRascunhoNFe(data);
      toast.success("Rascunho salvo. Pronto para transmitir!");
      navigate(`/fiscal/${id}`);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }, [form, navigate]);

  return {
    form,
    step,
    setStep,
    saving,
    totalNF,
    next,
    prev,
    salvarRascunho,
  };
}