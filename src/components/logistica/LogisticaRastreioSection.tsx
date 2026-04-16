import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Search, MapPin, Truck, ExternalLink, Package, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { fetchTracking, normalizarEventos } from "@/services/correios.service";
import { getUserFriendlyError } from "@/utils/errorMessages";

type Remessa = Tables<"remessas"> & {
  transportadoras?: { nome_razao_social: string };
};

type RemessaEvento = Tables<"remessa_eventos">;

interface Props {
  pedidoCompraId?: string;
  notaFiscalId?: string;
  remessaId?: string;
  ordemVendaId?: string;
}

export function LogisticaRastreioSection({ pedidoCompraId, notaFiscalId, remessaId, ordemVendaId }: Props) {
  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [eventos, setEventos] = useState<Record<string, RemessaEvento[]>>({});
  const [loading, setLoading] = useState(true);
  const [trackingLoading, setTrackingLoading] = useState<string | null>(null);
  const [mockWarning, setMockWarning] = useState<string | null>(null);

  const fetchLogistica = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("remessas").select("*, transportadoras(nome_razao_social)");

    if (remessaId) query = query.eq("id", remessaId);
    if (pedidoCompraId) query = query.eq("pedido_compra_id", pedidoCompraId);
    if (notaFiscalId) query = query.eq("nota_fiscal_id", notaFiscalId);
    if (ordemVendaId) query = query.eq("ordem_venda_id", ordemVendaId);

    const { data, error } = await query.eq("ativo", true);

    if (!error && data) {
      setRemessas(data);
      // Batch-fetch events for all remessas in a single query
      if (data.length > 0) {
        const ids = data.map((r: Remessa) => r.id);
        const { data: evs } = await supabase
          .from("remessa_eventos")
          .select("*")
          .in("remessa_id", ids)
          .order("data_hora", { ascending: false });
        if (evs) {
          const grouped: Record<string, RemessaEvento[]> = {};
          for (const ev of evs) {
            const key = ev.remessa_id as string;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(ev);
          }
          setEventos(grouped);
        }
      }
    }
    setLoading(false);
  }, [pedidoCompraId, notaFiscalId, remessaId, ordemVendaId]);

  useEffect(() => {
    fetchLogistica();
  }, [fetchLogistica]);

  const handleRastrear = async (remessa: Remessa) => {
    if (!remessa.codigo_rastreio) return;
    setTrackingLoading(remessa.id);
    setMockWarning(null);
    try {
      const tracking = await fetchTracking(remessa.codigo_rastreio);

      const isMock = tracking.warning === "fallback_mock";
      if (isMock) setMockWarning(remessa.id);

      const eventosNormalizados = normalizarEventos(tracking, remessa.id);

      if (!isMock && eventosNormalizados.length > 0) {
        // Persist only genuinely new events (deduplicate)
        const { data: existentes } = await supabase
          .from("remessa_eventos")
          .select("descricao, local, data_hora")
          .eq("remessa_id", remessa.id);

        const eventKey = (e: { descricao: string; local: string | null; data_hora: string }) =>
          `${e.data_hora}::${e.descricao}::${e.local || ""}`;
        const existentesSet = new Set((existentes || []).map(eventKey));
        const novos = eventosNormalizados.filter((e) => !existentesSet.has(eventKey(e)));

        if (novos.length > 0) {
          await supabase.from("remessa_eventos").insert(novos);
          toast.success(`${novos.length} novo(s) evento(s) incluído(s)`);
        } else {
          toast.success("Rastreio consultado — nenhum evento novo.");
        }
        // Refresh from DB to show persisted events
        fetchLogistica();
      } else if (isMock) {
        // Mock data: show inline but don't persist
        const mockEvs: RemessaEvento[] = eventosNormalizados.map((e, i) => ({
          id: `mock-${i}`,
          remessa_id: remessa.id,
          descricao: e.descricao,
          local: e.local,
          data_hora: e.data_hora,
          created_at: new Date().toISOString(),
        }));
        setEventos((prev) => ({ ...prev, [remessa.id]: mockEvs }));
        toast.warning("Dados mockados — credenciais dos Correios não configuradas.");
      } else {
        toast.success("Rastreio consultado — nenhum evento encontrado.");
      }
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err));
    } finally {
      setTrackingLoading(null);
    }
  };

  if (loading) return <div className="py-4 text-center text-sm text-muted-foreground">Carregando informações logísticas...</div>;

  if (remessas.length === 0) {
    return (
      <div className="py-8 text-center border rounded-lg bg-muted/20">
        <Truck className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma remessa vinculada.</p>
        <Button variant="link" size="sm" className="mt-1" onClick={() => window.location.href = '/logistica'}>
          Ir para Remessas
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {remessas.map((r) => (
        <div key={r.id} className="border rounded-xl p-4 bg-card shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm font-mono text-primary">{r.codigo_rastreio || "Sem código"}</h4>
                <StatusBadge status={r.status_transporte} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {r.transportadoras?.nome_razao_social || "Transportadora não informada"} • {r.servico || "Serviço padrão"}
              </p>
            </div>
            <div className="flex gap-2">
              {r.codigo_rastreio && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => handleRastrear(r)} disabled={trackingLoading === r.id}>
                  <Search className="w-3.5 h-3.5 mr-1.5" />
                  {trackingLoading === r.id ? "Consultando..." : "Rastrear"}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-8" aria-label="Ir para Logística" onClick={() => window.location.href = `/logistica`}>
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 border-y bg-muted/10 -mx-4 px-4">
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Postagem</p>
              <p className="text-sm">{r.data_postagem ? format(new Date(r.data_postagem + "T00:00:00"), "dd/MM/yyyy") : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Previsão</p>
              <p className="text-sm">{r.previsao_entrega ? format(new Date(r.previsao_entrega + "T00:00:00"), "dd/MM/yyyy") : "—"}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Volumes</p>
              <p className="text-sm">{r.volumes || 1}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground">Peso</p>
              <p className="text-sm">{r.peso ? `${r.peso} kg` : "—"}</p>
            </div>
          </div>

          {mockWarning === r.id && (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Dados simulados</strong> — credenciais dos Correios não configuradas. Os eventos exibidos são fictícios e não foram persistidos.
              </p>
            </div>
          )}

          {eventos[r.id] && eventos[r.id].length > 0 ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Package className="w-3 h-3" /> Últimos Eventos
              </p>
              <div className="space-y-3">
                {eventos[r.id].slice(0, 3).map((ev, i) => (
                  <div key={ev.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`h-2 w-2 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                      {i < 2 && <div className="w-px flex-1 bg-border my-1" />}
                    </div>
                    <div className="flex-1 -mt-1">
                      <p className="text-xs font-medium">{ev.descricao}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span>{format(new Date(ev.data_hora), "dd/MM/yyyy HH:mm")}</span>
                        {ev.local && <><MapPin className="h-2.5 w-2.5" /><span>{ev.local}</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic text-center py-2">Nenhum evento registrado ainda.</p>
          )}
        </div>
      ))}
    </div>
  );
}
