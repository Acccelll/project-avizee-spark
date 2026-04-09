import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { SocialConnectionStatus, SocialCreateContaPayload, SocialPlatform } from '@/types/social';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: SocialCreateContaPayload) => Promise<void>;
}

const statusOptions: SocialConnectionStatus[] = ['conectado', 'expirado', 'erro', 'desconectado'];

export function SocialContaModal({ open, onOpenChange, onSubmit }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SocialCreateContaPayload>({
    plataforma: 'instagram_business',
    nome_conta: '',
    identificador_externo: '',
    url_conta: '',
    status_conexao: 'conectado',
    escopos: [],
  });
  const [escoposText, setEscoposText] = useState('insights_read, posts_read');

  const disabled = useMemo(
    () => !form.nome_conta.trim() || !form.identificador_externo.trim() || saving,
    [form.identificador_externo, form.nome_conta, saving],
  );

  const handleSubmit = async () => {
    if (disabled) return;
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        escopos: escoposText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      onOpenChange(false);
      setForm({
        plataforma: 'instagram_business',
        nome_conta: '',
        identificador_externo: '',
        url_conta: '',
        status_conexao: 'conectado',
        escopos: [],
      });
      setEscoposText('insights_read, posts_read');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastro de conta social</DialogTitle>
          <DialogDescription>Fluxo operacional mínimo para governança de contas conectadas.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label>Plataforma</Label>
            <Select value={form.plataforma} onValueChange={(value) => setForm((prev) => ({ ...prev, plataforma: value as SocialPlatform }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="instagram_business">Instagram</SelectItem>
                <SelectItem value="linkedin_page">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nome da conta</Label>
            <Input value={form.nome_conta} onChange={(event) => setForm((prev) => ({ ...prev, nome_conta: event.target.value }))} placeholder="Ex.: AviZee Oficial" />
          </div>

          <div className="space-y-1.5">
            <Label>Identificador externo</Label>
            <Input value={form.identificador_externo} onChange={(event) => setForm((prev) => ({ ...prev, identificador_externo: event.target.value }))} placeholder="Ex.: ig-avizee-oficial" />
          </div>

          <div className="space-y-1.5">
            <Label>URL da conta</Label>
            <Input value={form.url_conta ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, url_conta: event.target.value }))} placeholder="https://instagram.com/avizee" />
          </div>

          <div className="space-y-1.5">
            <Label>Status da conexão</Label>
            <Select value={form.status_conexao} onValueChange={(value) => setForm((prev) => ({ ...prev, status_conexao: value as SocialConnectionStatus }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Escopos (separados por vírgula)</Label>
            <Input value={escoposText} onChange={(event) => setEscoposText(event.target.value)} placeholder="insights_read, posts_read" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={disabled}>{saving ? 'Salvando...' : 'Salvar conta'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
