import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { UserCheck, Copy, XCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminUsuarios } from '@/hooks/suporte/useAdminUsuarios';
import { getChamadoPorNumero } from '@/services/suporte/chamados.service';
import type { useChamado } from '@/hooks/suporte/useChamado';
import {
  SUPORTE_TIPO_LABELS,
  SUPORTE_PRIORIDADE_LABELS,
  SUPORTE_STATUS_LABELS,
  SUPORTE_CAUSA_LABELS,
  type SuporteChamado,
  type SuporteTipo,
  type SuportePrioridade,
  type SuporteStatus,
  type SuporteCausa,
} from '@/services/suporte/types';

const TIPOS = Object.keys(SUPORTE_TIPO_LABELS) as SuporteTipo[];
const PRIORIDADES = Object.keys(SUPORTE_PRIORIDADE_LABELS) as SuportePrioridade[];
const STATUSES = Object.keys(SUPORTE_STATUS_LABELS) as SuporteStatus[];
const CAUSAS = Object.keys(SUPORTE_CAUSA_LABELS) as SuporteCausa[];

type ChamadoActions = ReturnType<typeof useChamado>;

interface Props {
  chamado: SuporteChamado;
  actions: ChamadoActions;
}

/**
 * Painel administrativo dentro do detalhe do chamado (seções 18–21, 24, 28).
 * Só é montado quando `useIsAdmin()` é true — RLS/RPC garantem a defesa real.
 */
export function TriagemAdminPanel({ chamado, actions }: Props) {
  const { user } = useAuth();
  const { admins } = useAdminUsuarios();
  const { assumir, atribuirResponsavel, triar, resolver, cancelar, marcarDuplicado } = actions;

  const [modulo, setModulo] = useState(chamado.modulo ?? '');
  const [resumoResolucao, setResumoResolucao] = useState(chamado.resumo_resolucao ?? '');
  const [causa, setCausa] = useState<SuporteCausa | ''>((chamado.causa_resolucao as SuporteCausa) ?? '');
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [numeroDuplicado, setNumeroDuplicado] = useState('');
  const [buscandoDuplicado, setBuscandoDuplicado] = useState(false);

  const jaEncerrado = chamado.status === 'fechado' || chamado.status === 'cancelado';
  const responsavelAtual = admins.find((a) => a.id === chamado.responsavel_id);

  const handleMarcarDuplicado = async () => {
    if (!numeroDuplicado.trim()) return;
    setBuscandoDuplicado(true);
    try {
      const alvo = await getChamadoPorNumero(numeroDuplicado);
      if (!alvo) {
        toast.error(`Chamado ${numeroDuplicado} não encontrado.`);
        return;
      }
      if (alvo.id === chamado.id) {
        toast.error('Um chamado não pode ser duplicado dele mesmo.');
        return;
      }
      marcarDuplicado.mutate(alvo.id);
      setNumeroDuplicado('');
    } finally {
      setBuscandoDuplicado(false);
    }
  };

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base">Triagem (administrador)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {!chamado.responsavel_id && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => assumir.mutate()}
              disabled={assumir.isPending}
            >
              <UserCheck className="h-4 w-4" /> Assumir chamado
            </Button>
          )}
          <Select
            value={chamado.responsavel_id ?? undefined}
            onValueChange={(v) => atribuirResponsavel.mutate(v)}
          >
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Atribuir para…">
                {responsavelAtual?.nome ?? (chamado.responsavel_id === user?.id ? 'Você' : undefined)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {admins.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={chamado.tipo}
              onValueChange={(v) => triar.mutate({ tipo: v as SuporteTipo })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map((t) => (
                  <SelectItem key={t} value={t}>{SUPORTE_TIPO_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Prioridade</Label>
            <Select
              value={chamado.prioridade ?? undefined}
              onValueChange={(v) => triar.mutate({ prioridade: v as SuportePrioridade })}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Definir…" /></SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p} value={p}>{SUPORTE_PRIORIDADE_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={chamado.status}
              onValueChange={(v) => triar.mutate({ status: v as SuporteStatus })}
            >
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{SUPORTE_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Módulo</Label>
          <div className="flex gap-2">
            <Input
              value={modulo}
              onChange={(e) => setModulo(e.target.value)}
              placeholder="ex.: financeiro, estoque…"
              className="h-9"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={triar.isPending || modulo === (chamado.modulo ?? '')}
              onClick={() => triar.mutate({ modulo: modulo || undefined })}
            >
              Salvar
            </Button>
          </div>
        </div>

        <Separator />

        {!jaEncerrado && (
          <div className="space-y-2">
            <Label className="text-xs">Resumo da resolução</Label>
            <Textarea
              value={resumoResolucao}
              onChange={(e) => setResumoResolucao(e.target.value)}
              placeholder="O que foi feito para resolver…"
              rows={2}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Select value={causa} onValueChange={(v) => setCausa(v as SuporteCausa)}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Classificação (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {CAUSAS.map((c) => (
                    <SelectItem key={c} value={c}>{SUPORTE_CAUSA_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="gap-1.5"
                disabled={!resumoResolucao.trim() || resolver.isPending}
                onClick={() => resolver.mutate({ resumo: resumoResolucao.trim(), causa: causa || undefined })}
              >
                {resolver.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Marcar como resolvido
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={numeroDuplicado}
            onChange={(e) => setNumeroDuplicado(e.target.value)}
            placeholder="CH-000123"
            className="h-9 w-36"
          />
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!numeroDuplicado.trim() || buscandoDuplicado || marcarDuplicado.isPending}
            onClick={handleMarcarDuplicado}
          >
            <Copy className="h-4 w-4" /> Marcar como duplicado de…
          </Button>

          {!jaEncerrado && (
            <div className="ml-auto flex items-center gap-2">
              <Input
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                placeholder="Motivo do cancelamento (opcional)"
                className="h-9 w-56"
              />
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-destructive hover:text-destructive"
                disabled={cancelar.isPending}
                onClick={() => cancelar.mutate(motivoCancelamento || undefined)}
              >
                <XCircle className="h-4 w-4" /> Cancelar chamado
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
