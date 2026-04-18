import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PageShellProps {
  /** Título principal da página */
  title: ReactNode;
  /** Subtítulo / descrição curta */
  subtitle?: ReactNode;
  /** Caminho ou função para o botão "voltar". Se omitido, esconde o botão. */
  backTo?: string | (() => void);
  /** Ações principais alinhadas à direita do header. */
  actions?: ReactNode;
  /** Conteúdo adicional logo abaixo do header (banners, contexto, badges). */
  meta?: ReactNode;
  /** Conteúdo da página */
  children: ReactNode;
  /** Largura máxima do conteúdo. `default` segue o `<main>` global. */
  maxWidth?: 'default' | '5xl' | '3xl';
  /** Aplica classe extra ao wrapper externo. */
  className?: string;
}

/**
 * PageShell — header padronizado para páginas de detalhe/formulário.
 *
 * Responsabilidades:
 *  - botão "voltar" + título + subtítulo + ações em uma linha
 *  - área `meta` opcional (banners de contexto, status, atalhos)
 *  - largura controlada apenas por `maxWidth` (sem padding próprio — quem cuida
 *    do padding e da largura máxima global é o `<main>` do `AppLayout`).
 *
 * Não substitui `ModulePage` (cadastros simples) nem `ListPageHeader`
 * (listagens operacionais). É voltado para telas de detalhe/edição.
 */
export function PageShell({
  title,
  subtitle,
  backTo,
  actions,
  meta,
  children,
  maxWidth = 'default',
  className,
}: PageShellProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (typeof backTo === 'function') backTo();
    else if (typeof backTo === 'string') navigate(backTo);
    else navigate(-1);
  };

  const widthClass =
    maxWidth === '5xl' ? 'max-w-5xl' : maxWidth === '3xl' ? 'max-w-3xl' : '';

  return (
    <div className={cn('space-y-5', widthClass, className)}>
      <header className="flex flex-col gap-3 border-b border-border/50 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          {backTo !== undefined && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              aria-label="Voltar"
              className="h-8 shrink-0 gap-1 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Voltar</span>
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="page-title text-lg md:text-xl truncate">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </header>
      {meta}
      {children}
    </div>
  );
}
