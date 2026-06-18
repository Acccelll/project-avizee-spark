import { CalendarDays, Clock } from "lucide-react";
import { JustCreatedBanner } from "@/components/ui/JustCreatedBanner";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate, formatWeightKg } from "@/lib/format";

interface ClienteSnap {
  nome_razao_social?: string;
}

interface ItemLite {
  produto_id?: string | null;
}

interface EditMetaBannerProps {
  isEdit: boolean;
  isMobile: boolean;
  numero?: string | null;
  status?: string | null;
  clienteSnapshot: ClienteSnap;
  dataOrcamento?: string | null;
  validade?: string | null;
  lastAutoSaveAt?: number | null;
  valorTotal: number;
  pesoTotal: number;
  items: ItemLite[];
}

export function EditMetaBanner({
  isEdit,
  isMobile,
  numero,
  status,
  clienteSnapshot,
  dataOrcamento,
  validade,
  lastAutoSaveAt,
  valorTotal,
  pesoTotal,
  items,
}: EditMetaBannerProps) {
  const itemCount = items.filter((i) => i.produto_id).length;
  return (
    <>
      {isEdit && numero && (
        <JustCreatedBanner
          message={`Orçamento ${numero} criado. Adicione itens para concluir a proposta.`}
          ctaLabel="Ir para itens"
          onCta={() => document.getElementById("orcamento-itens")?.scrollIntoView({ behavior: "smooth" })}
        />
      )}
      {isEdit && (
        <div className="hidden md:flex items-center flex-wrap gap-x-6 gap-y-2 rounded-xl border bg-card/60 px-5 py-3 text-sm shadow-soft">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Orçamento</span>
            <span className="font-mono font-bold text-primary">{numero || "—"}</span>
          </div>
          {clienteSnapshot.nome_razao_social && (
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Cliente</span>
              <span className="font-medium truncate max-w-[200px]">{clienteSnapshot.nome_razao_social}</span>
            </div>
          )}
          <StatusBadge status={status} />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Emissão: <span className="text-foreground font-medium">{formatDate(dataOrcamento)}</span></span>
          </div>
          {validade && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Validade: <span className={`font-medium ${new Date(validade) < new Date(new Date().toDateString()) ? "text-destructive" : "text-foreground"}`}>{formatDate(validade)}</span></span>
            </div>
          )}
          {lastAutoSaveAt && (
            <div className="text-xs text-muted-foreground">
              Autosave às {new Date(lastAutoSaveAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          )}
          <div className="ml-auto font-bold text-base text-primary font-mono">{formatCurrency(valorTotal)}</div>
        </div>
      )}

      {isMobile && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm font-semibold">{numero || '—'}</p>
            {isEdit && <StatusBadge status={status} />}
          </div>
          <p className="truncate text-sm font-medium" title={clienteSnapshot.nome_razao_social || ''}>
            {clienteSnapshot.nome_razao_social || 'Selecione um cliente'}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{formatCurrency(valorTotal)}</span>
            <span> · {itemCount} {itemCount === 1 ? 'item' : 'itens'}</span>
            {pesoTotal > 0 && <span> · {formatWeightKg(pesoTotal)}</span>}
          </p>
          {isEdit && validade && (
            <p className="text-[11px] text-muted-foreground">Válido até {formatDate(validade)}</p>
          )}
        </div>
      )}
    </>
  );
}