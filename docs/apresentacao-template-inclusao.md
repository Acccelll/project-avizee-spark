# Plano de inclusão de templates — Apresentação Gerencial

## Objetivo
Permitir inclusão controlada de novos templates de apresentação sem romper a padronização visual e sem dependência de edição manual fora do ERP.

## Fluxo implementado (V1.1)
1. Usuário com permissão `apresentacao:criar` acessa a tela de Apresentação Gerencial.
2. Preenche metadados obrigatórios (`nome`, `codigo`, `versao`) e opcionais (`descricao`, arquivo `.pptx`).
3. Se houver arquivo, o sistema envia para `storage/dbavizee/templates/apresentacao`.
4. O sistema grava o registro em `apresentacao_templates` com `arquivo_path`, `config_json` e `ativo=true`.
5. O template passa a aparecer no seletor de geração para uso imediato.

## Regras de governança
- `codigo` deve ser único e estável (ex.: `APRESENTACAO_GERENCIAL_V2`).
- `versao` deve seguir versionamento semântico simples (`1.0`, `1.1`, `2.0`).
- Templates antigos podem ser desativados (`ativo=false`) sem apagar histórico de gerações.
- O histórico de geração sempre referencia `template_id`, mantendo rastreabilidade.

## Evolução planejada (V2)
- Validador de placeholders por template (compatibilidade com `slideDefinitions`).
- Workflow de aprovação de template (rascunho -> homologado -> ativo).
- Catálogo com visualização de diff de configuração (`config_json`).
- Política de retenção/versionamento de arquivos no storage.
