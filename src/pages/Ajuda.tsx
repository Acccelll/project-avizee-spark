import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, BookOpen, Play } from 'lucide-react';
import { listHelpEntries } from '@/help/registry';
import { useHelp } from '@/contexts/HelpContext';

/**
 * Central de ajuda — índice navegável de todos os manuais cadastrados, com
 * busca por título/resumo e atalho para iniciar o tour da tela.
 */
export default function Ajuda() {
  const [query, setQuery] = useState('');
  const { startTour } = useHelp();
  const entries = useMemo(() => listHelpEntries(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    const scored = entries
      .map((e) => {
        const titleHit = e.title.toLowerCase().includes(q);
        const summaryHit = e.summary.toLowerCase().includes(q);
        const sectionHits = e.sections.filter(
          (s) => s.heading.toLowerCase().includes(q) || s.body.toLowerCase().includes(q),
        ).length;
        if (!titleHit && !summaryHit && sectionHits === 0) return null;
        const score = (titleHit ? 10 : 0) + (summaryHit ? 5 : 0) + sectionHits;
        return { entry: e, score };
      })
      .filter((x): x is { entry: typeof entries[number]; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);
    return scored.map((s) => s.entry);
  }, [entries, query]);

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Central de ajuda</h1>
        <p className="text-sm text-muted-foreground">
          Manuais e tours guiados das telas do ERP. O conteúdo é incremental — novas telas serão adicionadas ao longo do tempo.
        </p>
      </header>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar tela, recurso, atalho…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum manual encontrado para "{query}".</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => (
            <Card key={entry.route}>
              <CardHeader className="space-y-1.5 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{entry.title}</CardTitle>
                  {entry.tour?.length ? (
                    <Badge variant="secondary" className="shrink-0">
                      {entry.tour.length} passos
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{entry.summary}</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0 sm:flex-row sm:items-center">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="gap-1.5 max-sm:h-11 max-sm:w-full sm:flex-1"
                >
                  <Link to={entry.route}>
                    <BookOpen className="h-4 w-4" /> Abrir tela
                  </Link>
                </Button>
                {entry.tour?.length ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 max-sm:h-11 max-sm:w-full sm:flex-1"
                    onClick={() => startTour(entry)}
                  >
                    <Play className="h-4 w-4" /> Tour ({entry.tour.length} passos)
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}