import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useDebounce } from "@/hooks/useDebounce";
import { aplicarMatrizFiscal } from "@/services/fiscal/tributacao.service";
import { getEmpresaConfigPrincipal } from "@/services/fiscal/empresaConfig.service";
import { formatCurrency } from "@/lib/format";
import { notifyError } from "@/utils/errorMessages";
import type { WizardData } from "../schema";

interface ProdutoRow {
  id: string;
  codigo_interno: string | null;
  sku: string | null;
  nome: string | null;
  descricao: string | null;
  ncm: string | null;
  unidade_medida: string | null;
  preco_venda: number | null;
  variacoes?: unknown;
}

function ItemRow({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { register, watch, setValue, getValues, formState } = useFormContext<WizardData>();
  const item = watch(`itens.${index}`);
  const ufDestino = watch("cliente_uf");

  const recalc = () => {
    const current = getValues(`itens.${index}`);
    const q = Number(current.quantidade || 0);
    const v = Number(current.valor_unitario || 0);
    const total = +(q * v).toFixed(2);
    setValue(`itens.${index}.valor_total`, total, { shouldDirty: true });
    setValue(`itens.${index}.icms_base`, total, { shouldDirty: true });
    setValue(
      `itens.${index}.icms_valor`,
      +((total * Number(current.icms_aliquota || 0)) / 100).toFixed(2),
      { shouldDirty: true },
    );
    setValue(
      `itens.${index}.pis_valor`,
      +((total * Number(current.pis_aliquota || 0)) / 100).toFixed(2),
      { shouldDirty: true },
    );
    setValue(
      `itens.${index}.cofins_valor`,
      +((total * Number(current.cofins_aliquota || 0)) / 100).toFixed(2),
      { shouldDirty: true },
    );
    setValue(
      `itens.${index}.ipi_valor`,
      +((total * Number(current.ipi_aliquota || 0)) / 100).toFixed(2),
      { shouldDirty: true },
    );
  };

  const aplicarMatriz = async () => {
    if (!item.produto_id) {
      toast.warning("Vincule a um produto para aplicar a matriz fiscal.");
      return;
    }
    if (!ufDestino) {
      toast.warning("Selecione o destinatário antes.");
      return;
    }
    let r;
    try {
      r = await aplicarMatrizFiscal({
        produtoId: item.produto_id,
        ufDestino,
        tipoOperacao: "saida",
      });
    } catch (error) {
      notifyError(error);
      return;
    }
    if (!r?.matched) {
      toast.warning("Nenhuma regra fiscal cadastrada para essa combinação.");
      return;
    }
    setValue(`itens.${index}.cfop`, r.cfop ?? item.cfop, { shouldDirty: true });
    setValue(`itens.${index}.cst`, r.cst_csosn ?? item.cst, { shouldDirty: true });
    setValue(`itens.${index}.origem_mercadoria`, r.origem_mercadoria ?? "0", { shouldDirty: true });
    setValue(`itens.${index}.icms_aliquota`, Number(r.aliquota_icms ?? 0), { shouldDirty: true });
    setValue(`itens.${index}.pis_aliquota`, Number(r.aliquota_pis ?? 0), { shouldDirty: true });
    setValue(`itens.${index}.cofins_aliquota`, Number(r.aliquota_cofins ?? 0), { shouldDirty: true });
    setValue(`itens.${index}.ipi_aliquota`, Number(r.aliquota_ipi ?? 0), { shouldDirty: true });
    setValue(`itens.${index}.matriz_aplicada`, true, { shouldDirty: true });
    setTimeout(recalc, 0);
    toast.success(`Matriz "${r.matriz_nome}" aplicada`);
  };

  const itemErrors = formState.errors.itens?.[index];

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Item {index + 1}</span>
          {item.matriz_aplicada && (
            <Badge variant="secondary" className="gap-1">
              <Sparkles className="h-3 w-3" /> Matriz aplicada
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={aplicarMatriz}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Aplicar matriz
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Descrição *</Label>
        <Input {...register(`itens.${index}.descricao`)} />
        {itemErrors?.descricao && (
          <p className="text-xs text-destructive">{itemErrors.descricao.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">NCM *</Label>
          <Input
            {...register(`itens.${index}.ncm`)}
            inputMode="numeric"
            maxLength={8}
            placeholder="00000000"
          />
          {itemErrors?.ncm && (
            <p className="text-xs text-destructive">{itemErrors.ncm.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CFOP *</Label>
          <Input
            {...register(`itens.${index}.cfop`)}
            inputMode="numeric"
            maxLength={4}
            placeholder="5102"
          />
          {itemErrors?.cfop && (
            <p className="text-xs text-destructive">{itemErrors.cfop.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CST/CSOSN *</Label>
          <Input {...register(`itens.${index}.cst`)} maxLength={3} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">UN</Label>
          <Input {...register(`itens.${index}.unidade`)} maxLength={6} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Qtd *</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.0001"
            {...register(`itens.${index}.quantidade`, { onChange: () => setTimeout(recalc, 0) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Vlr unit. *</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            {...register(`itens.${index}.valor_unitario`, { onChange: () => setTimeout(recalc, 0) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Total</Label>
          <Input
            value={Number(item.valor_total || 0).toFixed(2)}
            readOnly
            className="bg-muted text-right tabular-nums"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">ICMS %</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            {...register(`itens.${index}.icms_aliquota`, { onChange: () => setTimeout(recalc, 0) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">PIS %</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.0001"
            {...register(`itens.${index}.pis_aliquota`, { onChange: () => setTimeout(recalc, 0) })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">COFINS %</Label>
          <Input
            type="number"
            inputMode="decimal"
            step="0.0001"
            {...register(`itens.${index}.cofins_aliquota`, { onChange: () => setTimeout(recalc, 0) })}
          />
        </div>
      </div>
    </div>
  );
}

export function Step3Itens() {
  const { control, getValues, formState } = useFormContext<WizardData>();
  const { fields, append, remove } = useFieldArray({ control, name: "itens" });
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const debouncedBusca = useDebounce(busca, 300);

  const { data: empresaCrt } = useQuery({
    queryKey: ["empresa-config-crt"],
    queryFn: async () => {
      try {
        const cfg = await getEmpresaConfigPrincipal();
        return ((cfg as { crt?: string | null })?.crt) ?? "3";
      } catch {
        return "3";
      }
    },
    staleTime: 5 * 60_000,
  });
  const cstDefault = (empresaCrt === "1" || empresaCrt === "2") ? "102" : "00";

  const { data: produtos } = useQuery({
    queryKey: ["produtos-busca-wizard", debouncedBusca],
    queryFn: async () => {
      let q = supabase
        .from("produtos")
        .select("id, codigo_interno, sku, nome, descricao, ncm, unidade_medida, preco_venda, variacoes")
        .eq("ativo", true)
        .order("nome")
        .limit(20);
      if (debouncedBusca) {
        const term = debouncedBusca.replace(/[,()]/g, "");
        q = q.or(
          `nome.ilike.%${term}%,descricao.ilike.%${term}%,codigo_interno.ilike.%${term}%,sku.ilike.%${term}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return data as ProdutoRow[];
    },
    enabled: open,
  });

  const adicionarProduto = (p: ProdutoRow) => {
    const qtd = 1;
    const vu = Number(p.preco_venda || 0);
    const variacoesArr = Array.isArray(p.variacoes)
      ? (p.variacoes as unknown[]).filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      : [];
    const descricaoCompleta = [p.nome, ...variacoesArr]
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .join(" ")
      .trim() || (p.descricao ?? "");
    append({
      produto_id: p.id,
      codigo_produto: p.codigo_interno ?? "",
      descricao: descricaoCompleta,
      ncm: (p.ncm ?? "").padStart(8, "0").slice(0, 8) || "00000000",
      cfop: "",
      cst: cstDefault,
      origem_mercadoria: "0",
      unidade: p.unidade_medida ?? "UN",
      quantidade: qtd,
      valor_unitario: vu,
      valor_total: +(qtd * vu).toFixed(2),
      icms_aliquota: 0,
      icms_base: +(qtd * vu).toFixed(2),
      icms_valor: 0,
      ipi_aliquota: 0,
      ipi_valor: 0,
      pis_aliquota: 0,
      pis_valor: 0,
      cofins_aliquota: 0,
      cofins_valor: 0,
      matriz_aplicada: false,
    });
    setOpen(false);
    setBusca("");
  };

  const adicionarVazio = () => {
    append({
      produto_id: null,
      codigo_produto: "",
      descricao: "",
      ncm: "",
      cfop: "",
      cst: cstDefault,
      origem_mercadoria: "0",
      unidade: "UN",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
      icms_aliquota: 0,
      icms_base: 0,
      icms_valor: 0,
      ipi_aliquota: 0,
      ipi_valor: 0,
      pis_aliquota: 0,
      pis_valor: 0,
      cofins_aliquota: 0,
      cofins_valor: 0,
      matriz_aplicada: false,
    });
  };

  const totalItens = fields.reduce(
    (s, _, i) => s + Number(getValues(`itens.${i}.valor_total`) || 0),
    0,
  );

  const itensSemCfop = fields.filter(
    (_, i) => {
      const cfop = getValues(`itens.${i}.cfop`);
      return !cfop || !/^\d{4}$/.test(String(cfop));
    },
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Itens da nota</CardTitle>
        <div className="flex gap-2 max-sm:w-full">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" className="max-sm:flex-1">
                <Plus className="h-4 w-4 mr-1" /> Buscar produto
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="end">
              <Command shouldFilter={false}>
                <CommandInput value={busca} onValueChange={setBusca} placeholder="Código, SKU ou nome…" />
                <CommandList>
                  <CommandEmpty>Nenhum produto.</CommandEmpty>
                  <CommandGroup>
                    {(produtos ?? []).map((p) => {
                      const variacoesArr = Array.isArray(p.variacoes)
                        ? (p.variacoes as unknown[]).filter(
                            (v): v is string => typeof v === "string" && v.trim().length > 0,
                          )
                        : [];
                      const nomeCompleto = [p.nome, ...variacoesArr]
                        .filter((s) => typeof s === "string" && s.trim().length > 0)
                        .join(" ")
                        .trim() || (p.descricao ?? "—");
                      return (
                        <CommandItem key={p.id} value={p.id} onSelect={() => adicionarProduto(p)}>
                          <div className="flex flex-col">
                            <span className="font-medium">{nomeCompleto}</span>
                            <span className="text-xs text-muted-foreground">
                              {p.codigo_interno ?? p.sku ?? "—"} · NCM {p.ncm ?? "?"} · {formatCurrency(Number(p.preco_venda ?? 0))}
                            </span>
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="outline" onClick={adicionarVazio} className="max-sm:flex-1">
            <Plus className="h-4 w-4 mr-1" /> Item livre
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {fields.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Adicione produtos para compor a nota.
          </p>
        ) : (
          fields.map((f, i) => <ItemRow key={f.id} index={i} onRemove={() => remove(i)} />)
        )}
        {formState.errors.itens && typeof formState.errors.itens.message === "string" && (
          <p className="text-xs text-destructive">{formState.errors.itens.message}</p>
        )}
        {fields.length > 0 && (
          <div className="flex justify-end pt-2 text-sm">
            <span className="text-muted-foreground mr-2">Total dos itens:</span>
            <span className="font-semibold tabular-nums">{formatCurrency(totalItens)}</span>
          </div>
        )}
        {itensSemCfop.length > 0 && (
          <Alert variant="default" className="border-warning/50 text-warning-foreground">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{itensSemCfop.length}</strong> item(ns) sem CFOP definido.{" "}
              Isso ocorre quando não há regra na{" "}
              <button
                type="button"
                className="underline font-medium"
                onClick={() =>
                  window.open("/faturamento/cadastros?tab=matriz", "_blank")
                }
              >
                Matriz Fiscal
              </button>{" "}
              para a UF de destino deste cliente. Configure a regra ou preencha
              o CFOP manualmente em cada item.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}