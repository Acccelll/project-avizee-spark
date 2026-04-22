
CREATE TABLE public.relatorios_favoritos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  params TEXT NOT NULL,
  criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX relatorios_favoritos_user_nome_uniq
  ON public.relatorios_favoritos (user_id, lower(nome));

CREATE INDEX relatorios_favoritos_user_id_idx
  ON public.relatorios_favoritos (user_id);

ALTER TABLE public.relatorios_favoritos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê seus próprios favoritos"
  ON public.relatorios_favoritos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuário cria seus próprios favoritos"
  ON public.relatorios_favoritos
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário atualiza seus próprios favoritos"
  ON public.relatorios_favoritos
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuário remove seus próprios favoritos"
  ON public.relatorios_favoritos
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.tg_relatorios_favoritos_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_relatorios_favoritos_updated_at
BEFORE UPDATE ON public.relatorios_favoritos
FOR EACH ROW
EXECUTE FUNCTION public.tg_relatorios_favoritos_updated_at();
