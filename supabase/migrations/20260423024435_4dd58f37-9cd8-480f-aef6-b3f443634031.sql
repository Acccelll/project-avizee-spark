-- Phase 10: Roles gestor_compras e operador_logistico
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_compras';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'operador_logistico';