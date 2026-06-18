import { useFormContext } from "react-hook-form";
import { AlertCircle, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/format";
import type { WizardData } from "../schema";

export function Step5Revisao({
  totalNF,
  onSalvarRascunho,
  saving,
}: {
  totalNF: number;
  onSalvarRascunho: () => void;
  saving: boolean;
}) {
  const { getValues } = useFormContext<WizardData>();
  const data = getValues();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo da NF-e</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Natureza</p>
            <p>{data.natureza_codigo} — {data.natureza_descricao}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tipo / Finalidade</p>
            <p className="capitalize">{data.tipo_operacao} · Finalidade {data.finalidade}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Data emissão / Série</p>
            <p>{data.data_emissao} · Série {data.serie}</p>
          </div>
          <div className="sm:col-span-3 border-t pt-3">
            <p className="text-xs text-muted-foreground">Destinatário</p>
            <p>{data.cliente_nome} · IBGE {data.cliente_municipio_ibge} · UF {data.cliente_uf}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Itens</p>
            <p>{data.itens.length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Frete / Outras / Desconto</p>
            <p>
              {formatCurrency(data.frete_valor)} · {formatCurrency(data.outras_despesas)} ·{" "}
              {formatCurrency(data.desconto_valor)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total da NF</p>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalNF)}</p>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Próxima etapa</AlertTitle>
        <AlertDescription>
          Ao salvar, a nota será criada como <strong>rascunho</strong> e você
          será redirecionado para a tela de detalhe, onde poderá transmitir à
          SEFAZ pelo painel de ações fiscais.
        </AlertDescription>
      </Alert>

      <div className="flex justify-end">
        <Button onClick={onSalvarRascunho} disabled={saving} size="lg" className="gap-2">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando rascunho…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Salvar e ir para transmissão
            </>
          )}
        </Button>
      </div>
    </div>
  );
}