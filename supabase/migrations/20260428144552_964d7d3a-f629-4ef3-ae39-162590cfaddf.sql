
ALTER TABLE public.clientes ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.fornecedores ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
ALTER TABLE public.produtos ALTER COLUMN empresa_id SET DEFAULT public.current_empresa_id();
