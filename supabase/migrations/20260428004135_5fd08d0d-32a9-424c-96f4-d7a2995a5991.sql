-- Tabela de backup para reconciliação financeira contra planilha 2026-16
CREATE TABLE IF NOT EXISTS public.financeiro_lancamentos_backup_20260428 (
  LIKE public.financeiro_lancamentos INCLUDING ALL
);
ALTER TABLE public.financeiro_lancamentos_backup_20260428 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "backup_admin_select" ON public.financeiro_lancamentos_backup_20260428;
CREATE POLICY "backup_admin_select" ON public.financeiro_lancamentos_backup_20260428
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));