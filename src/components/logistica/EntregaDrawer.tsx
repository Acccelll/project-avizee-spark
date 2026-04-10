import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ViewDrawerV2, ViewField, ViewSection } from "@/components/ViewDrawerV2";
import { StatusBadge } from "@/components/StatusBadge";
import { RelationalLink } from "@/components/ui/RelationalLink";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/format";
import {
  Truck,
  Package,
  MapPin,
  AlertTriangle,
  Calendar,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/* ────────────────────────────────────────────────
   Types
──────────────────────────────────────────────── */

export interface Entrega {
  id: string;
  numero_pedido: string;
  cliente: string;
  cidade_uf: string;
  transportadora: string;
  volumes: number;
  peso_total: number;
  previsao_envio: string | null;
  previsao_entrega: string | null;
  data_expedicao: string | null;
  status_logistico: string;
  responsavel: string;
  codigo_rastreio: string | null;
}

interface RemessaDetalhe {
  id: string;
  transportadora_id: string | null;
  servico: string | null;
  valor_frete: number | null;
  observacoes: string | null;
  nota_fiscal_id: string | null;
  cliente_id: string | null;
  transportadoras?: { nome_razao_social: string } | null;
}

interface OVItem {
  id: string;
  descricao_snapshot: string | null;
  codigo_snapshot: string | null;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  peso_total: number | null;
  unidade: string | null;
}

interface RemessaEvento {
  id: string;
  descricao: string;
  local: string | null;
  data_hora: string;
}

interface EntregaDrawerProps {
  open: boolean;
  onClose: () => void;
  entrega: Entrega | null;
}

/* ────────────────────────────────────────────────
   Status config
──────────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; badge: string; statusKey: string }> = {
  aguardando_separacao: { label: "Aguardando Separação", badge: "aguardando", statusKey: "aguardando" },
  em_separacao:         { label: "Em Separação",         badge: "em_separacao", statusKey: "em_separacao" },
  separado:             { label: "Separado",             badge: "aprovado", statusKey: "aprovado" },
  aguardando_expedicao: { label: "Aguardando Expedição", badge: "aguardando", statusKey: "aguardando" },
  em_transporte:        { label: "Em Transporte",        badge: "enviado", statusKey: "enviado" },
  entregue:             { label: "Entregue",             badge: "entregue", statusKey: "entregue" },
  entrega_parcial:      { label: "Entrega Parcial",      badge: "parcial", statusKey: "parcial" },
  ocorrencia:           { label: "Com Ocorrência",       badge: "pendente", statusKey: "pendente" },
  cancelado:            { label: "Cancelado",            badge: "cancelado", statusKey: "cancelado" },
};

function getStatusConfig(status: string) {
  return statusConfig[status] ?? { label: status.replaceAll("_", " "), badge: "pendente", statusKey: "pendente" };
}

function isAtrasado(previsao: string | null, status: string): boolean {
  if (!previsao) return false;
  if (status === "entregue" || status === "cancelado") return false;
  return new Date(previsao + "T00:00:00") < new Date();
}

/* ────────────────────────────────────────────────
   Component
──────────────────────────────────────────────── */

export function EntregaDrawer({ open, onClose, entrega }: EntregaDrawerProps) {
  const [remessa, setRemessa] = useState<RemessaDetalhe | null>(null);
  const [itens, setItens] = useState<OVItem[]>([]);
  const [eventos, setEventos] = useState<RemessaEvento[]>([]);
  const [loading, setLoading] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    if (!open || !entrega) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setRemessa(null);
      setItens([]);
      setEventos([]);

      const [remessaRes, itensRes] = await Promise.all([
        supabase
          .from("remessas")
          .select("id,transportadora_id,servico,valor_frete,observacoes,nota_fiscal_id,cliente_id,transportadoras(nome_razao_social)")
          .eq("ordem_venda_id", entrega.id)
          .eq("ativo", true)
          .maybeSingle(),
        supabase
          .from("ordens_venda_itens")
          .select("id,descricao_snapshot,codigo_snapshot,quantidade,valor_unitario,valor_total,peso_total,unidade")
          .eq("ordem_venda_id", entrega.id),
      ]);

      if (cancelled) return;

      const r = remessaRes.data as RemessaDetalhe | null;
      setRemessa(r);
      setItens((itensRes.data as OVItem[]) || []);

      if (r?.id) {
        const { data: evs } = await supabase
          .from("remessa_eventos")
          .select("id,descricao,local,data_hora")
          .eq("remessa_id", r.id)
          .order("data_hora", { ascending: false });
        if (!cancelled) setEventos((evs as RemessaEvento[]) || []);
      }

      setLoading(false);
    };

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entrega?.id]);

  if (!entrega) return <ViewDrawerV2 open={open} onClose={onClose} title="" />;

  const cfg = getStatusConfig(entrega.status_logistico);
  const atrasado = isAtrasado(entrega.previsao_entrega, entrega.status_logistico);
  const pesoTotal = entrega.peso_total;
  const transportadoraNome = remessa?.transportadoras?.nome_razao_social || entrega.transportadora;

  /* ── Summary strip ── */
  const summary = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Pedido</p>
        <p className="text-base font-bold font-mono leading-tight">{entrega.numero_pedido}</p>
        <p className="text-[10px] text-muted-foreground">origem</p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Status</p>
        <div className="flex justify-center">
          <StatusBadge status={cfg.statusKey} label={cfg.label} />
        </div>
        {atrasado && (
          <div className="flex justify-center mt-1">
            <Badge variant="outline" className="text-[10px] border-destructive/40 text-destructive gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />Atrasado
            </Badge>
          </div>
        )}
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Prev. Entrega</p>
        <p className="text-sm font-semibold leading-tight">
          {entrega.previsao_entrega ? formatDate(entrega.previsao_entrega) : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {entrega.data_expedicao ? `Expedido: ${formatDate(entrega.data_expedicao)}` : "não expedido"}
        </p>
      </div>
      <div className="rounded-lg border bg-card p-3 text-center">
        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1">Carga</p>
        <p className="text-sm font-semibold leading-tight">
          {entrega.volumes > 0 ? `${formatNumber(entrega.volumes)} vol.` : "—"}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {pesoTotal > 0 ? `${formatNumber(pesoTotal)} kg` : "sem peso"}
        </p>
      </div>
    </div>
  );

  /* ── Aba Resumo ── */
  const tabResumo = (
    <div className="space-y-4">
      <ViewSection title="Situação logística">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Status">
            <div className="flex items-center gap-1.5 flex-wrap">
              <StatusBadge status={cfg.statusKey} label={cfg.label} />
              {atrasado && (
                <Badge variant="outline" className="text-xs border-destructive/40 text-destructive gap-1">
                  <AlertTriangle className="h-3 w-3" />Atrasado
                </Badge>
              )}
            </div>
          </ViewField>
          <ViewField label="Pedido de Origem">
            <span className="font-mono font-semibold">{entrega.numero_pedido}</span>
          </ViewField>
          <ViewField label="Cliente">{entrega.cliente}</ViewField>
          <ViewField label="Cidade / UF">{entrega.cidade_uf || "—"}</ViewField>
        </div>
      </ViewSection>

      <ViewSection title="Datas">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Prev. Envio">
            {entrega.previsao_envio ? formatDate(entrega.previsao_envio) : "—"}
          </ViewField>
          <ViewField label="Data Expedição">
            {entrega.data_expedicao ? formatDate(entrega.data_expedicao) : "—"}
          </ViewField>
          <ViewField label="Prev. Entrega">
            {entrega.previsao_entrega ? (
              <span className={atrasado ? "text-destructive font-semibold" : ""}>
                {formatDate(entrega.previsao_entrega)}
              </span>
            ) : "—"}
          </ViewField>
        </div>
      </ViewSection>

      {remessa?.observacoes && (
        <ViewSection title="Observações">
          <p className="text-sm">{remessa.observacoes}</p>
        </ViewSection>
      )}
    </div>
  );

  /* ── Aba Carga / Itens ── */
  const tabCarga = (
    <div className="space-y-4">
      <ViewSection title="Resumo da Carga">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Volumes">{entrega.volumes > 0 ? formatNumber(entrega.volumes) : "—"}</ViewField>
          <ViewField label="Peso Total">{pesoTotal > 0 ? `${formatNumber(pesoTotal)} kg` : "—"}</ViewField>
        </div>
      </ViewSection>

      {loading ? (
        <p className="text-xs text-muted-foreground text-center py-3">Carregando itens...</p>
      ) : itens.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-4 text-center">
          <Package className="h-6 w-6 mx-auto text-muted-foreground/50 mb-1" />
          <p className="text-sm text-muted-foreground">Nenhum item vinculado ao pedido.</p>
        </div>
      ) : (
        <ViewSection title={`Itens do Pedido (${itens.length})`}>
          <div className="space-y-2">
            {itens.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.descricao_snapshot || "Item sem descrição"}</p>
                  {item.codigo_snapshot && (
                    <p className="text-[11px] text-muted-foreground font-mono">{item.codigo_snapshot}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">
                    {formatNumber(item.quantidade)}{item.unidade ? ` ${item.unidade}` : ""}
                  </p>
                  {item.peso_total != null && item.peso_total > 0 && (
                    <p className="text-[11px] text-muted-foreground">{formatNumber(item.peso_total)} kg</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ViewSection>
      )}
    </div>
  );

  /* ── Aba Transporte ── */
  const handleRastrear = async () => {
    if (!entrega.codigo_rastreio || !remessa?.id) return;
    const codigo = entrega.codigo_rastreio.trim().toUpperCase().replace(/\s+/g, "");
    if (!codigo) { toast.error("Código de rastreio inválido"); return; }
    setTrackingLoading(true);
    try {
      const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string || "").replace(/\/$/, "");
      const url = `${supabaseUrl}/functions/v1/correios-api?action=rastrear&codigo=${encodeURIComponent(codigo)}`;
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token || "";
      const res = await fetch(url, {
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const tracking = await res.json() as { error?: string; warning?: string };
      if (!res.ok || tracking.error) throw new Error(tracking.error || `Erro (${res.status})`);
      toast.success(tracking.warning === "fallback_mock" ? "Dados simulados — Correios não configurado." : "Rastreio consultado com sucesso.");
      // Refresh events
      const { data: evs } = await supabase
        .from("remessa_eventos")
        .select("id,descricao,local,data_hora")
        .eq("remessa_id", remessa.id)
        .order("data_hora", { ascending: false });
      setEventos((evs as RemessaEvento[]) || []);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao consultar rastreio");
    } finally {
      setTrackingLoading(false);
    }
  };

  const tabTransporte = (
    <div className="space-y-4">
      <ViewSection title="Transportadora">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Transportadora">
            {remessa?.transportadora_id ? (
              <RelationalLink type="fornecedor" id={remessa.transportadora_id}>
                {transportadoraNome}
              </RelationalLink>
            ) : (
              <span>{transportadoraNome !== "—" ? transportadoraNome : "Não informada"}</span>
            )}
          </ViewField>
          <ViewField label="Serviço / Modalidade">
            {remessa?.servico || "—"}
          </ViewField>
          <ViewField label="Valor do Frete">
            {remessa?.valor_frete != null ? `R$ ${formatNumber(remessa.valor_frete)}` : "—"}
          </ViewField>
        </div>
      </ViewSection>

      <ViewSection title="Rastreio">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <ViewField label="Código de Rastreio">
              <span className="font-mono">
                {entrega.codigo_rastreio || "—"}
              </span>
            </ViewField>
            {entrega.codigo_rastreio && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0"
                onClick={handleRastrear}
                disabled={trackingLoading || !remessa?.id}
              >
                <Search className="h-3.5 w-3.5 mr-1.5" />
                {trackingLoading ? "Consultando..." : "Rastrear"}
              </Button>
            )}
          </div>

          {eventos.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-2">
              {entrega.codigo_rastreio
                ? "Nenhum evento registrado. Clique em Rastrear para consultar."
                : "Código de rastreio não informado."}
            </p>
          ) : (
            <div className="space-y-3 pt-1">
              {eventos.slice(0, 5).map((ev, i) => (
                <div key={ev.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`h-2 w-2 rounded-full mt-1 ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                    {i < eventos.slice(0, 5).length - 1 && <div className="w-px flex-1 bg-border my-1" />}
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-xs font-medium">{ev.descricao}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      <span>{formatDate(ev.data_hora)}</span>
                      {ev.local && <><MapPin className="h-2.5 w-2.5" /><span>{ev.local}</span></>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ViewSection>
    </div>
  );

  /* ── Aba Ocorrências ── */
  const ocorrencias = eventos.filter((ev) =>
    /atraso|devolu|parcial|problema|reentrega|falha|recusa|danif/i.test(ev.descricao)
  );
  const temOcorrencia = entrega.status_logistico === "ocorrencia" || atrasado || ocorrencias.length > 0;

  const tabOcorrencias = (
    <div className="space-y-4">
      {temOcorrencia && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 flex gap-3">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-warning mb-1">
              {entrega.status_logistico === "ocorrencia" ? "Entrega com Ocorrência" : atrasado ? "Entrega em Atraso" : "Eventos de Atenção"}
            </p>
            <p className="text-xs text-muted-foreground">
              {entrega.status_logistico === "ocorrencia"
                ? "Esta entrega foi marcada com ocorrência. Verifique os eventos de rastreio e entre em contato com a transportadora."
                : atrasado
                  ? `Previsão de entrega era ${formatDate(entrega.previsao_entrega!)} e ainda não foi concluída.`
                  : "Foram identificados eventos que podem indicar problemas na entrega."}
            </p>
          </div>
        </div>
      )}

      {ocorrencias.length > 0 ? (
        <ViewSection title={`Eventos de Atenção (${ocorrencias.length})`}>
          <div className="space-y-2">
            {ocorrencias.map((ev) => (
              <div key={ev.id} className="rounded-lg border bg-card p-3">
                <p className="text-sm font-medium">{ev.descricao}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                  <Calendar className="h-2.5 w-2.5" />
                  <span>{formatDate(ev.data_hora)}</span>
                  {ev.local && <><MapPin className="h-2.5 w-2.5" /><span>{ev.local}</span></>}
                </div>
              </div>
            ))}
          </div>
        </ViewSection>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-5 text-center">
          <AlertTriangle className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhuma ocorrência registrada.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ocorrências como atraso, devolução e entrega parcial aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  );

  /* ── Aba Vínculos ── */
  const tabVinculos = (
    <div className="space-y-4">
      <ViewSection title="Documentos Relacionados">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Pedido de Venda">
            <RelationalLink type="ordem_venda" id={entrega.id}>
              {entrega.numero_pedido}
            </RelationalLink>
          </ViewField>
          {remessa?.nota_fiscal_id && (
            <ViewField label="Nota Fiscal">
              <RelationalLink type="nota_fiscal" id={remessa.nota_fiscal_id}>
                NF vinculada
              </RelationalLink>
            </ViewField>
          )}
        </div>
      </ViewSection>

      <ViewSection title="Parceiros">
        <div className="grid grid-cols-2 gap-4">
          <ViewField label="Cliente">
            {remessa?.cliente_id ? (
              <RelationalLink type="cliente" id={remessa.cliente_id}>
                {entrega.cliente}
              </RelationalLink>
            ) : (
              <span>{entrega.cliente}</span>
            )}
          </ViewField>
          <ViewField label="Transportadora">
            {remessa?.transportadora_id ? (
              <RelationalLink type="fornecedor" id={remessa.transportadora_id}>
                {transportadoraNome}
              </RelationalLink>
            ) : (
              <span>{transportadoraNome !== "—" ? transportadoraNome : "Não informada"}</span>
            )}
          </ViewField>
        </div>
      </ViewSection>

      {remessa?.id && (
        <ViewSection title="Remessa">
          <ViewField label="Remessa Vinculada">
            <RelationalLink type="remessa" id={remessa.id}>
              Ver remessa / rastreio
            </RelationalLink>
          </ViewField>
        </ViewSection>
      )}
    </div>
  );

  return (
    <ViewDrawerV2
      open={open}
      onClose={onClose}
      title={`Entrega — Pedido ${entrega.numero_pedido}`}
      subtitle={
        <span className="flex items-center gap-2">
          <Truck className="h-3.5 w-3.5" />
          {entrega.cliente}
          {entrega.cidade_uf ? ` · ${entrega.cidade_uf}` : ""}
          {transportadoraNome && transportadoraNome !== "—" ? ` · ${transportadoraNome}` : ""}
        </span>
      }
      badge={
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={cfg.statusKey} label={cfg.label} />
          {atrasado && (
            <Badge variant="outline" className="text-xs border-destructive/40 text-destructive gap-1">
              <AlertTriangle className="h-3 w-3" />Atrasado
            </Badge>
          )}
          {temOcorrencia && entrega.status_logistico !== "ocorrencia" && !atrasado && (
            <Badge variant="outline" className="text-xs border-warning/40 text-warning gap-1">
              <AlertTriangle className="h-3 w-3" />Ocorrência
            </Badge>
          )}
        </div>
      }
      summary={summary}
      tabs={[
        { value: "resumo",      label: "Resumo",      content: tabResumo },
        { value: "carga",       label: "Carga / Itens", content: tabCarga },
        { value: "transporte",  label: "Transporte",  content: tabTransporte },
        { value: "ocorrencias", label: "Ocorrências", content: tabOcorrencias },
        { value: "vinculos",    label: "Vínculos",    content: tabVinculos },
      ]}
      defaultTab="resumo"
    />
  );
}
