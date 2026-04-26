/**
 * FiscalSection — parâmetros fiscais padrão (CFOP, CST, NCM) e
 * comportamento global do fluxo fiscal. Persiste em
 * `app_configuracoes['fiscal']`.
 */

import { useEffect, useState } from "react";
import { Calendar, CheckCircle2, Globe, Info, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SectionShell } from "@/pages/admin/components/SectionShell";
import { useSectionConfig } from "@/pages/admin/hooks/useSectionConfig";

const DEFAULTS = {
  cfopPadraoVenda: "5102",
  cfopPadraoCompra: "1102",
  cstPadrao: "000",
  ncmPadrao: "00000000",
  gerarFinanceiroPadrao: true,
};

export function FiscalSection() {
  const { values, lastSaved, save, isSaving } = useSectionConfig("fiscal", DEFAULTS);
  const [draft, setDraft] = useState(values);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setDraft(values), [values]);

  const update = <K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSubmit = () => {
    const errs: Record<string, string> = {};
    if (!/^\d{4}$/.test(draft.cfopPadraoVenda))
      errs.cfopPadraoVenda = "CFOP deve ter exatamente 4 dígitos numéricos (ex.: 5102).";
    if (!/^\d{4}$/.test(draft.cfopPadraoCompra))
      errs.cfopPadraoCompra = "CFOP deve ter exatamente 4 dígitos numéricos (ex.: 1102).";
    if (!/^\d{2,3}$/.test(draft.cstPadrao))
      errs.cstPadrao = "CST deve ter 2 ou 3 dígitos numéricos (ex.: 00 para PIS/COFINS, 000 para ICMS).";
    if (!/^\d{8}$/.test(draft.ncmPadrao))
      errs.ncmPadrao = "NCM deve ter exatamente 8 dígitos numéricos (ex.: 00000000).";
    if (Object.keys(errs).length) {
      setErrors(errs);
      toast.error("Corrija os campos obrigatórios antes de salvar.");
      return;
    }
    setErrors({});
    save(draft);
  };

  return (
    <SectionShell
      title="Parâmetros fiscais"
      description="Padrões fiscais globais usados como base no sistema."
      saveCta="Salvar parâmetros fiscais"
      lastSavedAt={lastSaved.at}
      isSaving={isSaving}
      onSave={handleSubmit}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Receipt className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Classificação fiscal padrão</CardTitle>
                <CardDescription>
                  Valores base utilizados como ponto de partida em documentos de entrada e saída. Podem ser complementados por parametrizações específicas de produto ou operação.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FiscalField
              label="CFOP padrão para venda"
              value={draft.cfopPadraoVenda}
              onChange={(v) => update("cfopPadraoVenda", v.replace(/\D/g, "").slice(0, 4))}
              placeholder="5102"
              maxLength={4}
              error={errors.cfopPadraoVenda}
              hint="Sugerido em documentos de saída. Ex.: 5102 (venda de mercadoria adquirida)."
            />
            <FiscalField
              label="CFOP padrão para compra"
              value={draft.cfopPadraoCompra}
              onChange={(v) => update("cfopPadraoCompra", v.replace(/\D/g, "").slice(0, 4))}
              placeholder="1102"
              maxLength={4}
              error={errors.cfopPadraoCompra}
              hint="Sugerido em documentos de entrada. Ex.: 1102 (compra de mercadoria para comercialização)."
            />
            <FiscalField
              label="CST padrão inicial"
              value={draft.cstPadrao}
              onChange={(v) => update("cstPadrao", v.replace(/\D/g, "").slice(0, 3))}
              placeholder="000"
              maxLength={3}
              error={errors.cstPadrao}
              hint="Classificação fiscal inicial padrão do sistema. Ex.: 000 (tributada integralmente)."
            />
            <FiscalField
              label="NCM padrão inicial"
              value={draft.ncmPadrao}
              onChange={(v) => update("ncmPadrao", v.replace(/\D/g, "").slice(0, 8))}
              placeholder="00000000"
              maxLength={8}
              error={errors.ncmPadrao}
              hint="Classificação padrão quando não houver NCM específico no cadastro do produto. 8 dígitos."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Comportamento fiscal do sistema</CardTitle>
                <CardDescription>
                  Define como o ERP age automaticamente ao processar documentos fiscais. Diferente das classificações acima, esta opção controla o fluxo interno do sistema.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between rounded-lg border p-4 gap-4">
              <div className="space-y-1">
                <p className="font-medium text-sm">Gerar financeiro automaticamente por padrão</p>
                <p className="text-sm text-muted-foreground">
                  Quando ativo, documentos fiscais confirmados geram lançamento financeiro automaticamente por padrão, salvo configuração específica no documento.
                </p>
              </div>
              <Switch
                checked={draft.gerarFinanceiroPadrao}
                onCheckedChange={(checked) => update("gerarFinanceiroPadrao", checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Contexto de aplicação</CardTitle>
                <CardDescription>
                  Padrões fiscais globais usados como base em documentos de entrada, saída e integrações com financeiro.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Esta configuração serve como referência para
              </p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {[
                  "Documentos de venda e saída fiscal",
                  "Documentos de compra e entrada fiscal",
                  "Lançamentos gerados a partir de notas fiscais",
                  "Integração automática com financeiro",
                  "Comportamento padrão em novos cadastros",
                  "Classificação inicial de produtos sem NCM",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Separator />
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-2.5 text-sm text-warning">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Esses valores são <strong>parâmetros armazenados</strong> e ainda não são consumidos automaticamente por todos os módulos fiscais. Servem como referência e base para futuras integrações.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <CardTitle>Governança e uso no sistema</CardTitle>
                <CardDescription>
                  Rastreabilidade desta configuração e visibilidade do seu alcance nos fluxos do ERP.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Última atualização
                </p>
                <p className="text-sm font-medium">
                  {lastSaved.at
                    ? new Date(lastSaved.at).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "—"}
                </p>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-0.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Alterado por
                </p>
                <p className="text-sm font-medium">{lastSaved.by ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}

function FiscalField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength: number;
  error?: string;
  hint: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className={cn(error ? "border-destructive focus-visible:ring-destructive" : "")}
      />
      {error ? (
        <p className="text-[11px] text-destructive">{error}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          {hint}
        </p>
      )}
    </div>
  );
}