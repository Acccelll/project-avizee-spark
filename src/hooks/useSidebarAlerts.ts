import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SidebarAlerts {
  financeiroVencidos: number;
  financeiroVencer: number;
  estoqueBaixo: number;
  orcamentosPendentes: number;
  lastUpdatedAt?: string;
}

export function useSidebarAlerts() {
  const [alerts, setAlerts] = useState<SidebarAlerts>({
    financeiroVencidos: 0,
    financeiroVencer: 0,
    estoqueBaixo: 0,
    orcamentosPendentes: 0,
    lastUpdatedAt: undefined,
  });

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const today = now.toISOString().slice(0, 10);
        const plus3 = new Date(now);
        plus3.setDate(now.getDate() + 3);
        const dueSoon = plus3.toISOString().slice(0, 10);

        const [{ count: vencidos }, { count: vencer }, { data: baixoData }, { count: orcPendentes }] = await Promise.all([
          supabase
            .from('financeiro_lancamentos')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true)
            .in('status', ['aberto', 'vencido'])
            .lt('data_vencimento', today),
          supabase
            .from('financeiro_lancamentos')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true)
            .eq('status', 'aberto')
            .gte('data_vencimento', today)
            .lte('data_vencimento', dueSoon),
          supabase
            .from('produtos')
            .select('id, estoque_atual, estoque_minimo')
            .eq('ativo', true)
            .gt('estoque_minimo', 0),
          supabase
            .from('orcamentos')
            .select('*', { count: 'exact', head: true })
            .eq('ativo', true)
            .in('status', ['pendente', 'aguardando_aprovacao', 'em_analise'] as any),
        ]);

        const baixoCount = (baixoData || []).filter((p: any) => (p.estoque_atual || 0) <= p.estoque_minimo).length;

        setAlerts({
          financeiroVencidos: vencidos || 0,
          financeiroVencer: vencer || 0,
          estoqueBaixo: baixoCount,
          orcamentosPendentes: orcPendentes || 0,
          lastUpdatedAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error('[sidebar-alerts] Error loading alerts:', err);
      }
    };

    load();

    const channel = supabase
      .channel('sidebar-alerts-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'financeiro_lancamentos' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, load)
      .subscribe();

    const interval = setInterval(load, 90 * 1000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  return alerts;
}
