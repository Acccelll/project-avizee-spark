import { useEffect, useMemo } from "react";
import { useFormContext, useWatch, useFieldArray } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw } from "lucide-react";
import type { NFeFormData } from "./schema";

interface Props {
  disabled?: boolean;
}

/**
 * Bloco "Pagamento" do formulário de NF — controla o vínculo com o financeiro:
 *  - Switch "Gerar lançamentos no financeiro".
 *  - 1º vencimento (data).
 *  - Nº de parcelas + intervalo (dias) → gera automaticamente uma tabela editável.
 *  - Cada linha de parcela tem data e valor editáveis. A soma é validada no schema.
 */
export function PagamentoNFe({ disabled }: Props) {
  const { control, setValue } = useFormContext<NFeFormData>();
  const geraFinanceiro = useWatch({ control, name: "geraFinanceiro" }) ?? true;
  const dataVencimento = useWatch({ control, name: "dataVencimento" });
  const numeroParcelas = Number(useWatch({ control, name: "numeroParcelas" }) ?? 1);
  const intervalo = Number(useWatch({ control, name: "intervaloParcelasDias" }) ?? 30);
  const itens = useWatch({ control, name: "itens" }) ?? [];
  const freteValor = Number(useWatch({ control, name: "freteValor" }) ?? 0);
  const outrasDespesas = Number(useWatch({ control, name: "outrasDespesas" }) ?? 0);
  const descontoValor = Number(useWatch({ control, name: "descontoValor" }) ?? 0);

  const totalNF = useMemo(() => {
    const totalProd = itens.reduce((s, i) => s + Number(i.valorTotal || 0), 0);
    return totalProd + freteValor + outrasDespesas - descontoValor;
  }, [itens, freteValor, outrasDespesas, descontoValor]);

  const { fields, replace, remove } = useFieldArray({ control, name: "parcelas" });

  const gerar = () => {
    if (!dataVencimento || numeroParcelas < 1) return;
    const base = new Date(dataVencimento + "T00:00:00");
    const valorBase = Number((totalNF / numeroParcelas).toFixed(2));
    const novas = Array.from({ length: numeroParcelas }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + intervalo * i);
      const valor = i === numeroParcelas - 1
        ? Number((totalNF - valorBase * (numeroParcelas - 1)).toFixed(2))
        : valorBase;
      return {
        numero: i + 1,
        vencimento: d.toISOString().slice(0, 10),
        valor,
      };
    });
    replace(novas);
  };

  // Auto-gera quando ainda não há parcelas e os parâmetros mínimos estão prontos.
  useEffect(() => {
    if (!geraFinanceiro) return;
    if (fields.length === 0 && dataVencimento && numeroParcelas >= 1 && totalNF > 0) {
      gerar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geraFinanceiro, dataVencimento, numeroParcelas, intervalo, totalNF]);

  if (!geraFinanceiro) {
    return (
      <div className="space-y-4">
        <FormField
          control={control}
          name="geraFinanceiro"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-md border p-3">
              <div>
                <FormLabel>Gerar lançamentos financeiros</FormLabel>
                <FormDescription className="text-xs">
                  Quando desligado, esta NF não cria contas a receber/pagar.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormField
        control={control}
        name="geraFinanceiro"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-md border p-3">
            <div>
              <FormLabel>Gerar lançamentos financeiros</FormLabel>
              <FormDescription className="text-xs">
                As parcelas abaixo serão criadas como contas a receber/pagar quando a NF for autorizada.
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={disabled} />
            </FormControl>
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FormField
          control={control}
          name="dataVencimento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>1º vencimento</FormLabel>
              <FormControl>
                <Input type="date" {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="numeroParcelas"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nº de parcelas</FormLabel>
              <FormControl>
                <Input type="number" min={1} step={1} {...field} disabled={disabled} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="intervaloParcelasDias"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Intervalo (dias)</FormLabel>
              <FormControl>
                <Input type="number" min={0} step={1} {...field} disabled={disabled} />
              </FormControl>
              <FormDescription className="text-xs">
                Use 0 para todas no mesmo dia.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total da NF:{" "}
          <strong className="text-foreground">
            {totalNF.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </strong>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={gerar} disabled={disabled || !dataVencimento}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Recalcular parcelas
        </Button>
      </div>

      {fields.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left w-16">#</th>
                <th className="px-3 py-2 text-left">Vencimento</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {fields.map((row, idx) => (
                <tr key={row.id} className="border-t">
                  <td className="px-3 py-2">
                    <FormField
                      control={control}
                      name={`parcelas.${idx}.numero` as const}
                      render={({ field }) => (
                        <Input type="number" {...field} disabled className="h-8 w-14" />
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <FormField
                      control={control}
                      name={`parcelas.${idx}.vencimento` as const}
                      render={({ field }) => (
                        <Input type="date" {...field} disabled={disabled} className="h-8" />
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <FormField
                      control={control}
                      name={`parcelas.${idx}.valor` as const}
                      render={({ field }) => (
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          disabled={disabled}
                          className="h-8 text-right"
                        />
                      )}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => remove(idx)}
                      disabled={disabled || fields.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
