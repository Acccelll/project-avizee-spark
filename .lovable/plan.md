# Faturamento estilo Emissor Sebrae — plano de construção

Adoto o Emissor Sebrae como referência de **escopo funcional, vocabulário e fluxo de telas**, mas implemento dentro do nosso ERP (React + Supabase + sefaz-proxy já existentes). Não vamos clonar a UI: vamos cobrir as mesmas capacidades, reaproveitando o que já temos (cadastros de produtos/clientes/fornecedores, RBAC, certificado A1 no Vault, builder XML 4.00, autorização SEFAZ).

## 1. Mapa de paridade Sebrae × ERP atual

```text
Capítulo Sebrae                 │ Estado no ERP        │ Ação
────────────────────────────────┼──────────────────────┼──────────────────────
Cadastro de Emitente            │ empresa_config OK    │ Endurecer validação + wizard
Configuração Fiscal (CRT, amb)  │ Parcial              │ Aba dedicada "Faturamento"
Certificado A1/A3               │ A1 via Vault OK      │ UI upload + validade + alerta
Cadastro de Produtos/NCM/CST    │ produtos OK          │ Aba Fiscal por produto + grade
Cadastro de Serviços (NFS-e)    │ Inexistente          │ Fora do MVP — fase 2
Cadastro de Clientes/Forn.      │ OK                   │ Adicionar IBGE município + IE
Transportadoras                 │ Inexistente          │ Nova entidade transportadoras
Matriz Fiscal (regras CST/CFOP) │ Inexistente          │ Tabela matriz_fiscal + RPC
Natureza de Operação            │ Campo livre          │ Tabela naturezas_operacao
Permissões (perfis fiscais)     │ user_permissions OK  │ Adicionar recursos fiscais
Emissão NF-e (saída/entrada)    │ Backend OK, UX fraca │ Wizard 5 passos + rascunho
Carta de Correção (CC-e)        │ Inexistente          │ Serviço + UI
Cancelamento NF-e               │ OK                   │ Manter
Inutilização de numeração       │ Serviço OK, sem UI   │ Drawer dedicado
NF-e devolução / complementar   │ Inexistente          │ Modelos pré-preenchidos
Manifestação destinatário (MDe) │ Inexistente          │ Fase 2
NFC-e / CT-e / NFS-e / MDF-e    │ Tela vazia/parcial   │ Fora do MVP
Consulta de documentos          │ Lista NF OK          │ Filtros avançados + ações
Importar XML emitido fora       │ OK                   │ Manter
Exportar XMLs em lote           │ Inexistente          │ Gerar ZIP do período
Status do serviço SEFAZ         │ Health parcial       │ Widget na tela Faturamento
Relatórios fiscais              │ Inexistente          │ Livro Saídas/Entradas + SPED
Rejeições com soluções          │ Toast genérico       │ Catálogo de cStat + ajuda
```

## 2. Arquitetura nova: módulo `/faturamento`

Rota dedicada (separada de `/fiscal`, que vira tela técnica de auditoria de NFs). Layout em 4 abas seguindo o Sebrae:

```text
/faturamento
├─ Painel        → KPIs (autorizadas hoje, rejeitadas, status SEFAZ, certificado)
├─ Emitir        → Wizard NF-e + atalhos (saída/devolução/complementar/remessa)
├─ Backlog       → OVs aprovadas aguardando faturamento + ação "Faturar"
└─ Documentos    → Lista NFs com filtros, ações em lote, exportar XML/DANFE
```

## 3. Wizard "Emitir NF-e" (5 passos, igual ao Sebrae)

```text
Passo 1 — Identificação
  • Tipo (saída/entrada), finalidade (normal/complementar/ajuste/devolução)
  • Natureza da operação (autocomplete da tabela naturezas_operacao)
  • Série, próximo número (auto via SEQUENCE), data emissão/saída

Passo 2 — Destinatário
  • Buscar cliente/fornecedor existente OU cadastrar inline
  • Validação: CPF/CNPJ + IE + UF + IBGE município (bloqueia avanço)
  • indIEDest calculado automaticamente

Passo 3 — Itens
  • Adicionar produto (autocomplete por código/descrição)
  • Aplica matriz fiscal: CFOP por UF emit×UF dest, CST/CSOSN por CRT,
    NCM, alíquotas ICMS/IPI/PIS/COFINS calculadas
  • Permite override por linha (com aviso "fora da matriz")
  • Totalizador em tempo real

Passo 4 — Transporte e pagamento
  • Modalidade do frete (0-9), transportadora (autocomplete),
    placa, volumes, peso bruto/líquido
  • Forma de pagamento (mapeada para tpag SEFAZ) + parcelas (duplicatas)
  • Informações complementares (texto livre + tags %DUPLICATAS%)

Passo 5 — Revisão e transmissão
  • Pré-validação local (preEmissao.validator + ncm + cfop)
  • Painel "o que será enviado" com totais e tributos
  • Botões: [Salvar rascunho] [Transmitir SEFAZ] [Transmitir e baixar DANFE]
```

Cada passo é um componente isolado; rascunho persiste em `notas_fiscais` com `status='rascunho'` (autosave 5s).

## 4. Novidades funcionais (estilo Sebrae)

### 4.1 Matriz Fiscal
Tabela `matriz_fiscal` (escopo: CRT × UF origem × UF destino × tipo operação) com CST/CSOSN, alíquota ICMS, redução BC, FCP, ST, PIS/COFINS, CFOP padrão. RPC `aplicar_matriz_fiscal(produto_id, dest_uf, finalidade)` retorna o item pronto. Tela de cadastro em "Faturamento → Configurações → Matriz Fiscal" com clonagem (botão "Copiar matriz" do Sebrae).

### 4.2 Natureza de Operação
Tabela `naturezas_operacao` (descrição, CFOP padrão dentro/fora UF, finalidade NF-e, movimenta estoque?, gera financeiro?). Vira preset 1-clique no Passo 1.

### 4.3 Carta de Correção (CC-e)
Serviço `cartaCorrecao.service.ts` (evento 110110), drawer no detalhe da NF: textarea (mínimo 15 chars, máximo 1000), histórico de CC-e (até 20 por NF). Persistência em `eventos_fiscais`.

### 4.4 NF-e Devolução / Complementar / Remessa
Botões "Nova devolução", "Nova complementar" no detalhe de uma NF autorizada. Pré-preenche referência (`refNFe`), CFOPs invertidos, finalidade adequada, itens copiados.

### 4.5 Inutilização de numeração
Drawer "Inutilizar números" em "Faturamento → Documentos": série + faixa numérica + justificativa. Exige que os números estejam não usados; persiste em `inutilizacoes` e bloqueia reuso.

### 4.6 Status SEFAZ ao vivo
Widget no Painel chamando `consultaStatusServico` (cStat 107) por UF. Detecta SEFAZ offline e oferece **modo contingência SVC-AN/SVC-RS** (alterando `tpEmis` para 9).

### 4.7 Catálogo de rejeições
Tabela seed `sefaz_rejeicoes_help` com cStat → título amigável + causa provável + ação sugerida (espelho do capítulo "Rejeições e Soluções" do manual). Modal de retorno SEFAZ consulta esta tabela e mostra "Como resolver".

### 4.8 Exportação em lote
Botão "Exportar XMLs do período" gera ZIP com todos `procNFe.xml` autorizados (storage `dbavizee/nfe/`) e DANFEs PDF — usado por contadores.

### 4.9 Permissões por perfil fiscal
Recursos novos em `user_permissions`: `faturamento.emitir`, `faturamento.cancelar`, `faturamento.cce`, `faturamento.inutilizar`, `faturamento.matriz_fiscal`. Perfis sugeridos: Vendedor (emitir), Financeiro (consultar), Contador (CC-e/inutilizar/exportar), Admin (tudo).

## 5. Fundação técnica obrigatória (sem isso nada autoriza)

Mantida do plano anterior, agora explicitada:

- **Numeração atômica**: SEQUENCE `nfe_numero_seq_<serie>` + RPC `proximo_numero_nfe(serie)`.
- **Chave de acesso 44d**: RPC `gerar_chave_acesso_nfe(nf_id)` (UF+AAMM+CNPJ+modelo+série+número+tpEmis+cNF+DV mod11).
- **IBGE município** em `clientes` e `fornecedores` (lookup ViaCEP/IBGE no cadastro).
- **Endurecer `buildNFeDataFromDb`**: NCM válido obrigatório, CFOP derivado, CST/CSOSN conforme CRT, tpag mapeado, sem defaults perigosos.
- **Pós-autorização**: salvar `procNFe.xml` em `dbavizee/nfe/<ano>/<mes>/<chave>.xml`, gerar DANFE PDF, popular `caminho_xml`/`caminho_pdf`, opcional envio email via fila pgmq.
- **Triggers de integração**: NF autorizada → `estoque_movimentos` (saída) + `financeiro_lancamentos` (a receber por parcela).
- **Constraint unicidade**: `(empresa_id, modelo, serie, numero)` única em `notas_fiscais`.

## 6. Roadmap em 6 ondas

```text
Onda 0 — Fundação SEFAZ (bloqueante)  ✅ entregue
  Numeração + chave + IBGE + uniqueness + rigor do payload + persistência XML/DANFE

Onda 1 — Estrutura do módulo /faturamento  ✅ entregue
  Rota, layout 4 abas, KPIs do Painel, widget status SEFAZ

Onda 2 — Cadastros fiscais
  Naturezas de Operação, Matriz Fiscal, Transportadoras, aba Fiscal em produtos,
  IBGE município em clientes/fornecedores, UI upload certificado A1 + alerta validade

Onda 3 — Wizard Emitir NF-e (5 passos)
  Rascunho/autosave, presets de natureza, validação SEFAZ-grade,
  modal de retorno com catálogo de rejeições

Onda 4 — Backlog "Faturar OV"
  Tela com OVs aprovadas, RPC faturar_ordem_venda, faturamento parcial,
  triggers estoque/financeiro

Onda 5 — Eventos pós-emissão e operação
  CC-e (serviço + UI), Inutilização (drawer), NF Devolução/Complementar/Remessa,
  Exportar XMLs em lote, Importar XML emitido fora (já existe — integrar),
  Permissões fiscais granulares
```

## 7. Fora do MVP (fase 2)

NFC-e (precisa CSC + impressora), CT-e (5 modais), NFS-e (350+ municípios diferentes), MDF-e, Manifestação do Destinatário, certificado A3 (precisa middleware no SO do cliente). Mantemos as telas atuais como placeholder até decidirmos investir.

## 8. Pré-requisitos do cliente (operacionais)

1. Certificado A1 (.pfx) + senha
2. CRT, IE ativa, série e numeração inicial definidos
3. NCM/CFOP padrão revisados nos produtos cadastrados
4. Homologação SEFAZ antes de virar para produção

## Como prefere prosseguir?

Sugiro a sequência **Onda 0 → Onda 1 → Onda 3** (fundação + casca + wizard de emissão) para ter algo emitindo NF-e real em homologação o quanto antes; cadastros (Onda 2) e backlog OV (Onda 4) entram em paralelo conforme prioridade. Posso começar pela Onda 0 ou prefere validar antes a estrutura visual da Onda 1 (rota, abas, KPIs)?

---

## Status de implementação

- ✅ **Onda 0** — Fundação: SEQUENCE de numeração, RPC `gerar_chave_acesso_nfe`, IBGE em clientes/fornecedores
- ✅ **Onda 1** — Estrutura: rota `/faturamento` com 4 abas (Painel/Emitir/Backlog/Documentos) e KPIs reais
- ✅ **Onda 2** — Cadastros auxiliares:
  - Tabelas `naturezas_operacao`, `matriz_fiscal`, `ibge_municipios`
  - RPCs `aplicar_matriz_fiscal(produto, uf_destino)` e `buscar_municipio_ibge(nome, uf)`
  - UI `/faturamento/cadastros` com Naturezas (CRUD + 7 seeds) e Matriz Fiscal (CRUD)
  - Hook `useMunicipioIbge` com fallback automático para a API do IBGE
- ⏳ **Onda 3** — Wizard 5 passos
- ⏳ **Onda 4** — Backlog OV→NF
- ⏳ **Onda 5** — Eventos: CC-e, devolução/complementar, inutilização UI
- ⏳ **Onda 6** — Status SEFAZ por UF + contingência
