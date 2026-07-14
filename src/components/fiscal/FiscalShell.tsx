import { Outlet } from "react-router-dom";
import { useNfeEntradaToast } from "@/hooks/useNfeEntradaToast";
import { useAutoCienciaDistDFe } from "@/hooks/useAutoCienciaDistDFe";
import { FiscalRuntimeProvider } from "@/contexts/FiscalRuntimeContext";
import { FiscalOfflineStrip } from "@/components/fiscal/FiscalOfflineStrip";
import { FiscalBreadcrumb } from "@/components/fiscal/FiscalBreadcrumb";

/**
 * Shell condicional do módulo Fiscal.
 *
 * Monta os hooks de domínio fiscal (toast de NF-e novas + auto-ciência DistDF-e)
 * apenas quando o usuário está dentro de uma rota `/fiscal/*`. Antes, esses
 * hooks rodavam no `AppLayout` para todos os usuários autenticados, gerando
 * queries Supabase desnecessárias para perfis sem permissão fiscal.
 *
 * O guard de permissão (`PermissionRoute resource="faturamento_fiscal"`) continua
 * em cada rota individual; este shell apenas escopa os efeitos colaterais.
 */
export function FiscalShell() {
  useNfeEntradaToast();
  useAutoCienciaDistDFe();
  return (
    <FiscalRuntimeProvider>
      <a
        href="#fiscal-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:px-3 focus:py-1 focus:text-sm focus:shadow"
      >
        Pular para o conteúdo fiscal
      </a>
      <FiscalOfflineStrip />
      <FiscalBreadcrumb />
      <main id="fiscal-main">
        <Outlet />
      </main>
    </FiscalRuntimeProvider>
  );
}

export default FiscalShell;
