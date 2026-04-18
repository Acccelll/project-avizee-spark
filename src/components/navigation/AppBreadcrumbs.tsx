import { Fragment, useMemo } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getRouteLabel, navSections } from '@/lib/navigation';

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
            return (
              <Fragment key={`${item.path}-${index}`}>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : siblings.length > 1 ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <BreadcrumbLink asChild>
                          <button type="button" className="hover:underline underline-offset-2">{item.label}</button>
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
                      <Link to={item.path}>{item.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!isLast && <BreadcrumbSeparator />}
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
      <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        Nível {items.length} de {Math.max(items.length, 3)}
      </span>
    </div>
  );
}
