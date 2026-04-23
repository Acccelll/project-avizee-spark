import { useEffect } from 'react';
import { ArrowUpRight, Building2, Lock, Palette, User } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ModulePage } from '@/components/ModulePage';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { MeuPerfilSection } from './configuracoes/sections/MeuPerfilSection';
import { AparenciaSection } from './configuracoes/sections/AparenciaSection';
import { SegurancaSection } from './configuracoes/sections/SegurancaSection';
import { EmpresaInfoSection } from './configuracoes/sections/EmpresaInfoSection';

/**
 * Configurações pessoais — orquestrador.
 *
 * Esta página coordena três seções de preferências do usuário, todas
 * extraídas em `src/pages/configuracoes/sections/*` com hooks dedicados em
 * `src/pages/configuracoes/hooks/*`. A escolha de aba é persistida em
 * `?tab=` para permitir deep-link e sobreviver a recarregamentos.
 */

interface TabNavItem {
  key: string;
  label: string;
  icon: typeof User;
}

const tabNavItems: TabNavItem[] = [
  { key: 'perfil', label: 'Meu Perfil', icon: User },
  { key: 'aparencia', label: 'Aparência', icon: Palette },
  { key: 'seguranca', label: 'Segurança', icon: Lock },
  { key: 'empresa', label: 'Empresa', icon: Building2 },
];

const TAB_TITLES: Record<string, string> = {
  perfil: 'Meu Perfil',
  aparencia: 'Aparência',
  seguranca: 'Segurança',
  empresa: 'Empresa',
};

export default function Configuracoes() {
  const { hasRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const isValidTab = (key: string | null): key is string =>
    !!key && tabNavItems.some((t) => t.key === key);
  const activeSection = isValidTab(tabFromUrl) ? tabFromUrl : 'perfil';
  const isAdmin = hasRole('admin');

  const setActiveSection = (key: string) => {
    const next = new URLSearchParams(searchParams);
    if (key === 'perfil') next.delete('tab');
    else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  // Fase 8: document.title dinâmico por aba ativa, para refletir o contexto
  // na aba do navegador e em históricos. Restaura o título genérico no unmount.
  useEffect(() => {
    const previous = document.title;
    document.title = `${TAB_TITLES[activeSection] ?? 'Configurações'} · ERP AviZee`;
    return () => {
      document.title = previous;
    };
  }, [activeSection]);

  const renderContent = () => {
    switch (activeSection) {
      case 'perfil':
        return <MeuPerfilSection />;
      case 'aparencia':
        return <AparenciaSection isAdmin={isAdmin} />;
      case 'seguranca':
        return <SegurancaSection />;
      case 'empresa':
        return <EmpresaInfoSection isAdmin={isAdmin} />;
      default:
        return null;
    }
  };

  return (
    <ModulePage title="Configurações" subtitle="Preferências pessoais da sua conta.">
      <Card className="mb-6 border-dashed bg-muted/30">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold">Escopo pessoal</p>
              <p className="text-sm text-muted-foreground">
                Esta página altera apenas dados do seu usuário (perfil, aparência e segurança). Configurações globais da empresa ficam na Administração.
              </p>
            </div>
            {isAdmin ? (
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link to="/administracao?tab=empresa">
                  <Building2 className="h-4 w-4" />
                  Ir para configurações globais
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <Badge variant="secondary" className="h-fit">Somente administradores alteram configurações globais</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      <div role="tablist" aria-label="Seções de Configurações" className="flex gap-0 border-b overflow-x-auto mb-6 -mt-1">
        {tabNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.key;
          return (
            <button
              key={item.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveSection(item.key)}
              className={cn(
                'flex shrink-0 items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div>{renderContent()}</div>
    </ModulePage>
  );
}
