
-- ============================================================
-- 0. ADD MISSING ENUM VALUES
-- ============================================================
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'vendedor';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'financeiro';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'estoquista';
