import { useAuth } from "@/contexts/AuthContext";

/**
 * `useCanEditFinanceiroAvancado` — libera edição privilegiada de itens, valores
 * e formas de pagamento em **lançamentos financeiros** e **notas fiscais**
 * mesmo quando o status normalmente travaria a edição (pago, parcial,
 * confirmada, importada, autorizada SEFAZ).
 *
 * Concedido a quem tem papel `admin` OU `financeiro`. As travas seguem valendo
 * para os demais papéis. Toda edição privilegiada exige motivo (≥10 chars) e
 * fica registrada em `auditoria_logs` pelas RPCs `editar_*_admin`.
 */
export function useCanEditFinanceiroAvancado() {
  const { hasRole, loading, permissionsLoaded } = useAuth();
  const canEditAvancado = hasRole("admin") || hasRole("financeiro");
  return { canEditAvancado, loading: loading || !permissionsLoaded };
}