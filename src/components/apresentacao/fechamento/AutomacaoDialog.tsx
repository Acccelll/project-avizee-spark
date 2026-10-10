import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { listarApresentacaoCadencias, salvarApresentacaoCadencia } from '@/services/apresentacaoService';

/**
 * Geração automática: no dia escolhido, cria o rascunho do mês anterior na
 * versão certa (trimestral em mar/jun/set, anual em dez) e avisa por e-mail.
 */
export function AutomacaoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: cadencias = [], isLoading } = useQuery({ queryKey: ['apresentacao-cadencias'], queryFn: listarApresentacaoCadencias, enabled: open });
  const atual = cadencias[0];
  const [ativo, setAtivo] = useState(false);
  const [dia, setDia] = useState('5');
  const [emails, setEmails] = useState('');

  useEffect(() => {
    if (!open) return;
    setAtivo(atual?.ativo ?? false);
    setDia(String(atual?.dia_do_mes ?? 5));
    setEmails((atual?.destinatarios_emails ?? []).join(', '));
  }, [open, atual]);

  const salvar = useMutation({
    mutationFn: async () => {
      const d = Number(dia);
      if (!Number.isInteger(d) || d < 1 || d > 28) throw new Error('Escolha um dia entre 1 e 28.');
      await salvarApresentacaoCadencia({
        id: atual?.id,
        nome: 'Fechamento mensal',
        template_id: null,
        modo_geracao: 'fechado',
        dia_do_mes: d,
        exigir_revisao: false,
        destinatarios_emails: emails.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean),
        ativo,
        observacoes: atual?.observacoes ?? null,
      });
    },
    onSuccess: () => {
      toast.success('Geração automática salva.');
      qc.invalidateQueries({ queryKey: ['apresentacao-cadencias'] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Geração automática</DialogTitle>
          <DialogDescription>
            No dia escolhido, o sistema cria o rascunho do mês anterior na versão certa (trimestral em março, junho e setembro; anual em dezembro) e avisa por e-mail.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-ativo">Criar o rascunho todo mês</Label>
              <Switch id="auto-ativo" checked={ativo} onCheckedChange={setAtivo} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto-dia">Dia do mês</Label>
              <Input id="auto-dia" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} className="w-24" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auto-emails">Avisar por e-mail</Label>
              <Textarea id="auto-emails" rows={2} placeholder="nome@empresa.com.br, outro@empresa.com.br" value={emails} onChange={(e) => setEmails(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} disabled={salvar.isPending || isLoading}>
            {salvar.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
