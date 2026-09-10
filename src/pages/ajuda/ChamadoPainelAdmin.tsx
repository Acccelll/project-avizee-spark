import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import type { SuporteCausa, SuporteChamado, SuporteDecisaoSugestao, SuporteTipo } from "@/services/suporte.service";
import {
  CAUSA_LABELS,
  DECISAO_SUGESTAO_LABELS,
  STATUS_BADGE_CLASS,
  STATUS_BADGE_VARIANT,
  STATUS_LABELS,
  TIPO_LABELS,
} from "@/pages/ajuda/suporteLabels";
import {
  useAdmins,
  useAssumirChamado,
  useAtribuirResponsavel,
  useAtualizarDecisaoSugestao,
  useCancelarChamado,
  useFilaChamados,
  useMarcarDuplicado,
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

interface ChamadoPainelAdminProps {
  chamado: SuporteChamado;
}

/**
 * Painel lateral da página administrativa do chamado (spec §29): status,
 * prioridade, responsável, módulo, tipo, versão reportada e ações de
 * triagem — tudo inline, sem modal, já que a página inteira é dedicada.
 */
export function ChamadoPainelAdmin({ chamado }: ChamadoPainelAdminProps) {
  const { data: admins } = useAdmins();
  const { data: fila } = useFilaChamados();
  const triar = useTriarChamado(chamado.id);
  const assumir = useAssumirChamado(chamado.id);
  const atribuir = useAtribuirResponsavel(chamado.id);
  const resolver = useResolverChamado(chamado.id);
  const cancelar = useCancelarChamado(chamado.id);
  const marcarDuplicado = useMarcarDuplicado(chamado.id);
  const atualizarDecisao = useAtualizarDecisaoSugestao(chamado.id);

  const [tipo, setTipo] = useState<SuporteTipo | "">(chamado.tipo);
  const [prioridade, setPrioridade] = useState<string>(chamado.prioridade ?? "");
  const [modulo, setModulo] = useState(chamado.modulo ?? "");
  const [responsavelId, setResponsavelId] = useState(chamado.responsavel_id ?? "");
  const [showResolver, setShowResolver] = useState(false);
  const [showCancelar, setShowCancelar] = useState(false);
  const [showDuplicado, setShowDuplicado] = useState(false);
  const [resumoResolucao, setResumoResolucao] = useState("");
  const [causa, setCausa] = useState<string>("");
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [duplicadoDeId, setDuplicadoDeId] = useState("");
  const [decisao, setDecisao] = useState<string>(chamado.decisao_sugestao ?? "");
  const [decisaoObservacao, setDecisaoObservacao] = useState(chamado.decisao_observacao ?? "");

  useEffect(() => {
    setTipo(chamado.tipo);
    setPrioridade(chamado.prioridade ?? "");
    setModulo(chamado.modulo ?? "");
    setResponsavelId(chamado.responsavel_id ?? "");
    setDecisao(chamado.decisao_sugestao ?? "");
    setDecisaoObservacao(chamado.decisao_observacao ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só deve resetar quando o chamado exibido muda
  }, [chamado.id]);

  const outrosChamados = useMemo(
    () => (fila ?? []).filter((c) => c.id !== chamado.id),
    [fila, chamado.id],
  );

  function salvarClassificacao() {
    triar.mutate({
      tipo: tipo || undefined,
      prioridade: (prioridade || undefined) as NonNullable<SuporteChamado["prioridade"]> | undefined,
      modulo: modulo.trim() || undefined,
    });
  }

  function confirmarResolucao() {
    if (!resumoResolucao.trim()) return;
    resolver.mutate({ resumo: resumoResolucao.trim(), causa: (causa || undefined) as SuporteCausa | undefined });
  }

  function confirmarCancelamento() {
    cancelar.mutate(motivoCancelamento.trim() || undefined, { onSuccess: () => setShowCancelar(false) });
  }

  function confirmarDuplicado() {
    if (!duplicadoDeId) return;
    marcarDuplicado.mutate(duplicadoDeId, { onSuccess: () => setShowDuplicado(false) });
  }

  function salvarDecisao() {
    if (!decisao) return;
    atualizarDecisao.mutate({ decisao: decisao as SuporteDecisaoSugestao, observacao: decisaoObservacao });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-2 pb-3">
          <p className="text-xs text-muted-foreground">Status atual</p>
          <Badge variant={STATUS_BADGE_VARIANT[chamado.status]} className={cn("w-fit", STATUS_BADGE_CLASS[chamado.status])}>
            {STATUS_LABELS[chamado.status]}
          </Badge>
          {chamado.versao_corrigida && (
            <p className="text-xs text-muted-foreground">Versão corrigida: {chamado.versao_corrigida}</p>
          )}
          {chamado.duplicado_de_id && (
            <p className="text-xs text-muted-foreground">
              Duplicado de <span className="font-mono">{chamado.duplicado_de_id}</span>
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Label htmlFor="painel-modulo">Módulo</Label>
            <Input
              id="painel-modulo"
              placeholder="ex.: financeiro, estoque, fiscal…"
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
            />
          </div>

          <Button size="sm" className="w-full" onClick={salvarClassificacao} disabled={triar.isPending}>
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
        </CardContent>
      </Card>

      {chamado.tipo === "sugestao" && (
        <Card>
          <CardHeader className="pb-3"><p className="text-sm font-semibold">Decisão da sugestão</p></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Separado do status operacional do chamado (spec §31) — é a decisão de produto sobre a ideia.
            </p>
            <Select value={decisao} onValueChange={setDecisao}>
              <SelectTrigger><SelectValue placeholder="Selecionar decisão" /></SelectTrigger>
              <SelectContent>
                {(Object.entries(DECISAO_SUGESTAO_LABELS) as [SuporteDecisaoSugestao, string][]).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder='Observação, ex.: "Será considerada na revisão do módulo Financeiro."'
              value={decisaoObservacao}
              onChange={(e) => setDecisaoObservacao(e.target.value)}
              rows={2}
            />
            <Button size="sm" onClick={salvarDecisao} disabled={!decisao || atualizarDecisao.isPending}>
              Salvar decisão
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><p className="text-sm font-semibold">Ações</p></CardHeader>
        <CardContent className="space-y-3">
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
            <Button size="sm" variant="outline" onClick={() => setShowDuplicado((v) => !v)}>
              Marcar como duplicado
            </Button>
          </div>

          {showResolver && (
            <div className="space-y-2 rounded-md border border-success/30 bg-success/5 p-3">
              <Label htmlFor="painel-resumo-resolucao">Resumo da resolução (obrigatório)</Label>
              <Textarea
                id="painel-resumo-resolucao"
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
              <Button size="sm" onClick={confirmarResolucao} disabled={!resumoResolucao.trim() || resolver.isPending}>
                Confirmar resolução
              </Button>
            </div>
          )}

          {showCancelar && (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <Label htmlFor="painel-motivo-cancelamento">Motivo (opcional)</Label>
              <Textarea
                id="painel-motivo-cancelamento"
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                rows={2}
              />
              <Button size="sm" variant="destructive" onClick={confirmarCancelamento} disabled={cancelar.isPending}>
                Confirmar cancelamento
              </Button>
            </div>
          )}

          {showDuplicado && (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <Label>Chamado original</Label>
              <Select value={duplicadoDeId} onValueChange={setDuplicadoDeId}>
                <SelectTrigger><SelectValue placeholder="Selecionar chamado…" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {outrosChamados.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.numero} — {c.resumo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={confirmarDuplicado} disabled={!duplicadoDeId || marcarDuplicado.isPending}>
                Confirmar duplicidade
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Criado em {formatDateTime(chamado.created_at)} · Atualizado em {formatDateTime(chamado.updated_at)}
      </p>
    </div>
  );
}
