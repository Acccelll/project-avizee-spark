# Modelo Estrutural Oficial — Fiscal

## 1) Máquina de estados — Status interno (`notas_fiscais.status`)

Conjunto canônico: `rascunho · pendente · confirmada · importada · cancelada`.

```
rascunho ──▶ pendente ──▶ confirmada ──▶ cancelada
    │           │               │
    └───────────┴────▶ cancelada┘
importada (terminal — NFs externas via XML)
```

- `rascunho`: edição livre, nenhum efeito operacional.
- `pendente`: criada por automação (ex.: `gerar_nf_de_pedido`); ainda não impacta estoque/financeiro.
- `confirmada`: efeitos aplicados (estoque + financeiro + faturamento OV). Estruturalmente travada.
- `importada`: NF externa importada via XML; somente leitura.
- `cancelada`: terminal local, sem efeitos vigentes.

## 2) Máquina de estados — Status SEFAZ (`notas_fiscais.status_sefaz`)

Conjunto canônico: `nao_enviada · em_processamento · autorizada · rejeitada · denegada · cancelada_sefaz · inutilizada · importada_externa`.

```
nao_enviada ─▶ em_processamento ─▶ autorizada ─▶ cancelada_sefaz
                              │
                              ├─▶ rejeitada (volta a nao_enviada)
                              └─▶ denegada (terminal)
nao_enviada ──▶ inutilizada (terminal)
importada_externa (terminal — NF de terceiro)
```

## 3) Coerência obrigatória (CHECKs)

- `status_sefaz IN ('autorizada','em_processamento','cancelada_sefaz') ⇒ status='confirmada'`
- `status_sefaz='inutilizada' ⇒ status IN ('rascunho','cancelada')`
- `status='importada' ⇒ status_sefaz='importada_externa'`
- `tipo_operacao='devolucao' ⇒ nf_referenciada_id IS NOT NULL`

## 4) Política oficial — exclusão / cancelamento / inutilização / estorno

| Operação | Quando | Como |
|---|---|---|
| **DELETE físico** | `status='rascunho' AND status_sefaz='nao_enviada'` | DELETE direto (trigger libera) |
| **Cancelamento interno** | NF não enviada, rejeitada ou denegada | `cancelar_nota_fiscal(id, motivo)` — estorna efeitos se confirmada |
| **Cancelamento SEFAZ** | `status_sefaz='autorizada'` dentro do prazo legal | `cancelar_nota_fiscal_sefaz(id, protocolo, motivo)` |
| **Inutilização** | Faixa numérica nunca usada | `inutilizar_nota_fiscal(id, protocolo, motivo)` — só `status_sefaz='nao_enviada'` |
| **Estorno operacional** | Reverter efeitos de NF confirmada não autorizada | `estornar_nota_fiscal(id, motivo)` |
| **Devolução** | Documento derivado | `gerar_devolucao_nota_fiscal(origem, itens?)` — origem confirmada, soma ≤ qtd origem |

## 5) Origem canônica (`notas_fiscais.origem`)

`manual · xml_importado · pedido · devolucao · importacao_historica · sefaz_externa`.

## 6) Integridade — Unicidade

- `chave_acesso` única (parcial: `WHERE chave_acesso IS NOT NULL`).
- `(modelo_documento, serie, numero, tipo)` único entre ativos.

## 7) Auditoria

- Trigger `trg_nf_audita_status` grava `nota_fiscal_eventos` automaticamente em mudanças de `status` ou `status_sefaz`.
- Eventos canônicos: `criacao · edicao · confirmacao · estorno · autorizacao_sefaz · rejeicao_sefaz · cancelamento · cancelamento_sefaz · inutilizacao · criacao_devolucao · importacao_xml · anexo_adicionado`.
- `auditoria_logs` registra cada operação RPC (`confirmar_nf`, `estornar_nf`, `cancelar_nf`, `cancelar_nf_sefaz`, `inutilizar_nf`, `gerar_devolucao`).

## 8) Rastreabilidade — `v_trilha_fiscal`

View consolidando por NF:
- `financeiro_lancamento_ids[]`
- `estoque_movimento_ids[]` (tipos `fiscal` e `fiscal_estorno`)
- `devolucoes_ids[]` (NFs filhas com `tipo_operacao='devolucao'`)
- `eventos_count`

## 9) RPCs oficiais (assinatura)

| RPC | Args | Efeito |
|---|---|---|
| `confirmar_nota_fiscal` | `(p_nf_id uuid)` | Aplica estoque + financeiro + OV; idempotente; lock concorrente |
| `estornar_nota_fiscal` | `(p_nf_id uuid, p_motivo text)` | Estorna estoque, **cancela** lançamentos financeiros (não deleta), reverte OV |
| `cancelar_nota_fiscal` | `(p_nf_id uuid, p_motivo text)` | Cancelamento interno; chama estorno se necessário |
| `cancelar_nota_fiscal_sefaz` | `(p_nf_id uuid, p_protocolo text, p_motivo text)` | Atualiza `status_sefaz='cancelada_sefaz'` (motivo ≥ 15 chars) |
| `inutilizar_nota_fiscal` | `(p_nf_id uuid, p_protocolo text, p_motivo text)` | Inutiliza faixa numérica (motivo ≥ 15 chars) |
| `gerar_devolucao_nota_fiscal` | `(p_nf_origem_id uuid, p_itens jsonb)` | Cria NF de devolução validando saldo devolvível |

## 10) Implementação

Migration aplicada em 2026-04-20:
- CHECK consolidados em `status` e `status_sefaz` + 3 CHECKs de coerência.
- Trigger `trg_nf_status_transicao` valida transições; `trg_nf_protege_delete` bloqueia DELETE; `trg_nf_protege_edicao` + `trg_nf_itens_protege_edicao` travam edição estrutural após confirmar/importar.
- Índices únicos `ux_nf_chave_acesso` e `ux_nf_modelo_serie_numero_tipo`.
- FK `notas_fiscais.transportadora_id → transportadoras(id) ON DELETE SET NULL`.
- 6 RPCs oficiais (3 reescritas + 3 novas) com `pg_advisory_xact_lock` + flag `app.nf_internal_op`.
- View `v_trilha_fiscal` (security_invoker).
- Trigger automático de auditoria em `nota_fiscal_eventos`.

## 11) Pontos para revisão manual

- Quando entrarem NFs reais, conferir se há fluxos legados que tentam ir de `pendente` a `autorizada` sem passar por `confirmar_nota_fiscal` — o CHECK de coerência irá rejeitar.
- Edge function `sefaz-proxy`: passar a chamar `cancelar_nota_fiscal_sefaz` no lugar de UPDATE direto após retorno da SEFAZ.

## 12) Impacto no front-end

- Botão "Excluir" só aparece em NF rascunho não enviada; demais casos viram "Cancelar"/"Cancelar SEFAZ"/"Inutilizar".
- Modal de edição respeita `isFiscalStructurallyLocked` — campos travados após confirmar/importar.
- Estorno passa a preservar lançamentos financeiros (cancelados, não deletados).
- Devolução rejeita quantidade que excede saldo devolvível.