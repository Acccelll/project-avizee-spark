interface GreetingBannerProps {
  nome?: string;
  vencimentosHoje: { receber: number; pagar: number };
  backlogOVsCount: number;
  onNavigateVencimentos: () => void;
  onNavigateBacklog: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatVencimentosHoje(receber: number, pagar: number): string {
  if (receber === 0 && pagar === 0) return 'Sem vencimentos para hoje.';
  const partes: string[] = [];
  if (receber > 0) partes.push(`${receber} recebimento${receber > 1 ? 's' : ''}`);
  if (pagar > 0) partes.push(`${pagar} pagamento${pagar > 1 ? 's' : ''}`);
  return `Você tem ${partes.join(' e ')} vencendo hoje.`;
}

/** Saudação + atalhos para vencimentos do dia e backlog comercial. */
export function GreetingBanner({
  nome,
  vencimentosHoje,
  backlogOVsCount,
  onNavigateVencimentos,
  onNavigateBacklog,
}: GreetingBannerProps) {
  const greeting = getGreeting();
  const temVencimentos = vencimentosHoje.receber > 0 || vencimentosHoje.pagar > 0;
  const temBacklog = backlogOVsCount > 0;
  const temAlgo = temVencimentos || temBacklog;

  return (
    <div className="mb-3 rounded-lg border border-border/60 bg-muted/10 px-4 py-2.5 md:mb-4 md:py-3">
      <p className="text-sm font-medium text-foreground">
        {greeting}, {nome?.split(' ')[0] || 'time'}.
      </p>
      {temAlgo && (
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          {temVencimentos && (
            <button
              type="button"
              onClick={onNavigateVencimentos}
              className="text-left transition-colors hover:text-primary hover:underline active:text-primary"
            >
              {formatVencimentosHoje(vencimentosHoje.receber, vencimentosHoje.pagar)}
            </button>
          )}
          {temBacklog && (
            <>
              {temVencimentos && ' · '}
              <button
                type="button"
                onClick={onNavigateBacklog}
                className="text-left transition-colors hover:text-primary hover:underline active:text-primary"
              >
                {backlogOVsCount} pedido{backlogOVsCount > 1 ? 's' : ''} aguardando faturamento.
              </button>
            </>
          )}
        </p>
      )}
    </div>
  );
}
