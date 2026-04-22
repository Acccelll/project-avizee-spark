/**
 * IntegracoesSection — gateway externo, SEFAZ e webhooks. Persiste em
 * `app_configuracoes['integracoes']`.
 *
 * NOTA: o certificado SEFAZ ainda fica em jsonb (legado). Migração para
 * Vault está prevista na Fase 9 do roadmap administrativo.
 */

import { useEffect, useState } from "react";
import { Info, Plug, Receipt, Webhook } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionShell } from "@/pages/admin/components/SectionShell";
import { useSectionConfig } from "@/pages/admin/hooks/useSectionConfig";

const DEFAULTS = {
  gatewayUrl: "",
  gatewayApiKey: "",
  sefazAmbiente: "homologacao",
  sefazCertificadoBase64: "",
  webhookUrl: "",
  webhookSecret: "",
};

const isValidBase64 = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/\s/.test(trimmed)) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(trimmed)) return false;
  return trimmed.length % 4 === 0;
};

export function IntegracoesSection() {
  const { values, lastSaved, save, isSaving } = useSectionConfig("integracoes", DEFAULTS);
  const [draft, setDraft] = useState(values);
  const [showCert, setShowCert] = useState(false);

  useEffect(() => {
    setDraft(values);
  }, [values]);

  const update = <K extends keyof typeof DEFAULTS>(key: K, value: (typeof DEFAULTS)[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const certValid = isValidBase64(draft.sefazCertificadoBase64);

  const handleSubmit = () => {
    if (!certValid) {
      toast.error("Corrija o certificado SEFAZ: o conteúdo deve estar em Base64 válido.");
      return;
    }
    save(draft);
  };

  return (
    <SectionShell
      title="Integrações globais"
      description="Conexões sistêmicas (gateway, SEFAZ e webhooks) válidas para toda a operação."
      saveCta="Salvar integrações globais"
      lastSavedAt={lastSaved.at}
      isSaving={isSaving}
      onSave={handleSubmit}
    >
      <div className="space-y-6">
        <Card className="border-dashed bg-muted/30">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Estas integrações são <strong className="text-foreground">globais</strong>. Qualquer alteração impacta todos os usuários e fluxos administrativos do sistema.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" />Gateway externo
            </CardTitle>
            <CardDescription>
              Conexão global com serviço de gateway. O teste desta tela valida apenas preenchimento básico dos parâmetros.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>URL do gateway</Label>
              <Input
                placeholder="https://api.gateway.com/v1"
                value={draft.gatewayUrl}
                onChange={(e) => update("gatewayUrl", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>API key do gateway</Label>
              <Input
                type="password"
                placeholder="••••••••••••"
                value={draft.gatewayApiKey}
                onChange={(e) => update("gatewayApiKey", e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Teste disponível nesta tela: validação de preenchimento local. Reachability e teste funcional real dependem de endpoint de backend dedicado.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />SEFAZ
            </CardTitle>
            <CardDescription>
              Parâmetros globais para emissão fiscal. Certificado em Base64 é aceito temporariamente enquanto o fluxo de upload dedicado não é implementado.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Ambiente SEFAZ</Label>
              <Select
                value={draft.sefazAmbiente}
                onValueChange={(v) => update("sefazAmbiente", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homologacao">Homologação</SelectItem>
                  <SelectItem value="producao">Produção</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Certificado digital (Base64)</Label>
              <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Campo sensível. O conteúdo fica oculto por padrão para reduzir exposição acidental.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCert((prev) => !prev)}
                  >
                    {showCert ? "Ocultar conteúdo" : "Mostrar conteúdo"}
                  </Button>
                </div>
                {showCert ? (
                  <Textarea
                    rows={4}
                    placeholder="Cole aqui o conteúdo Base64 (sem cabeçalhos PEM)."
                    value={draft.sefazCertificadoBase64}
                    onChange={(e) =>
                      update("sefazCertificadoBase64", e.target.value.trim())
                    }
                    className="font-mono text-xs"
                  />
                ) : (
                  <Input
                    type="password"
                    value={draft.sefazCertificadoBase64}
                    placeholder="Conteúdo oculto"
                    onChange={(e) =>
                      update("sefazCertificadoBase64", e.target.value.trim())
                    }
                    className="font-mono text-xs"
                  />
                )}
              </div>
              {!certValid && (
                <p className="text-[11px] text-destructive">
                  Formato inválido: informe um Base64 contínuo (sem espaços e sem cabeçalhos PEM).
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Hint: use apenas conteúdo Base64 limpo. Em breve este campo será substituído por upload seguro de certificado.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-muted-foreground" />Webhooks
            </CardTitle>
            <CardDescription>Canal global de eventos para sistemas externos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Endpoint do webhook</Label>
              <Input
                placeholder="https://sua-api.com/webhooks/erp"
                value={draft.webhookUrl}
                onChange={(e) => update("webhookUrl", e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Segredo de assinatura</Label>
              <Input
                type="password"
                placeholder="chave de assinatura HMAC"
                value={draft.webhookSecret}
                onChange={(e) => update("webhookSecret", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}