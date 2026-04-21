DELETE FROM clientes c
USING clientes c2
WHERE c.codigo_legado IS NOT NULL
  AND c.codigo_legado = c2.codigo_legado
  AND c.ctid > c2.ctid;

DELETE FROM clientes c
USING clientes c2
WHERE c.cpf_cnpj IS NOT NULL
  AND c.cpf_cnpj = c2.cpf_cnpj
  AND c.ctid > c2.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_grupos_produto_nome ON public.grupos_produto (nome);
CREATE UNIQUE INDEX IF NOT EXISTS uq_produtos_codigo_legado ON public.produtos (codigo_legado) WHERE codigo_legado IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_codigo_legado ON public.clientes (codigo_legado) WHERE codigo_legado IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_cpf_cnpj ON public.clientes (cpf_cnpj) WHERE cpf_cnpj IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_notas_fiscais_chave_acesso ON public.notas_fiscais (chave_acesso) WHERE chave_acesso IS NOT NULL;