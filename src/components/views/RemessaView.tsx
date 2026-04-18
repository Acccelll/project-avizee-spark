import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { usePublishDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { useRelationalNavigation } from "@/contexts/RelationalNavigationContext";
import { useDetailFetch } from "@/hooks/useDetailFetch";
import { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { DetailLoading, DetailError, DetailEmpty } from "@/components/ui/DetailStates";
import { Truck, MapPin, Package, Calendar, Edit } from "lucide-react";

interface Props {
  id: string;
}

type RemessaWithTransp = Tables<"remessas"> & {
  transportadoras: { nome_razao_social: string } | null;
};

export function RemessaView({ id }: Props) {
  const navigate = useNavigate();
  const { clearStack } = useRelationalNavigation();

  // Fetch padronizado — corrige loading eterno (A2) e race (A1).
  const { data: selected, loading, error } = useDetailFetch<RemessaWithTransp>(id, async (rid, signal) => {
    const { data, error: err } = await supabase
      .from("remessas")
      .select("*, transportadoras(nome_razao_social)")
      .eq("id", rid)
      .abortSignal(signal)
      .maybeSingle();
    if (err) throw err;
    return (data as RemessaWithTransp | null) ?? null;
  });

  // Slots padronizados — agora publica `actions` (D3) com atalho para Logística.
  usePublishDrawerSlots(`remessa:${id}`, selected ? {
    breadcrumb: selected.codigo_rastreio ? `Remessa · ${selected.codigo_rastreio}` : "Remessa",
    summary: (
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Truck className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm leading-tight truncate font-mono">
            {selected.codigo_rastreio || "Sem Código"}
          </h3>
          <p className="text-[11px] text-muted-foreground">
            {selected.transportadoras?.nome_razao_social || "Transportadora não definida"}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Package className="h-3 w-3" />
              {selected.volumes || 1} vol · {selected.peso ? `${selected.peso}kg` : "—"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {selected.data_postagem ? formatDate(selected.data_postagem) : "Não postado"}
            </span>
          </div>
        </div>
      </div>
    ),
    actions: (
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        aria-label="Abrir tela de logística"
        onClick={() => { clearStack(); navigate("/logistica"); }}
      >
        <Edit className="h-3.5 w-3.5" /> Abrir em Logística
      </Button>
    ),
  } : {});

  if (loading) return <DetailLoading />;
  if (error) return <DetailError title="Erro ao carregar remessa" message={error.message} />;
  if (!selected) return <DetailEmpty title="Remessa não encontrada" icon={Truck} />;

  return (
    <div className="space-y-5">
      <div className="space-y-4">
        <h4 className="text-xs font-semibold flex items-center gap-2 px-1 text-muted-foreground uppercase">
          <MapPin className="w-3.5 h-3.5" /> Histórico de Rastreamento
        </h4>
        <LogisticaRastreioSection remessaId={selected.id} />
      </div>
    </div>
  );
}
