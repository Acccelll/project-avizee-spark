import { useEffect } from "react";
import { Receipt, Building2, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const NATUREZA_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1 - Tributação no município" },
  { value: 2, label: "2 - Tributação fora do município" },
  { value: 3, label: "3 - Isento" },
  { value: 4, label: "4 - Imune" },
  { value: 5, label: "5 - Exigibilidade suspensa (judicial)" },
  { value: 6, label: "6 - Exigibilidade suspensa (administrativa)" },
];

interface Props {
  form: Record<string, any>;
  setForm: (f: Record<string, any>) => void;
  disabled?: boolean;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function NfseFieldsSection({ form, setForm, disabled }: Props) {
  const valorServicos = num(form.nfse_valor_servicos);
  const valorDeducoes = num(form.nfse_valor_deducoes);
  const baseCalc = Math.max(0, valorServicos - valorDeducoes);
  const aliquota = num(form.nfse_aliquota_iss);
  const valorIssCalc = +(baseCalc * aliquota).toFixed(2);

  // Mantém base e ISS sincronizados
  useEffect(() => {
    if (form.nfse_valor_base_calculo_iss !== baseCalc) {
      setForm({ ...form, nfse_valor_base_calculo_iss: baseCalc, nfse_valor_iss: valorIssCalc });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorServicos, valorDeducoes, aliquota]);

  return (
    <div className="space-y-4 rounded-lg border bg-accent/20 p-4">
      <div className="flex items-center gap-2">
        <Receipt className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Dados NFS-e</h3>
        {form.nfse_iss_retido && (
          <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 text-xs ml-auto">
            ISS retido
          </Badge>
        )}
      </div>

      {/* RPS de origem */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span>RPS de origem</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Número do RPS</Label>
              <Input
                value={form.nfse_numero_rps ?? ""}
                onChange={(e) => setForm({ ...form, nfse_numero_rps: e.target.value })}
                disabled={disabled}
              />
              <p className="text-[11px] text-muted-foreground">Recibo Provisório de Serviços emitido pelo prestador.</p>
            </div>
            <div className="space-y-1">
              <Label>Série RPS</Label>
              <Input
                value={form.nfse_serie_rps ?? ""}
                onChange={(e) => setForm({ ...form, nfse_serie_rps: e.target.value })}
                disabled={disabled}
                placeholder="ex: A"
              />
            </div>
            <div className="space-y-1">
              <Label>Competência</Label>
              <Input
                type="date"
                value={form.nfse_data_competencia ?? ""}
                onChange={(e) => setForm({ ...form, nfse_data_competencia: e.target.value })}
                disabled={disabled}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Prestação */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Prestação do serviço</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Município de prestação</Label>
              <Input
                value={form.nfse_municipio_prestacao ?? ""}
                onChange={(e) => setForm({ ...form, nfse_municipio_prestacao: e.target.value })}
                disabled={disabled}
                placeholder="Ex: São Paulo"
              />
              <p className="text-[11px] text-muted-foreground">Município onde o serviço foi efetivamente prestado.</p>
            </div>
            <div className="space-y-1">
              <Label>Código LC 116</Label>
              <Input
                value={form.nfse_codigo_servico_lc116 ?? ""}
                onChange={(e) => setForm({ ...form, nfse_codigo_servico_lc116: e.target.value })}
                disabled={disabled}
                placeholder="ex: 01.01"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Natureza da operação</Label>
              <Select
                value={form.nfse_natureza_operacao ? String(form.nfse_natureza_operacao) : ""}
                onValueChange={(v) => setForm({ ...form, nfse_natureza_operacao: Number(v) })}
                disabled={disabled}
              >
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {NATUREZA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Descrição do serviço</Label>
              <Input
                value={form.nfse_descricao_servico ?? ""}
                onChange={(e) => setForm({ ...form, nfse_descricao_servico: e.target.value })}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="nfse-simples"
                checked={!!form.nfse_optante_simples}
                onCheckedChange={(v) => setForm({ ...form, nfse_optante_simples: !!v })}
                disabled={disabled}
              />
              <Label htmlFor="nfse-simples" className="cursor-pointer">Prestador optante pelo Simples Nacional</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="nfse-cultural"
                checked={!!form.nfse_incentivador_cultural}
                onCheckedChange={(v) => setForm({ ...form, nfse_incentivador_cultural: !!v })}
                disabled={disabled}
              />
              <Label htmlFor="nfse-cultural" className="cursor-pointer">Incentivador cultural</Label>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ISS */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium hover:text-primary">
          <span className="flex items-center gap-2"><Calculator className="h-3.5 w-3.5" /> ISS</span>
          <ChevronDown className="h-4 w-4" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Valor dos serviços (R$)</Label>
              <Input
                type="number" step="0.01" min={0}
                value={form.nfse_valor_servicos ?? ""}
                onChange={(e) => setForm({ ...form, nfse_valor_servicos: e.target.value === "" ? null : Number(e.target.value) })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label>Deduções (R$)</Label>
              <Input
                type="number" step="0.01" min={0}
                value={form.nfse_valor_deducoes ?? 0}
                onChange={(e) => setForm({ ...form, nfse_valor_deducoes: Number(e.target.value || 0) })}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label>Base de cálculo (R$)</Label>
              <Input value={baseCalc.toFixed(2)} readOnly className="bg-muted/50 font-mono" />
            </div>
            <div className="space-y-1">
              <Label>Alíquota ISS (decimal)</Label>
              <Input
                type="number" step="0.0001" min={0} max={1}
                value={form.nfse_aliquota_iss ?? ""}
                onChange={(e) => setForm({ ...form, nfse_aliquota_iss: e.target.value === "" ? null : Number(e.target.value) })}
                disabled={disabled}
                placeholder="ex: 0.05 (5%)"
              />
            </div>
            <div className="space-y-1">
              <Label>Valor ISS (R$)</Label>
              <Input
                type="number" step="0.01"
                value={form.nfse_valor_iss ?? valorIssCalc}
                onChange={(e) => setForm({ ...form, nfse_valor_iss: Number(e.target.value || 0) })}
                disabled={disabled}
                className="font-mono"
              />
            </div>
            <div className="space-y-1 flex items-end">
              <div className="rounded-md border bg-background p-2 w-full flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium">ISS retido na fonte</p>
                  <p className="text-[10px] text-muted-foreground">Tomador desconta o ISS no pagamento.</p>
                </div>
                <Switch
                  checked={!!form.nfse_iss_retido}
                  onCheckedChange={(v) => setForm({ ...form, nfse_iss_retido: v })}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}