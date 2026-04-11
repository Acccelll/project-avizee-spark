import { useFormContext, useWatch } from "react-hook-form";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { sugerirTributacao } from "@/services/fiscal/tributacao.service";
import type { RegimeTributario } from "@/services/fiscal/tributacao.service";
import type { NFeFormData } from "./schema";

interface ImpostosNFeProps {
  disabled?: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ImpostosNFe({ disabled: _disabled }: ImpostosNFeProps) {
  const { control, setValue, getValues } = useFormContext<NFeFormData>();
  const itens = useWatch({ control, name: "itens" }) ?? [];

  const [ufOrigem, setUfOrigem] = useState("SP");
  const [ufDestino, setUfDestino] = useState("SP");
  const [regimeTributario, setRegimeTributario] = useState<RegimeTributario>("lucro_presumido");

  const totais = itens.reduce(
    (acc, item) => ({
      baseIcms: acc.baseIcms + (Number(item?.icmsBase) || 0),
      icms: acc.icms + (Number(item?.icmsValor) || 0),
      ipi: acc.ipi + (Number(item?.ipiValor) || 0),
      pis: acc.pis + (Number(item?.pisValor) || 0),
      cofins: acc.cofins + (Number(item?.cofinsValor) || 0),
      produtos: acc.produtos + (Number(item?.valorTotal) || 0),
    }),
    { baseIcms: 0, icms: 0, ipi: 0, pis: 0, cofins: 0, produtos: 0 },
  );

  function handleSugerirTributacao() {
    const currentItens = getValues("itens") ?? [];
    currentItens.forEach((item, idx) => {
      const sugestao = sugerirTributacao({
        ncm: item.ncm ?? "",
        cfop: item.cfop ?? "",
        ufOrigem,
        ufDestino,
        regimeTributario,
      });
      const base = Number(item.valorTotal) || 0;
      setValue(`itens.${idx}.icmsAliquota`, sugestao.icmsAliquota);
      setValue(`itens.${idx}.icmsBase`, base);
      setValue(`itens.${idx}.icmsValor`, parseFloat(((base * sugestao.icmsAliquota) / 100).toFixed(2)));
      setValue(`itens.${idx}.ipiAliquota`, sugestao.ipiAliquota);
      setValue(`itens.${idx}.ipiValor`, parseFloat(((base * sugestao.ipiAliquota) / 100).toFixed(2)));
      setValue(`itens.${idx}.pisAliquota`, sugestao.pisAliquota);
      setValue(`itens.${idx}.pisValor`, parseFloat(((base * sugestao.pisAliquota) / 100).toFixed(2)));
      setValue(`itens.${idx}.cofinsAliquota`, sugestao.cofinAliquota);
      setValue(`itens.${idx}.cofinsValor`, parseFloat(((base * sugestao.cofinAliquota) / 100).toFixed(2)));
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <h3 className="mb-3 text-sm font-medium">Sugestão Automática de Tributação</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">UF Origem</label>
            <Input
              value={ufOrigem}
              onChange={(e) => setUfOrigem(e.target.value.toUpperCase())}
              maxLength={2}
              className="w-20"
              placeholder="SP"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">UF Destino</label>
            <Input
              value={ufDestino}
              onChange={(e) => setUfDestino(e.target.value.toUpperCase())}
              maxLength={2}
              className="w-20"
              placeholder="SP"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Regime Tributário</label>
            <select
              value={regimeTributario}
              onChange={(e) => setRegimeTributario(e.target.value as RegimeTributario)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="simples_nacional">Simples Nacional</option>
              <option value="lucro_presumido">Lucro Presumido</option>
              <option value="lucro_real">Lucro Real</option>
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSugerirTributacao}
            disabled={itens.length === 0}
          >
            <Wand2 className="mr-2 h-4 w-4" />
            Sugerir Tributação
          </Button>
        </div>
      </div>

      <div className="rounded-md border p-4">
        <h3 className="mb-3 text-sm font-medium">Totais de Impostos</h3>
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3 lg:grid-cols-6">
          <div>
            <p className="text-muted-foreground">Base ICMS</p>
            <p className="font-medium">{formatCurrency(totais.baseIcms)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">ICMS</p>
            <p className="font-medium">{formatCurrency(totais.icms)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">IPI</p>
            <p className="font-medium">{formatCurrency(totais.ipi)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">PIS</p>
            <p className="font-medium">{formatCurrency(totais.pis)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">COFINS</p>
            <p className="font-medium">{formatCurrency(totais.cofins)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Produtos</p>
            <p className="font-medium font-semibold">{formatCurrency(totais.produtos)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
