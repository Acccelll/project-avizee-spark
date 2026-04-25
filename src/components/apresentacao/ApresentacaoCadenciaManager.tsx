import { useState } from 'react';
import { Loader2, Play, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { ApresentacaoTemplate } from '@/types/apresentacao';
import type { ApresentacaoCadencia, ApresentacaoCadenciaDraft } from '@/services/apresentacaoService';

interface Props {
  cadencias: ApresentacaoCadencia[];
  templates: ApresentacaoTemplate[];
  canManage: boolean;
  isSaving: boolean;
  onSave: (input: Partial<ApresentacaoCadenciaDraft> & { id?: string }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onRunNow: (id: string) => Promise<void>;
}

const emptyDraft: ApresentacaoCadenciaDraft = {
  nome: '',
  template_id: null,
  modo_geracao: 'fechado',
  dia_do_mes: 5,
  exigir_revisao: true,
  destinatarios_emails: [],
  ativo: true,
  observacoes: null,
};

export function ApresentacaoCadenciaManager({ cadencias, templates, canManage, isSaving, onSave, onRemove, onRunNow }: Props) {
  const [draft, setDraft] = useState<ApresentacaoCadenciaDraft>(emptyDraft);
  const [emailsRaw, setEmailsRaw] = useState('');
  const [running, setRunning] = useState<string | null>(null);

  const handleSubmit = async () => {
    const emails = emailsRaw.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
    if (!draft.nome || !draft.template_id) {
      toast.error('Informe nome e template.');
      return;
    }
    await onSave({ ...draft, destinatarios_emails: emails });
    setDraft(emptyDraft);
    setEmailsRaw('');
  };

  const handleRun = async (id: string) => {
    setRunning(id);
    try {
      await onRunNow(id);
      toast.success('Cadência executada. Verifique o histórico.');
    } catch (err) {
      toast.error(`Falha ao executar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Cadência mensal automática</h3>
          <p className="text-xs text-muted-foreground">
            Cria rascunhos no dia configurado e notifica aprovadores por e-mail. A versão final é gerada após aprovação humana.
          </p>
        </div>
      </div>

      {canManage && (
        <div className="grid gap-3 md:grid-cols-2 rounded-md bg-muted/30 p-3">
          <div className="space-y-1">
            <Label>Nome da cadência</Label>
            <Input value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} placeholder="Ex.: Fechamento mensal — Diretoria" />
          </div>
          <div className="space-y-1">
            <Label>Template</Label>
            <Select value={draft.template_id ?? ''} onValueChange={(v) => setDraft((d) => ({ ...d, template_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome} v{t.versao}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Modo</Label>
            <Select value={draft.modo_geracao} onValueChange={(v) => setDraft((d) => ({ ...d, modo_geracao: v as 'dinamico' | 'fechado' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fechado">Fechado</SelectItem>
                <SelectItem value="dinamico">Dinâmico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Dia do mês (1–28)</Label>
            <Input type="number" min={1} max={28} value={draft.dia_do_mes} onChange={(e) => setDraft((d) => ({ ...d, dia_do_mes: Math.max(1, Math.min(28, Number(e.target.value) || 1)) }))} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>E-mails dos aprovadores (separados por vírgula)</Label>
            <Textarea rows={2} value={emailsRaw} onChange={(e) => setEmailsRaw(e.target.value)} placeholder="diretoria@empresa.com, financeiro@empresa.com" />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={draft.exigir_revisao} onCheckedChange={(v) => setDraft((d) => ({ ...d, exigir_revisao: v }))} />
            <Label className="text-xs">Exigir revisão antes da versão final</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={draft.ativo} onCheckedChange={(v) => setDraft((d) => ({ ...d, ativo: v }))} />
            <Label className="text-xs">Ativa</Label>
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              Adicionar cadência
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {cadencias.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma cadência configurada.</p>}
        {cadencias.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.nome}</span>
                <Badge variant={c.ativo ? 'default' : 'secondary'}>{c.ativo ? 'Ativa' : 'Inativa'}</Badge>
                <Badge variant="outline">Dia {c.dia_do_mes}</Badge>
                <Badge variant="outline">{c.modo_geracao}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {c.destinatarios_emails.length} destinatário(s) · {c.exigir_revisao ? 'requer revisão' : 'sem revisão'}
                {c.ultima_execucao_em && ` · última: ${new Date(c.ultima_execucao_em).toLocaleString('pt-BR')} (${c.ultima_execucao_status ?? '—'})`}
              </div>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => handleRun(c.id)} disabled={running === c.id}>
                  {running === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onRemove(c.id).catch((e) => toast.error(String(e)))}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}