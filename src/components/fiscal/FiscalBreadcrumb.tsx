import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight } from "lucide-react";

/**
 * Etapa 15 — Breadcrumb acessível do módulo Fiscal.
 *
 * Deriva a trilha a partir de `location.pathname` (segmentos após `/fiscal`).
 * Não introduz estado próprio nem depende do runtime — puro helper de UX/a11y
 * do shell fiscal.
 */
const LABELS: Record<string, string> = {
  fiscal: "Fiscal",
  central: "Central",
  dashboard: "Dashboard",
  "distdfe-historico": "Histórico DF-e",
  emissao: "Emissão",
  recebimento: "Recebimento",
  configuracoes: "Configurações",
};

function labelFor(segment: string): string {
  return LABELS[segment] ?? segment.replace(/-/g, " ");
}

export function FiscalBreadcrumb() {
  const { pathname } = useLocation();
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== "fiscal" || segments.length <= 1) return null;

  const crumbs = segments.map((seg, idx) => ({
    label: labelFor(seg),
    href: "/" + segments.slice(0, idx + 1).join("/"),
    last: idx === segments.length - 1,
  }));

  return (
    <nav
      aria-label="Trilha de navegação fiscal"
      className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground"
    >
      <ol className="flex flex-wrap items-center gap-1">
        {crumbs.map((c) => (
          <Fragment key={c.href}>
            <li>
              {c.last ? (
                <span aria-current="page" className="font-medium text-foreground">
                  {c.label}
                </span>
              ) : (
                <Link to={c.href} className="hover:text-foreground hover:underline">
                  {c.label}
                </Link>
              )}
            </li>
            {!c.last && <ChevronRight aria-hidden className="h-3 w-3" />}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

export default FiscalBreadcrumb;