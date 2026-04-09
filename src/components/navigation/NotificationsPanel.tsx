import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Info, XCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';

interface NotificationItem {
  id: string;
  level: 'success' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  time: string;
}

const iconByLevel = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

const colorByLevel = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
};

export function NotificationsPanel() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      setLoading(true);
      try {
        const [
          { data: vencidas },
          { data: estoque },
          { data: comprasAguardando },
          { data: ovsAguardando },
        ] = await Promise.all([
          supabase
            .from('financeiro_lancamentos')
            .select('id')
            .eq('status', 'vencido')
            .eq('ativo', true),
          supabase
            .from('produtos')
            .select('id, nome, estoque_atual, estoque_minimo')
            .eq('ativo', true)
            .gt('estoque_minimo', 0),
          supabase
            .from('pedidos_compra')
            .select('id')
            .eq('ativo', true)
            .in('status', ['aprovado', 'enviado_ao_fornecedor', 'aguardando_recebimento', 'parcialmente_recebido'])
            .is('data_entrega_real', null),
          supabase
            .from('ordens_venda')
            .select('id')
            .eq('ativo', true)
            .in('status', ['aprovada', 'em_separacao'])
            .in('status_faturamento', ['aguardando', 'parcial']),
        ]);

        const estoqueCritico = (estoque || []).filter((item: any) => Number(item.estoque_atual || 0) <= Number(item.estoque_minimo || 0));

        // Read dismissed alerts from localStorage
        const dismissedRaw = localStorage.getItem('notifications_dismissed') || '{}';
        let dismissed: Record<string, boolean> = {};
        try { dismissed = JSON.parse(dismissedRaw); } catch { dismissed = {}; }

        const nextItems: NotificationItem[] = [
          {
            id: 'contas-vencidas',
            level: (vencidas || []).length > 0 ? 'danger' : 'success',
            title: (vencidas || []).length > 0 ? 'Contas vencidas no financeiro' : 'Financeiro sem vencimentos críticos',
            description:
              (vencidas || []).length > 0
                ? `${(vencidas || []).length} lançamento(s) exigem acompanhamento imediato.`
                : 'Nenhum lançamento vencido encontrado neste momento.',
            time: 'Agora',
          },
          {
            id: 'estoque-minimo',
            level: estoqueCritico.length > 0 ? 'warning' : 'success',
            title: estoqueCritico.length > 0 ? 'Produtos abaixo do estoque mínimo' : 'Estoque crítico controlado',
            description:
              estoqueCritico.length > 0
                ? `${estoqueCritico.length} item(ns) estão no limite ou abaixo do mínimo.`
                : 'Nenhum alerta de estoque mínimo no momento.',
            time: 'Agora',
          },
          // Per-product stock alerts
          ...estoqueCritico.slice(0, 5).filter((item: any) => !dismissed[`estoque-${item.id}`]).map((item: any) => ({
            id: `estoque-${item.id}`,
            level: 'warning' as const,
            title: `${item.nome}`,
            description: `Estoque: ${Number(item.estoque_atual || 0)} / Mínimo: ${Number(item.estoque_minimo || 0)}`,
            time: 'Estoque baixo',
          })),
          {
            id: 'compras-aguardando',
            level: (comprasAguardando || []).length > 0 ? 'info' : 'success',
            title: (comprasAguardando || []).length > 0 ? 'Compras aguardando entrega' : 'Nenhuma compra pendente de entrega',
            description:
              (comprasAguardando || []).length > 0
                ? `${(comprasAguardando || []).length} pedido(s) de compra estão aguardando chegada.`
                : 'Todas as compras confirmadas já foram recebidas ou concluídas.',
            time: 'Agora',
          },
          {
            id: 'ovs-faturamento',
            level: (ovsAguardando || []).length > 0 ? 'warning' : 'success',
            title: (ovsAguardando || []).length > 0 ? 'Pedidos aguardando faturamento' : 'Sem backlog de faturamento',
            description:
              (ovsAguardando || []).length > 0
                ? `${(ovsAguardando || []).length} pedido(s) aguardam faturamento total ou parcial.`
                : 'Nenhum pedido pendente de faturamento.',
            time: 'Agora',
          },
        ];

        if (mounted) setItems(nextItems);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadNotifications();

    // Realtime subscription for financial changes
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'financeiro_lancamentos' },
        () => { loadNotifications(); }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const unreadCount = useMemo(() => items.filter((item) => item.level === 'danger' || item.level === 'warning').length, [items]);

  const trigger = (
    <Button
      variant="outline"
      size="icon"
      className="relative h-10 w-10 rounded-full"
      aria-label={`Abrir notificações${loading ? "" : `. ${unreadCount} alerta(s) prioritário(s)`}`}
      title="Notificações"
    >
      <Bell className="h-4 w-4" />
      <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white" aria-hidden="true">
        {loading ? '…' : unreadCount}
      </span>
    </Button>
  );

  if (isMobile) {
    return (
      <>
        <div onClick={() => setOpen(true)}>{trigger}</div>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[78vh] rounded-t-[20px] md:hidden">
            <DrawerHeader className="text-left">
              <div className="flex items-center justify-between gap-2">
                <DrawerTitle>Notificações</DrawerTitle>
                <DrawerClose asChild>
                  <button
                    type="button"
                    className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Fechar notificações"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </DrawerClose>
              </div>
              <DrawerDescription>Alertas operacionais e eventos recentes.</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-10">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando alertas...
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((notification) => {
                    const Icon = iconByLevel[notification.level] || Info;
                    return (
                      <div key={notification.id} className="rounded-2xl border bg-card/70 p-4">
                        <div className="mb-2 flex items-start gap-3">
                          <div className={`rounded-full bg-muted p-2 ${colorByLevel[notification.level] || ''}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold leading-tight">{notification.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{notification.description}</p>
                          </div>
                          <span className="text-[11px] text-muted-foreground">{notification.time}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="px-4 py-3">
          <DropdownMenuLabel className="px-0 text-base">Notificações</DropdownMenuLabel>
          <p className="text-xs text-muted-foreground">Alertas operacionais e eventos recentes.</p>
        </div>
        <DropdownMenuSeparator />
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando alertas...
          </div>
        ) : (
          items.map((notification) => {
            const Icon = iconByLevel[notification.level] || Info;
            return (
              <DropdownMenuItem key={notification.id} className="items-start gap-3 px-4 py-3">
                <div className={`mt-0.5 rounded-full bg-muted p-2 ${colorByLevel[notification.level] || ''}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium leading-tight">{notification.title}</p>
                  <p className="text-xs text-muted-foreground">{notification.description}</p>
                </div>
                <span className="text-[11px] text-muted-foreground">{notification.time}</span>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
