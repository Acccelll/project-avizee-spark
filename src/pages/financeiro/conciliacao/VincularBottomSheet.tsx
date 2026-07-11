import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/format";
import type { OFXTransaction } from "@/lib/parseOFX";
import type { Lancamento } from "@/types/domain";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  vincularExtratoId: string | null;
  vincularSearch: string;
  setVincularSearch: (v: string) => void;
  extratoItems: OFXTransaction[];
  lancamentos: Lancamento[];
  usedLancamentoIds: Set<string>;
  onManualMatch: (extratoId: string, lancamentoId: string) => void;
}

function getLancamentoNome(l: Lancamento): string {
  return (
    (l.tipo === "receber"
      ? l.clientes?.nome_razao_social
      : l.fornecedores?.nome_razao_social) ||
    "Sem cliente/fornecedor vinculado"
  );
}

function LancamentoResumo({ lancamento }: { lancamento: Lancamento }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium truncate">
        <span className="text-muted-foreground font-normal">Nome: </span>
        {getLancamentoNome(lancamento)}
      </p>
      <p className="text-xs text-muted-foreground truncate">
        Descrição: {lancamento.descricao || "—"}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDate(lancamento.data_vencimento)} · {lancamento.tipo === "receber" ? "A Receber" : "A Pagar"}
      </p>
    </div>
  );
}

export function VincularBottomSheet(p: Props) {
  return (
    <Sheet open={p.open} onOpenChange={p.onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88svh] overflow-y-auto rounded-t-2xl pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader>
          <SheetTitle className="text-left">Vincular lançamento</SheetTitle>
        </SheetHeader>
        {(() => {
          const extrato = p.extratoItems.find((e) => e.id === p.vincularExtratoId);
          if (!extrato) return null;
          const valorAbs = Math.abs(extrato.valor);
          const extratoDate = new Date(extrato.data);
          const candidatos = p.lancamentos.filter((l) => {
            if (p.usedLancamentoIds.has(l.id)) return false;
            const valorMatch = Math.abs(Math.abs(l.valor) - valorAbs) < 0.05;
            const lancDate = new Date(l.data_vencimento);
            const diffDays = Math.abs((extratoDate.getTime() - lancDate.getTime()) / (1000 * 60 * 60 * 24));
            return valorMatch || diffDays <= 3;
          });
          const term = p.vincularSearch.trim().toLowerCase();
          const filtrados = term
            ? candidatos.filter((l) => {
                const nome = getLancamentoNome(l).toLowerCase();
                const descricao = (l.descricao ?? "").toLowerCase();
                return nome.includes(term) || descricao.includes(term);
              })
            : candidatos;
          const todos = p.lancamentos.filter((l) => !p.usedLancamentoIds.has(l.id));
          return (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium truncate">{extrato.descricao || "Sem descrição"}</p>
                <div className="flex items-center justify-between mt-1 text-xs">
                  <span className="text-muted-foreground">{formatDate(extrato.data)}</span>
                  <span className={`font-mono font-semibold ${extrato.valor >= 0 ? "text-success" : "text-destructive"}`}>
                    {formatCurrency(extrato.valor)}
                  </span>
                </div>
              </div>
              <Input
                placeholder="Buscar por nome ou descrição..."
                value={p.vincularSearch}
                onChange={(e) => p.setVincularSearch(e.target.value)}
                className="h-11"
              />
              <div className="space-y-2 max-h-[55svh] overflow-y-auto">
                {filtrados.length > 0 ? (
                  <>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                      Sugestões ({filtrados.length})
                    </p>
                    {filtrados.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        className="w-full text-left rounded-lg border p-3 min-h-11 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                        onClick={() => {
                          p.onManualMatch(extrato.id, l.id);
                          p.onOpenChange(false);
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <LancamentoResumo lancamento={l} />
                          <span className="text-sm font-mono font-semibold shrink-0">{formatCurrency(l.valor)}</span>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma sugestão por valor/data. Veja todos abaixo.
                  </p>
                )}
                {todos.length > filtrados.length && (
                  <>
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider pt-2">
                      Todos os disponíveis ({todos.length})
                    </p>
                    {todos
                      .filter((l) => !filtrados.find((f) => f.id === l.id))
                      .filter((l) => {
                        if (!term) return true;
                        const nome = getLancamentoNome(l).toLowerCase();
                        const descricao = (l.descricao ?? "").toLowerCase();
                        return nome.includes(term) || descricao.includes(term);
                      })
                      .slice(0, 50)
                      .map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          className="w-full text-left rounded-lg border p-3 min-h-11 hover:bg-muted/30 active:bg-muted/50 transition-colors"
                          onClick={() => {
                            p.onManualMatch(extrato.id, l.id);
                            p.onOpenChange(false);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <LancamentoResumo lancamento={l} />
                            <span className="text-sm font-mono font-semibold shrink-0">{formatCurrency(l.valor)}</span>
                          </div>
                        </button>
                      ))}
                  </>
                )}
              </div>
            </div>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}