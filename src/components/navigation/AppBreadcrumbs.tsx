import { Fragment, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getRouteLabel, headerIcons, navSections } from '@/lib/navigation';

/**
 * Mapping of `?tab=` values used by the Administração page to the human label
 * shown in the breadcrumb. Keep in sync with the keys defined in
 * `src/pages/Administracao.tsx` (`VALID_SECTION_KEYS`).
 */
const adminTabs: Record<string, string> = {
  empresa: 'Empresa',
  dashboard: 'Visão Geral',
  usuarios: 'Usuários e Permissões',
  email: 'E-mails',
  fiscal: 'Parâmetros Fiscais',
  financeiro: 'Parâmetros Financeiros',
  auditoria: 'Auditoria',
  migracao: 'Migração de Dados',
};

const reportTabs: Record<string, string> = {
  estoque: 'Relatório de Estoque',
  financeiro: 'Relatório Financeiro',
  fluxo_caixa: 'Fluxo de Caixa',
  vendas: 'Relatório de Vendas',
  compras: 'Compras por Fornecedor',
};

export function resolvePageTitle(pathname: string, searchParams: URLSearchParams) {
  if (pathname === '/administracao') {
    const tab = searchParams.get('tab');
    if (tab && adminTabs[tab]) return adminTabs[tab];
  }

  if (pathname === '/relatorios') {
    const tipo = searchParams.get('tipo');
    if (tipo && reportTabs[tipo]) return reportTabs[tipo];
  }

  if (pathname === '/financeiro') {
    const tipo = searchParams.get('tipo');
    if (tipo === 'pagar') return 'Contas a Pagar';
    if (tipo === 'receber') return 'Contas a Receber';
  }

  return getRouteLabel(pathname);
}

export function AppBreadcrumbs() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const siblingMap = useMemo(() => {
    const map: Record<string, { label: string; path: string }[]> = { '/': [{ label: 'Dashboard', path: '/' }] };
    for (const section of navSections) {
      const items = section.items.flatMap((group) => group.items);
      const siblingItems = items.map((x) => ({ label: x.title, path: x.path }));
      for (const item of items) {
        map[item.path.split('?')[0]] = siblingItems;
      }
    }
    return map;
  }, []);

  const items = useMemo(() => {
    const pathname = location.pathname;
    const base = [{ label: 'Dashboard', path: '/' }];

    if (pathname === '/') return base;

    const segments = pathname.split('/').filter(Boolean);
    let currentPath = '';
    for (const segment of segments) {
      currentPath += `/${segment}`;
      base.push({ label: getRouteLabel(currentPath), path: currentPath });
    }

    const contextualLabel = resolvePageTitle(pathname, searchParams);
    const lastItem = base[base.length - 1];
    if (!lastItem || lastItem.label !== contextualLabel) {
      base.push({ label: contextualLabel, path: location.pathname + location.search });
    }

    return base;
  }, [location.pathname, location.search, searchParams]);

  return (
    <div className="flex items-center gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const siblings = siblingMap[item.path.split('?')[0]] || [];
            const Icon = headerIcons[item.path.split('?')[0]];
            // Show icon only on the second item (the module) for visual anchoring
            const showIcon = index === 1 && Icon;
            return (
              <Fragment key={`${item.path}-${index}`}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="flex items-center gap-1.5 font-medium text-foreground">
                      {showIcon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                      {item.label}
                    </BreadcrumbPage>
                  ) : siblings.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <BreadcrumbLink asChild>
                          <button type="button" className="flex items-center gap-1.5 hover:underline underline-offset-2">
                            {showIcon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                            {item.label}
                          </button>
                        </BreadcrumbLink>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {siblings.map((sibling) => (
                          <DropdownMenuItem key={sibling.path} asChild>
                            <Link to={sibling.path}>{sibling.label}</Link>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link to={item.path} className="flex items-center gap-1.5">
                        {showIcon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden />
                )}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
