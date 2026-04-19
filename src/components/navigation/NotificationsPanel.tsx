import { useMemo, useState } from 'react';
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
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebarAlerts } from '@/hooks/useSidebarAlerts';
import { useNotificationDetails } from '@/hooks/useNotificationDetails';

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
  const [open, setOpen] = useState(false);

  // Counts always available (cached + realtime via singleton).
  const alerts = useSidebarAlerts();
  // Detailed lists only fetched while the panel is open.
  const { data: details, isLoading: detailsLoading } = useNotificationDetails(open);

  const loading = !alerts.lastUpdatedAt;

  const items = useMemo<NotificationItem[]>(() => {
    const dismissedRaw = typeof window !== 'undefined'
      ? localStorage.getItem('notifications_dismissed') || '{}'
      : '{}';
    let dismissed: Record<string, boolean> = {};
    try { dismissed = JSON.parse(dismissedRaw); } catch { dismissed = {}; }

    const list: NotificationItem[] = [
      {
        id: 'contas-vencidas',
        level: alerts.financeiroVencidos > 0 ? 'danger' : 'success',
        title: alerts.financeiroVencidos > 0 ? 'Contas vencidas no financeiro' : 'Financeiro sem vencimentos críticos',
        description:
          alerts.financeiroVencidos > 0
            ? `${alerts.financeiroVencidos} lançamento(s) exigem acompanhamento imediato.`
            : 'Nenhum lançamento vencido encontrado neste momento.',
        time: 'Agora',
      },
      {
        id: 'estoque-minimo',
        level: alerts.estoqueBaixo > 0 ? 'warning' : 'success',
        title: alerts.estoqueBaixo > 0 ? 'Produtos abaixo do estoque mínimo' : 'Estoque crítico controlado',
        description:
          alerts.estoqueBaixo > 0
            ? `${alerts.estoqueBaixo} item(ns) estão no limite ou abaixo do mínimo.`
            : 'Nenhum alerta de estoque mínimo no momento.',
        time: 'Agora',
      },
      ...((details?.topCriticalProducts || [])
        .filter((item) => !dismissed[`estoque-${item.id}`])
        .map((item) => ({
          id: `estoque-${item.id}`,
          level: 'warning' as const,
          title: item.nome,
          description: `Estoque: ${Number(item.estoque_atual || 0)} / Mínimo: ${Number(item.estoque_minimo || 0)}`,
          time: 'Estoque baixo',
        }))),
    ];

    if (details) {
      list.push(
        {
          id: 'compras-aguardando',
          level: details.comprasAguardandoCount > 0 ? 'info' : 'success',
          title: details.comprasAguardandoCount > 0 ? 'Compras aguardando entrega' : 'Nenhuma compra pendente de entrega',
          description:
            details.comprasAguardandoCount > 0
              ? `${details.comprasAguardandoCount} pedido(s) de compra estão aguardando chegada.`
              : 'Todas as compras confirmadas já foram recebidas ou concluídas.',
          time: 'Agora',
        },
        {
          id: 'ovs-faturamento',
          level: details.ovsAguardandoCount > 0 ? 'warning' : 'success',
          title: details.ovsAguardandoCount > 0 ? 'Pedidos aguardando faturamento' : 'Sem backlog de faturamento',
          description:
            details.ovsAguardandoCount > 0
              ? `${details.ovsAguardandoCount} pedido(s) aguardam faturamento total ou parcial.`
              : 'Nenhum pedido pendente de faturamento.',
          time: 'Agora',
        },
      );
    }

    return list;
  }, [alerts, details]);

  const unreadCount = useMemo(
    () => items.filter((item) => item.level === 'danger' || item.level === 'warning').length,
    [items],
  );

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

  const showDetailsLoader = open && detailsLoading && !details;

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
              {loading || showDetailsLoader ? (
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
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="px-4 py-3">
          <DropdownMenuLabel className="px-0 text-base">Notificações</DropdownMenuLabel>
          <p className="text-xs text-muted-foreground">Alertas operacionais e eventos recentes.</p>
        </div>
        <DropdownMenuSeparator />
        {loading || showDetailsLoader ? (
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
