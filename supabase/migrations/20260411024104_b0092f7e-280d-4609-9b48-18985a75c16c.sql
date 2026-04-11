ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS forma_pagamento_padrao text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS prazo_preferencial integer DEFAULT NULL;