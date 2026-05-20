import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import { formatDate } from '@/lib/format';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { RefreshCcw } from 'lucide-react';
import type { SocialConta } from '@/types/social';
import { socialPlatformLabel } from '@/types/social';

interface Props {
  contas: SocialConta[];
  canManageAccounts: boolean;
  canSync: boolean;
  onSync: (contaId?: string) => Promise<void>;
  onDisable: (contaId: string) => Promise<void>;
}

export function SocialContasTab({ contas, canManageAccounts, canSync, onSync, onDisable }: Props) {
  const { confirm, dialog: confirmDialog } = useConfirmDialog();

  const handleDisable = async (contaId: string, nomeConta: string) => {
    const ok = await confirm({
      title: 'Desativar conta social?',
      description: `Desativar "${nomeConta}" interromperá a sincronização de métricas e posts desta conta. É possível reativar posteriormente.`,
      confirmLabel: 'Desativar',
      confirmVariant: 'destructive',
    });
    if (!ok) return;
    await onDisable(contaId);
  };

  return (
    <>
    <DataTable
      data={contas}
      mobileStatusKey="status_conexao"
      mobileIdentifierKey="nome_conta"
      mobilePrimaryAction={(item: SocialConta) => (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => { e.stopPropagation(); onSync(item.id); }}
          disabled={!canSync}
          className="h-11"
        >
          <RefreshCcw className="h-4 w-4 mr-1" /> Sincronizar
        </Button>
      )}
      columns={[
        { key: 'plataforma', label: 'Plataforma', render: (item: SocialConta) => socialPlatformLabel(item.plataforma) },
        { key: 'nome_conta', label: 'Conta', mobilePrimary: true },
        { key: 'identificador_externo', label: 'ID Externo' },
        {
          key: 'status_conexao',
          label: 'Status',
          render: (item: SocialConta) => <Badge variant={item.status_conexao === 'conectado' ? 'default' : 'destructive'}>{item.status_conexao}</Badge>,
        },
        { key: 'ultima_sincronizacao', label: 'Última sincronização', mobileCard: true, render: (item: SocialConta) => (item.ultima_sincronizacao ? formatDate(item.ultima_sincronizacao) : '—') },
        {
          key: 'acoes',
          label: 'Ações',
          render: (item: SocialConta) => (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onSync(item.id)} disabled={!canSync} className="max-sm:h-11">Sincronizar</Button>
              <Button size="sm" variant="ghost" onClick={() => handleDisable(item.id, item.nome_conta)} disabled={!canManageAccounts} className="max-sm:h-11">Desativar</Button>
            </div>
          ),
        },
      ]}
    />
    {confirmDialog}
    </>
  );
}
