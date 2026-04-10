import { useFormContext, useWatch } from "react-hook-form";
import type { NFeFormData } from "./schema";

interface ImpostosNFeProps {
  disabled?: boolean;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ImpostosNFe({ disabled: _disabled }: ImpostosNFeProps) {
  const { control } = useFormContext<NFeFormData>();
  const itens = useWatch({ control, name: "itens" }) ?? [];

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

  return (
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
  );
}
