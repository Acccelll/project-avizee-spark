-- Workbook de Fechamento, modelo v2: 12 abas com a identidade da AviZee,
-- preenchidas com os dados da apresentação (apresentacao_fechamento_dados).
-- O arquivo é servido de /public; o gerador é escolhido pelo código.
-- O modelo v1 sai da lista (as gerações antigas continuam no histórico).
INSERT INTO public.workbook_templates (nome, codigo, versao, arquivo_path, ativo)
VALUES ('Workbook de Fechamento', 'WB_FECHAMENTO_V2', '2.0', 'workbook_fechamento_v2.xlsx', true)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, versao = EXCLUDED.versao, arquivo_path = EXCLUDED.arquivo_path, ativo = true;

UPDATE public.workbook_templates SET ativo = false WHERE codigo = 'WB_FECHAMENTO_V1';
