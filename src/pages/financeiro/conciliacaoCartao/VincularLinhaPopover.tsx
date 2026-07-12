import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  buscarLancamentosParaVincular,
  vincularLinha,
  criarLancamentoDaLinha,
  type FaturaLinha,
} from "@/services/conciliacaoCartao/faturaLinhas.service";

function fmt(n: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n ?? 0);
}

export function VincularLinhaPopover({ linha, cartaoId }: { linha: FaturaLinha; cartaoId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [termo, setTermo] = useState("");
  const [busy, setBusy] = useState(false);

  const empresa = useQuery({
    queryKey: ["empresa", "atual"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_empresa_id");
      if (error) throw error;
      return data as string;
    },
  });

  const candidatos = useQuery({
    queryKey: ["cartao-linha", "candidatos", linha.id, termo, empresa.data],
    enabled: open && !!empresa.data,
    queryFn: () =>
      buscarLancamentosParaVincular({
        empresa_id: empresa.data as string,
        valor: Number(linha.valor),
        data: linha.data_compra,
        termo,
      }),
  });

  const refetch = () => {
    qc.invalidateQueries({ queryKey: ["cartao-faturas", "linhas"] });
    qc.invalidateQueries({ queryKey: ["cartao-faturas", "lancamentos"] });
  };

  const acaoVincular = async (lancamentoId: string) => {
    setBusy(true);
    try {
      await vincularLinha(linha.id, lancamentoId);
      toast.success("Linha vinculada");
      setOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao vincular");
    } finally { setBusy(false); }
  };

  const acaoCriar = async () => {
    if (!empresa.data) return;
    setBusy(true);
    try {
      await criarLancamentoDaLinha({
        empresa_id: empresa.data,
        linha_id: linha.id,
        cartao_id: cartaoId,
        descricao: linha.descricao ?? "(sem descrição)",
        valor: Number(linha.valor),
        data_vencimento: linha.data_compra,
      });
      toast.success("Lançamento criado e vinculado");
      setOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar lançamento");
    } finally { setBusy(false); }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="ghost" className="h-6 px-1" title="Vincular a lançamento">
          <Link2 className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-2">
          <p className="text-xs font-medium">Vincular linha a lançamento a pagar</p>
          <Input
            placeholder="Buscar por descrição…"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="max-h-56 space-y-1 overflow-auto">
            {candidatos.isLoading ? (
              <p className="text-xs text-muted-foreground">Buscando…</p>
            ) : (candidatos.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem candidatos por valor/data.</p>
            ) : (candidatos.data ?? []).map((c) => (
              <button
                key={c.id}
                disabled={busy}
                onClick={() => acaoVincular(c.id)}
                className="block w-full rounded border p-1.5 text-left text-xs hover:bg-muted"
              >
                <p className="truncate">{c.descricao ?? "(sem descrição)"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {fmt(Number(c.valor))} · Venc. {c.data_vencimento}
                </p>
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" className="w-full h-8" disabled={busy} onClick={acaoCriar}>
            <Plus className="mr-1 h-3.5 w-3.5" />Criar lançamento a pagar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}