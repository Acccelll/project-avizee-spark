-- Add Dark Mode template for management presentation
INSERT INTO public.apresentacao_templates (nome, codigo, versao, descricao, config_json)
VALUES (
  'Apresentação Executiva Dark',
  'APRESENTACAO_DARK_V1',
  '1.0',
  'Template executivo com tons de cinza e azul marinho',
  '{
    "theme": {
      "colors": {
        "primary": "2C3E50",
        "secondary": "2980B9",
        "accent": "E74C3C",
        "background": "F4F7F6",
        "text": "2C3E50"
      }
    }
  }'
)
ON CONFLICT (codigo) DO NOTHING;
