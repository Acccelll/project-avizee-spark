-- Registra o modelo "Workbook de Fechamento" (layout do Financeiro_workbook
-- legado, preenchido pela RPC workbook_fechamento_dados). O arquivo é servido
-- de /public; o gerador é escolhido pelo código do template.
INSERT INTO public.workbook_templates (nome, codigo, versao, arquivo_path)
VALUES ('Workbook de Fechamento (modelo AviZee)', 'WB_FECHAMENTO_V1', '1.0', 'workbook_fechamento_v1.xlsx')
ON CONFLICT (codigo) DO NOTHING;
