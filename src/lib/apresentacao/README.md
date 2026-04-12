# Apresentação Gerencial - Guia de Templates

Este módulo permite a geração de apresentações PowerPoint (.pptx) baseadas em dados reais do ERP.

## Como adicionar um novo Template

### 1. Registro no Banco de Dados
Adicione um novo registro na tabela `apresentacao_templates`.

```sql
INSERT INTO apresentacao_templates (nome, codigo, versao, descricao, config_json)
VALUES (
  'Template Corporativo Dark',
  'TEMPLATE_DARK_V1',
  '1.0',
  'Versão com cores escuras e logo alternativo',
  '{
    "theme": {
      "colors": {
        "primary": "2C3E50",
        "secondary": "34495E",
        "background": "ECF0F1",
        "text": "2C3E50"
      }
    }
  }'
);
```

### 2. Esquema de Configuração (config_json)
O campo `config_json` suporta as seguintes chaves para customização visual:

- `theme`:
    - `colors`:
        - `primary`: Cor principal (Capa, Headlines, Linhas) em HEX (sem #).
        - `secondary`: Cor secundária (Gráficos, Subtítulos).
        - `accent`: Cor de destaque.
        - `background`: Cor de fundo dos slides.
        - `text`: Cor principal do texto.
    - `fonts`:
        - `body`: Fonte para corpo de texto.
        - `heading`: Fonte para títulos.

### 3. Customização de Código (Opcional)
Se o novo template exigir uma estrutura de slides diferente, você deve:
1. Adicionar as novas definições em `src/lib/apresentacao/slideDefinitions.ts`.
2. Implementar a lógica de renderização específica em `src/lib/apresentacao/generatePresentation.ts`, chaveando pelo `params.templateId` ou pelo `codigo` do template.
