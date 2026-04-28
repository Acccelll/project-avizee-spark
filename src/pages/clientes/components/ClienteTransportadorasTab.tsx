import { useEffect, useState } from "react";
import {
  listTransportadorasVinculadas,
  listTransportadorasAtivas,
  vincularTransportadora,
  desvincularTransportadora,
  type TransportadoraVinculoView,
} from "@/services/clientes.service";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Truck, Plus, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/errorMessages";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";

interface TransportadoraBasic { id: string; nome_razao_social: string; }

type VinculoRow = TransportadoraVinculoView;

interface Props {
  clienteId: string;
}

export function ClienteTransportadorasTab({ clienteId }: Props) {
  const [vinculos, setVinculos] = useState<VinculoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [transportadoras, setTransportadoras] = useState<TransportadoraBasic[]>([]);
  const [vinculoTranspId, setVinculoTranspId] = useState("");
  const [vinculoPrioridade, setVinculoPrioridade] = useState<number>(1);
  const [savingVinculo, setSavingVinculo] = useState(false);
  const { confirm: confirmRemove, dialog: confirmRemoveDialog } = useConfirmDialog();

  const loadVinculos = async () => {
    setLoading(true);
    try {
      setVinculos(await listTransportadorasVinculadas(clienteId));
    } catch (err) {
      console.error("[clientes] erro ao carregar transportadoras:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    listTransportadorasAtivas()
      .then((data) => setTransportadoras(data as TransportadoraBasic[]))
      .catch((err) => console.error("[clientes] erro ao carregar transportadoras:", err));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadVinculos depende só de clienteId via closure; recriar a função a cada render dispararia refetch
  useEffect(() => { void loadVinculos(); }, [clienteId]);

  const handleAdd = async () => {
    if (!vinculoTranspId) { toast.error("Selecione uma transportadora"); return; }
    if (vinculos.some(t => t.transportadora_id === vinculoTranspId)) {
      toast.error("Transportadora já vinculada"); return;
    }
    setSavingVinculo(true);
    try {
      await vincularTransportadora(clienteId, vinculoTranspId, vinculoPrioridade);
      setVinculoTranspId("");
      setVinculoPrioridade(vinculos.length + 2);
      await loadVinculos();
      toast.success("Transportadora vinculada");
    } catch (err) {
      console.error("[clientes] erro ao vincular transportadora:", err);
      toast.error(getUserFriendlyError(err));
    }
    setSavingVinculo(false);
  };

  const handleRemove = async (vinculoId: string) => {
    const ok = await confirmRemove({
      title: "Remover transportadora",
      description: "Deseja remover o vínculo com esta transportadora?",
      confirmLabel: "Remover",
      confirmVariant: "destructive",
    });
    if (!ok) return;
    try {
      await desvincularTransportadora(vinculoId);
      await loadVinculos();
      toast.success("Vínculo removido");
    } catch (err) {
      console.error("[clientes] erro ao remover vínculo:", err);
      toast.error(getUserFriendlyError(err));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 pt-3 pb-3 border-t">
        <Truck className="w-4 h-4 text-primary/70" />
        <h3 className="font-semibold text-sm">Transportadoras Preferenciais</h3>
        {vinculos.length > 0 && (
          <Badge variant="secondary" className="text-xs px-1.5">{vinculos.length}</Badge>
        )}
      </div>
      <div className="mb-4">
        {loading ? (
          <div className="h-[60px] rounded-lg bg-muted/30 animate-pulse" />
        ) : (
          <>
            <div className="flex gap-2 mb-3">
              <Select value={vinculoTranspId} onValueChange={setVinculoTranspId}>
                <SelectTrigger className="flex-1 h-9"><SelectValue placeholder="Selecionar transportadora..." /></SelectTrigger>
                <SelectContent>
                  {transportadoras
                    .filter(t => !vinculos.some(ct => ct.transportadora_id === t.id))
                    .map(t => <SelectItem key={t.id} value={t.id}>{t.nome_razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                type="button" size="sm"
                disabled={!vinculoTranspId || savingVinculo}
                onClick={handleAdd}
                className="gap-1 h-9"
              >
                <Plus className="h-3.5 w-3.5" />
                Vincular
              </Button>
            </div>
            {vinculos.length === 0 ? (
              <div className="flex items-start gap-2 bg-muted/30 rounded-lg px-3 py-2.5 border border-dashed text-xs text-muted-foreground">
                <Truck className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Nenhuma transportadora vinculada. Use o seletor acima para vincular.</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {vinculos.map((ct) => (
                  <div key={ct.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/30 transition-colors border-b last:border-b-0 group">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {ct.prioridade === 1 && <Star className="h-3 w-3 text-warning shrink-0" />}
                      <span className="text-xs font-medium text-foreground truncate">{ct.transportadora_nome}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {ct.modalidade && <span className="text-xs text-muted-foreground capitalize">{ct.modalidade}</span>}
                      {ct.prazo_medio && <span className="text-xs text-muted-foreground font-mono">{ct.prazo_medio}d</span>}
                      <Button
                        type="button" size="icon" variant="ghost"
                        className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remover vínculo"
                        onClick={() => handleRemove(ct.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {confirmRemoveDialog}
    </div>
  );
}
