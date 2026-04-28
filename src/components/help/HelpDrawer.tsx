import { useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThumbsDown, ThumbsUp, Play, ArrowRight } from 'lucide-react';
import { resolveHelpEntry } from '@/help/registry';
import { useHelp } from '@/contexts/HelpContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Drawer lateral que renderiza a entry de ajuda da rota atual. Reage à URL
 * e apresenta seções, atalhos e botão de tour quando disponível.
 */
export function HelpDrawer() {
  const { drawerOpen, closeDrawer, startTour } = useHelp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const entry = resolveHelpEntry(pathname);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const sendFeedback = useCallback(
    async (helpful: boolean) => {
      setFeedback(helpful ? 'up' : 'down');
      if (!user?.id || !entry) return;
      const { error } = await supabase.from('help_feedback').insert({
        user_id: user.id,
        route: entry.route,
        helpful,
      });
      if (error) {
        toast.error('Não foi possível registrar seu feedback.');
        setFeedback(null);
        return;
      }
      toast.success(helpful ? 'Obrigado pelo retorno!' : 'Vamos melhorar essa página.');
    },
    [user?.id, entry],
  );

  return (
    <Sheet open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        {entry ? (
          <>
            <SheetHeader className="space-y-2">
              <Badge variant="secondary" className="w-fit">Manual da tela</Badge>
              <SheetTitle>{entry.title}</SheetTitle>
              <SheetDescription>{entry.summary}</SheetDescription>
            </SheetHeader>

            {entry.tour?.length ? (
              <div className="mt-4">
                <Button onClick={() => startTour(entry)} className="w-full gap-2">
                  <Play className="h-4 w-4" /> Iniciar tour guiado ({entry.tour.length} passos)
                </Button>
              </div>
            ) : null}

            <div className="mt-6 space-y-6">
              {entry.sections.map((section) => (
                <section key={section.heading} className="space-y-2">
                  <h3 className="text-sm font-semibold">{section.heading}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{section.body}</p>
                  {section.bullets?.length ? (
                    <ul className="ml-4 list-disc space-y-1 text-sm text-muted-foreground">
                      {section.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            {entry.shortcuts?.length ? (
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold">Atalhos</h3>
                <ul className="space-y-1.5">
                  {entry.shortcuts.map((s) => (
                    <li key={s.keys} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{s.desc}</span>
                      <kbd className="rounded border border-border bg-muted px-2 py-0.5 text-xs font-mono">
                        {s.keys}
                      </kbd>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {entry.related?.length ? (
              <div className="mt-6 space-y-2">
                <h3 className="text-sm font-semibold">Telas relacionadas</h3>
                <div className="flex flex-wrap gap-2">
                  {entry.related.map((r) => (
                    <Button
                      key={r.to}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        closeDrawer();
                        navigate(r.to);
                      }}
                      className="gap-1.5"
                    >
                      {r.label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-8 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-2">Esta página foi útil?</p>
              <div className="flex items-center gap-2">
                <Button
                  variant={feedback === 'up' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  disabled={feedback !== null}
                  onClick={() => sendFeedback(true)}
                >
                  <ThumbsUp className="h-4 w-4" /> Sim
                </Button>
                <Button
                  variant={feedback === 'down' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-1.5"
                  disabled={feedback !== null}
                  onClick={() => sendFeedback(false)}
                >
                  <ThumbsDown className="h-4 w-4" /> Não
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Ajuda em construção</SheetTitle>
              <SheetDescription>
                Ainda não há manual estruturado para esta tela. Você pode acessar a Central de ajuda
                para ver os manuais das telas já documentadas.
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <Button
                onClick={() => {
                  closeDrawer();
                  navigate('/ajuda');
                }}
                className="w-full"
              >
                Ir para a Central de ajuda
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}