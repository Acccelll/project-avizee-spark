import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, RefreshCw, ShieldCheck, AlertTriangle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyError } from "@/utils/errorMessages";
import {
  consultarStatusServico,
  resolverUrlSefaz,
  type AmbienteSefaz,
  type StatusServicoResult,
} from "@/services/fiscal/sefaz";

/**
 * Widget de health-check da SEFAZ por UF (Onda 6).
 *
 * - Lê UF/ambiente da empresa em `empresa_config`.
 * - Faz consulta cStat 107 via sefaz-proxy.
 * - Sinaliza modo de emissão atual (normal / contingência SVC).
 * - Permite alternar contingência através do callback `onAbrirContingencia`.
 */

interface EmpresaCfg {
  uf: string;
  ambiente: AmbienteSefaz;
  modo_emissao_nfe: string | null;
  contingencia_motivo: string | null;
  contingencia_inicio: string | null;
}

async function lerEmpresa(): Promise<EmpresaCfg | null> {
  const { data, error } = await supabase
    .from("empresa_config")
    .select(
      "uf, ambiente_sefaz, ambiente_padrao, modo_emissao_nfe, contingencia_motivo, contingencia_inicio",
    )
    .limit(1)
    .maybeSingle();
  if (error || !data?.uf) return null;
  let ambiente: AmbienteSefaz = "2";
  if (data.ambiente_sefaz === "1" || data.ambiente_sefaz === "2") {
    ambiente = data.ambiente_sefaz;
  } else if (data.ambiente_padrao === "producao") {
    ambiente = "1";
  }
  return {
    uf: data.uf.toUpperCase(),
    ambiente,
    modo_emissao_nfe: (data as { modo_emissao_nfe?: string | null }).modo_emissao_nfe ?? "normal",
    contingencia_motivo: (data as { contingencia_motivo?: string | null }).contingencia_motivo ?? null,
    contingencia_inicio: (data as { contingencia_inicio?: string | null }).contingencia_inicio ?? null,
  };
}

export function StatusSefazUFWidget({
  onAbrirContingencia,
}: {
  onAbrirContingencia: (cfg: EmpresaCfg) => void;
}) {
  const [cfg, setCfg] = useState<EmpresaCfg | null>(null);
  const [carregandoCfg, setCarregandoCfg] = useState(true);
  const [status, setStatus] = useState<StatusServicoResult | null>(null);
  const [pending, setPending] = useState(false);

  const carregar = useCallback(async () => {
    setCarregandoCfg(true);
    try {
      const c = await lerEmpresa();
      setCfg(c);
    } finally {
      setCarregandoCfg(false);
    }
  }, []);

  const consultar = useCallback(async () => {
    if (!cfg) return;
    setPending(true);
    try {
      const url = resolverUrlSefaz(cfg.uf, cfg.ambiente, "status");
      const res = await consultarStatusServico(cfg.uf, cfg.ambiente, url);
      setStatus(res);
      if (res.emOperacao) toast.success(`SEFAZ-${cfg.uf} em operação`);
      else if (res.paralisado) toast.warning(`SEFAZ-${cfg.uf}: ${res.motivo ?? "paralisado"}`);
      else if (!res.sucesso) toast.error(`Falha ao consultar SEFAZ: ${res.erro ?? "—"}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setPending(false);
    }
  }, [cfg]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (carregandoCfg) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Status SEFAZ</CardTitle></CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }
  if (!cfg) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Status SEFAZ</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Configure a UF e o ambiente em <strong>Configuração Fiscal</strong>.
        </CardContent>
      </Card>
    );
  }

  const emContingencia = cfg.modo_emissao_nfe && cfg.modo_emissao_nfe !== "normal";
  const Icon = emContingencia
    ? ShieldAlert
    : status?.emOperacao
      ? ShieldCheck
      : status?.paralisado
        ? AlertTriangle
        : Activity;
  const tone = emContingencia
    ? "text-warning"
    : status?.emOperacao
      ? "text-success"
      : status?.paralisado
        ? "text-warning"
        : "text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={`h-4 w-4 ${tone}`} />
          SEFAZ-{cfg.uf} · {cfg.ambiente === "1" ? "Produção" : "Homologação"}
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={consultar} disabled={pending} className="gap-1">
          <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
          {pending ? "Consultando…" : "Consultar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Modo de emissão:</span>
          {emContingencia ? (
            <Badge variant="outline" className="border-warning text-warning">
              {cfg.modo_emissao_nfe === "contingencia_svc" ? "Contingência SVC" : "Contingência Offline"}
            </Badge>
          ) : (
            <Badge variant="secondary">Normal</Badge>
          )}
        </div>
        {status ? (
          <div className="space-y-1">
            <p className={tone}>
              <strong>cStat {status.cStat ?? "—"}</strong> · {status.motivo ?? status.erro ?? "—"}
            </p>
            {status.tMed && (
              <p className="text-xs text-muted-foreground">
                Tempo médio de resposta: {status.tMed}s
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Clique em <em>Consultar</em> para verificar a SEFAZ-{cfg.uf} agora.
          </p>
        )}
        {emContingencia && cfg.contingencia_motivo && (
          <p className="text-xs text-warning border-l-2 border-warning pl-2">
            Motivo: {cfg.contingencia_motivo}
          </p>
        )}
        <div className="pt-2">
          <Button
            variant={emContingencia ? "default" : "outline"}
            size="sm"
            onClick={() => onAbrirContingencia(cfg)}
            className="w-full gap-2"
          >
            <ShieldAlert className="h-4 w-4" />
            {emContingencia ? "Sair da contingência" : "Ativar contingência SVC"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}