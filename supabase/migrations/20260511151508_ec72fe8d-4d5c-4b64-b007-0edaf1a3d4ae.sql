CREATE OR REPLACE FUNCTION public.kpi_clientes_qualidade()
RETURNS TABLE(
  total_ativos integer,
  incompletos integer,
  sem_contato integer,
  sem_telefone integer,
  sem_email integer,
  sem_prazo integer,
  sem_grupo integer,
  com_grupo integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Replica getMissingFields() de src/pages/Clientes.tsx (sem o critério "grupo",
  -- que a UI também exclui do conceito de "incompleto"). Apenas agregados.
  SELECT
    COUNT(*)::int AS total_ativos,
    COUNT(*) FILTER (
      WHERE cpf_cnpj IS NULL OR TRIM(cpf_cnpj) = ''
         OR (celular IS NULL AND telefone IS NULL)
         OR email IS NULL OR TRIM(email) = ''
         OR prazo_padrao IS NULL OR prazo_padrao <= 0
         OR cidade IS NULL OR uf IS NULL
    )::int AS incompletos,
    COUNT(*) FILTER (
      WHERE celular IS NULL AND telefone IS NULL
        AND (email IS NULL OR TRIM(email) = '')
    )::int AS sem_contato,
    COUNT(*) FILTER (WHERE celular IS NULL AND telefone IS NULL)::int AS sem_telefone,
    COUNT(*) FILTER (WHERE email IS NULL OR TRIM(email) = '')::int AS sem_email,
    COUNT(*) FILTER (WHERE prazo_padrao IS NULL OR prazo_padrao <= 0)::int AS sem_prazo,
    COUNT(*) FILTER (WHERE grupo_economico_id IS NULL)::int AS sem_grupo,
    COUNT(*) FILTER (WHERE grupo_economico_id IS NOT NULL)::int AS com_grupo
  FROM public.clientes
  WHERE COALESCE(ativo, true) = true;
$$;

GRANT EXECUTE ON FUNCTION public.kpi_clientes_qualidade() TO authenticated;
COMMENT ON FUNCTION public.kpi_clientes_qualidade() IS
  'Retorna agregados globais de qualidade cadastral dos clientes ativos. Usado pelo KPI de /clientes para evitar leitura limitada à página corrente sob paginação server-side.';


CREATE OR REPLACE FUNCTION public.kpi_fornecedores_qualidade()
RETURNS TABLE(
  total_ativos integer,
  sem_contato integer,
  incompletos integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Replica SEM_CONTATO_OR e CADASTRO_INCOMPLETO_OR de src/pages/Fornecedores.tsx.
  SELECT
    COUNT(*)::int AS total_ativos,
    COUNT(*) FILTER (
      WHERE (email IS NULL OR TRIM(email) = '')
        AND (telefone IS NULL OR TRIM(telefone) = '')
        AND (celular IS NULL OR TRIM(celular) = '')
    )::int AS sem_contato,
    COUNT(*) FILTER (
      WHERE cpf_cnpj IS NULL OR TRIM(cpf_cnpj) = ''
         OR cidade IS NULL OR TRIM(cidade) = ''
         OR uf IS NULL OR TRIM(uf) = ''
    )::int AS incompletos
  FROM public.fornecedores
  WHERE ativo = true;
$$;

GRANT EXECUTE ON FUNCTION public.kpi_fornecedores_qualidade() TO authenticated;
COMMENT ON FUNCTION public.kpi_fornecedores_qualidade() IS
  'Retorna agregados globais de qualidade cadastral dos fornecedores ativos. Unifica as 3 queries separadas anteriormente em /fornecedores.';