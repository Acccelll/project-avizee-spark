import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/DataTable';
import { formatDate } from '@/lib/format';
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
  return (
    <DataTable
      data={contas}
      columns={[
        { key: 'plataforma', label: 'Plataforma', render: (item: SocialConta) => socialPlatformLabel(item.plataforma) },
        { key: 'nome_conta', label: 'Conta' },
        { key: 'identificador_externo', label: 'ID Externo' },
        {
          key: 'status_conexao',
          label: 'Status',
          render: (item: SocialConta) => <Badge variant={item.status_conexao === 'conectado' ? 'default' : 'destructive'}>{item.status_conexao}</Badge>,
        },
        { key: 'ultima_sincronizacao', label: 'Última sincronização', render: (item: SocialConta) => (item.ultima_sincronizacao ? formatDate(item.ultima_sincronizacao) : '—') },
        {
          key: 'acoes',
          label: 'Ações',
          render: (item: SocialConta) => (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => onSync(item.id)} disabled={!canSync}>Sincronizar</Button>
              <Button size="sm" variant="ghost" onClick={() => onDisable(item.id)} disabled={!canManageAccounts}>Desativar</Button>
            </div>
          ),
        },
      ]}
    />
  );
}
