
# Plano de Execução: Módulo Fiscal Completo

## 1. Fix build error (`useGerarPedidoCompra.ts`)
Renomear `valor_unitario → preco_unitario` e `valor_total → subtotal` na inserção de `pedidos_compra_itens`.

## 2. Migration SQL — Expandir schema fiscal

**Expandir `notas_fiscais`** com ~25 colunas: `natureza_operacao`, `finalidade_nfe`, `ambiente_emissao`, `status_sefaz`, `protocolo_autorizacao`, `recibo`, `motivo_rejeicao`, `xml_gerado`, `pdf_gerado`, `caminho_xml`, `caminho_pdf`, `enviado_email`, `valor_produtos`, `valor_seguro`, `peso_bruto`, `peso_liquido`, `quantidade_volumes`, `especie_volumes`, `marca_volumes`, `numeracao_volumes`, `frete_modalidade`, `transportadora_id`, `origem`, `data_saida_entrada`, `usuario_criacao_id`, `usuario_ultima_modificacao_id`.

**Expandir `notas_fiscais_itens`** com: `codigo_produto`, `cest`, `origem_mercadoria`, `csosn`, `cst_pis`, `cst_cofins`, `cst_ipi`, `unidade_tributavel`, `desconto`, `frete_rateado`, `seguro_rateado`, `outras_despesas_rateadas`, `base_st`, `valor_st`, `base_ipi`, `base_pis`, `base_cofins`, `observacoes`.

**Criar `nota_fiscal_eventos`**: id, nota_fiscal_id, tipo_evento, status_anterior, status_novo, descricao, payload_resumido (jsonb), data_evento, usuario_id. RLS: select/insert authenticated.

**Criar `nota_fiscal_anexos`**: id, nota_fiscal_id, tipo_arquivo, nome_arquivo, caminho_storage, tamanho, created_at. RLS: select/insert/delete authenticated.

**Expandir `empresa_config`**: crt, cnae, regime_tributario, codigo_ibge_municipio, email_fiscal, serie_padrao_nfe, proximo_numero_nfe, ambiente_padrao.

**Expandir `produtos`**: gtin, cest, origem_mercadoria, unidade_tributavel, peso_bruto, peso_liquido.

## 3. Refatorar `fiscal.service.ts`
- Adicionar função `registrarEventoFiscal()` usada por todas as ações
- Idempotência: verificar `status !== 'confirmada'` antes de confirmar; verificar duplicidade por chave_acesso na importação
- Separar status operacional e status_sefaz
- Upload/download de XML/PDF via Storage bucket `dbavizee`

## 4. Expandir UI Fiscal
- **Fiscal.tsx**: adicionar colunas origem, status_sefaz; filtros por origem e status_sefaz
- **NotaFiscalDrawer**: nova aba "Eventos" com timeline da `nota_fiscal_eventos`; aba "Arquivos" com lista de anexos e download
- **NotaFiscalEditModal**: campos de natureza_operacao, ambiente, transportadora, volumes, peso
- **ConfiguracaoFiscal.tsx**: campos CRT, CNAE, série padrão, próximo número, ambiente

## 5. Dashboard e Relatórios
- Expandir `FiscalBlock` com "pedidos sem faturamento" e "notas rejeitadas"
- Adicionar template de relatório fiscal em `relatoriosConfig.ts`
