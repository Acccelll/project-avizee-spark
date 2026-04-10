import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/format";
import { LogisticaRastreioSection } from "@/components/logistica/LogisticaRastreioSection";
import { Truck, MapPin, Package, Calendar } from "lucide-react";

interface Props {
  id: string;
}

export function RemessaView({ id }: Props) {
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

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando detalhes da remessa...</div>;
  if (!selected) return <div className="p-8 text-center text-destructive">Remessa não encontrada</div>;

  return (
    <div className="space-y-5">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Truck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg font-mono">{selected.codigo_rastreio || "Sem Código"}</h3>
            <p className="text-xs text-muted-foreground">{selected.transportadoras?.nome_razao_social || "Transportadora não definida"}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 text-sm border-t pt-3">
          <div className="flex items-center gap-2">
             <Package className="h-4 w-4 text-muted-foreground" />
             <span>{selected.volumes || 1} volume(s) · {selected.peso ? `${selected.peso}kg` : "—"}</span>
          </div>
          <div className="flex items-center gap-2 justify-end">
             <Calendar className="h-4 w-4 text-muted-foreground" />
             <span>{selected.data_postagem ? formatDate(selected.data_postagem) : "Não postado"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-semibold flex items-center gap-2 px-1 text-muted-foreground uppercase">
          <MapPin className="w-3.5 h-3.5" /> Histórico de Rastreamento
        </h4>
        <LogisticaRastreioSection remessaId={selected.id} />
      </div>
    </div>
  );
}
