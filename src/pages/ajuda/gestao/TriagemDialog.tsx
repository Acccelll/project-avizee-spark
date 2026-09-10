import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SuporteCausa, SuporteChamado, SuporteTipo } from "@/services/suporte.service";
import {
  CAUSA_LABELS,
  STATUS_LABELS,
  TIPO_LABELS,
} from "@/pages/ajuda/suporteLabels";
import {
  useAdmins,
  useAssumirChamado,
  useAtribuirResponsavel,
  useCancelarChamado,
  useResolverChamado,
  useTriarChamado,
} from "@/pages/ajuda/hooks/useSuporteAdmin";

const PRIORIDADES: NonNullable<SuporteChamado["prioridade"]>[] = ["critica", "alta", "normal", "baixa"];
const PRIORIDADE_LABELS: Record<string, string> = {
  critica: "Crítica",
  alta: "Alta",
  normal: "Normal",
  baixa: "Baixa",
};

interface TriagemDialogProps {
  chamado: SuporteChamado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Abre já com a seção de resolução expandida — usado ao soltar um card na coluna "Resolvido" do Kanban. */
  autoAbrirResolucao?: boolean;
}

/**
 * Painel de triagem administrativa: classificação (tipo/prioridade/módulo),
 * responsável, e as ações de ciclo de vida (assumir, resolver, cancelar).
 * Resolver sempre passa por `suporte_resolver_chamado` — nunca por
 * `suporte_triar_chamado` com status='resolvido' direto, porque a tabela
 * exige `resumo_resolucao` preenchido nesse estado.
 */
export function TriagemDialog({ chamado, open, onOpenChange, autoAbrirResolucao }: TriagemDialogProps) {
  const chamadoId = chamado?.id ?? "";
  const { data: admins } = useAdmins();
  const assumir = useAssumirChamado(chamadoId);
  const atribuir = useAtribuirResponsavel(chamadoId);
  const triar = useTriarChamado(chamadoId);
  const resolver = useResolverChamado(chamadoId);
  const cancelar = useCancelarChamado(chamadoId);

  const [tipo, setTipo] = useState<SuporteTipo | "">("");
  const [prioridade, setPrioridade] = useState<string>("");
  const [modulo, setModulo] = useState("");
  const [responsavelId, setResponsavelId] = useState("");
  const [showResolver, setShowResolver] = useState(false);
  const [showCancelar, setShowCancelar] = useState(false);
  const [resumoResolucao, setResumoResolucao] = useState("");
  const [causa, setCausa] = useState<string>("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");

  useEffect(() => {
    if (!chamado) return;
    setTipo(chamado.tipo);
    setPrioridade(chamado.prioridade ?? "");
    setModulo(chamado.modulo ?? "");
    setResponsavelId(chamado.responsavel_id ?? "");
    setShowResolver(!!autoAbrirResolucao);
    setShowCancelar(false);
    setResumoResolucao("");
    setCausa("");
    setMotivoCancelamento("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve resetar quando o chamado exibido muda
  }, [chamado?.id]);

  if (!chamado) return null;

  function salvarClassificacao() {
    triar.mutate({
      tipo: tipo || undefined,
      prioridade: (prioridade || undefined) as NonNullable<SuporteChamado["prioridade"]> | undefined,
      modulo: modulo.trim() || undefined,
    });
  }

  function confirmarResolucao() {
    if (!resumoResolucao.trim()) return;
    resolver.mutate(
      { resumo: resumoResolucao.trim(), causa: (causa || undefined) as SuporteCausa | undefined },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  function confirmarCancelamento() {
    cancelar.mutate(motivoCancelamento.trim() || undefined, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono text-sm text-muted-foreground">{chamado.numero}</span>
            <span>Triagem</span>
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{chamado.resumo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Status atual: <span className="font-medium text-foreground">{STATUS_LABELS[chamado.status]}</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as SuporteTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TIPO_LABELS) as [SuporteTipo, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select value={prioridade} onValueChange={setPrioridade}>
                <SelectTrigger><SelectValue placeholder="Sem prioridade" /></SelectTrigger>
                <SelectContent>
                  {PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORIDADE_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="triagem-modulo">Módulo</Label>
            <Input
              id="triagem-modulo"
              placeholder="ex.: financeiro, estoque, fiscal…"
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
            />
          </div>

          <Button size="sm" onClick={salvarClassificacao} disabled={triar.isPending}>
            Salvar classificação
          </Button>

          <Separator />

          <div className="space-y-2">
            <Label>Responsável</Label>
            <div className="flex gap-2">
              <Select value={responsavelId} onValueChange={setResponsavelId}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Selecionar admin" /></SelectTrigger>
                <SelectContent>
                  {admins?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => atribuir.mutate(responsavelId)}
                disabled={!responsavelId || atribuir.isPending}
              >
                Atribuir
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="-ml-2" onClick={() => assumir.mutate()} disabled={assumir.isPending}>
              Assumir para mim
            </Button>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              className="border-success/40 text-success hover:bg-success/10"
              onClick={() => setShowResolver((v) => !v)}
            >
              Marcar como resolvido
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => setShowCancelar((v) => !v)}
            >
              Cancelar chamado
            </Button>
          </div>

          {showResolver && (
            <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-3">
              <Label htmlFor="triagem-resumo-resolucao">Resumo da resolução (obrigatório)</Label>
              <Textarea
                id="triagem-resumo-resolucao"
                value={resumoResolucao}
                onChange={(e) => setResumoResolucao(e.target.value)}
                rows={3}
                placeholder="O que foi feito para resolver?"
              />
              <Label>Causa (opcional)</Label>
              <Select value={causa} onValueChange={setCausa}>
                <SelectTrigger><SelectValue placeholder="Selecionar causa" /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(CAUSA_LABELS) as [SuporteCausa, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={confirmarResolucao}
                disabled={!resumoResolucao.trim() || resolver.isPending}
              >
                Confirmar resolução
              </Button>
            </div>
          )}

          {showCancelar && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <Label htmlFor="triagem-motivo-cancelamento">Motivo (opcional)</Label>
              <Textarea
                id="triagem-motivo-cancelamento"
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                rows={2}
              />
              <Button size="sm" variant="destructive" onClick={confirmarCancelamento} disabled={cancelar.isPending}>
                Confirmar cancelamento
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
