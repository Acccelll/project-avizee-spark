import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { usePublishDrawerSlots } from "@/contexts/RelationalDrawerSlotsContext";
import { Truck, MapPin, Package, Calendar } from "lucide-react";

interface Props {
  id: string;
}

export function RemessaView({ id }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: r } = await supabase
        .from("remessas")
        .select("*, transportadoras(nome_razao_social)")
        .eq("id", id)
        .single();

      if (!r) return;
      setSelected(r);
      setLoading(false);
    };

    fetchData();
  }, [id]);

  // Publica slots no header padronizado
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
  } : {});

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando detalhes da remessa...</div>;
  if (!selected) return <div className="p-8 text-center text-destructive">Remessa não encontrada</div>;

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
