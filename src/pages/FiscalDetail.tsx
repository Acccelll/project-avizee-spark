/**
 * @deprecated Página descontinuada na Onda 7 (decisão D-2).
 * Substituída pelo `NotaFiscalDrawer` disparado a partir do grid em `/fiscal`.
 * Mantemos um redirect permanente para preservar links externos:
 *   /fiscal/:id → /fiscal?nf=:id (abre o drawer automaticamente).
 */
import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { logger } from "@/lib/logger";

export default function FiscalDetail() {
  const { id } = useParams<{ id: string }>();
  useEffect(() => {
    try { logger.info("[deprecated] /fiscal/:id → redirect para /fiscal?nf=", id); } catch { /* noop */ }
  }, [id]);
  return <Navigate to={id ? `/fiscal?nf=${id}` : "/fiscal"} replace />;
}
