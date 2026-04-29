
# Auditoria do módulo Fiscal/Faturamento — Plano de correções

Validei todos os 13 pontos contra o código atual. Confirmações importantes:

- `notas_fiscais` **já tem** `transportadora_id` e `data_saida_entrada` — não precisamos criar essas colunas.
- `notas_fiscais` **não tem** `indicador_presenca`, `data_saida`, `hora_saida`, `via_intermediador`, `intermediador_cnpj`, `intermediador_identificador` — migration necessária.
- RPC `aplicar_matriz_fiscal` existe.
- Componente canônico `FiscalSefazStatusBadge` existe em `src/components/fiscal/FiscalStatusBadges.tsx`.
- `MatrizTab` realmente inicializa `crt: "3"`, `cst_csosn: "00"`, `aliquota_icms: 18`, `pis: 1.65`, `cofins: 7.6`.
- `BacklogFaturamento` busca em `numero` e `po_number` apenas (sem nome do cliente).
- `Step4Transporte` não tem nenhum campo de transportadora.
- `Step1Identificacao` não tem `indicador_presenca` nem `data_saida`.

## Críticos (bloqueiam emissão SEFAZ)

### C-01 — Step 1 sem indicador_presenca e data_saida
- **Migration**: adicionar em `notas_fiscais`:
  - `indicador_presenca text default '0'` (CHECK `('0','1','2','3','4','9')`)
  - `data_saida date null`
  - `hora_saida time null`
- **wizardSchema** (`EmitirNFeWizard.tsx`): adicionar os 3 campos no Passo 1.
- **Step1Identificacao**: adicionar Select de Indicador de Presença (rótulos Sebrae) e dois inputs (date + time) para data/hora de saída, com validação client-side `data_saida >= data_emissao`.
- **salvarRascunho**: mapear os 3 campos no payload de insert.
- **defaultValues**: `indicador_presenca: "0"`, `data_saida: ""`, `hora_saida: ""`.

### C-02 — Passo 4 sem transportadora
- **wizardSchema**: adicionar `transportadora_id`, `transportadora_cnpj`, `transportadora_nome`, `veiculo_placa`, `veiculo_uf` (todos opcionais).
- **Step4Transporte**: bloco condicional `frete_modalidade !== "9"` com:
  - Autocomplete (Popover + Command) sobre `fornecedores` filtrado por `transportadora = true` (verificar nome real do flag em `fornecedores`).
  - Inputs para placa e UF do veículo.
- **salvarRascunho**: persistir `transportadora_id` (coluna já existe).
- Nota: campos placa/UF do veículo serão guardados em `observacoes` ou em coluna JSON `transporte_dados` se já existir (verificar antes de criar nova coluna).

### C-03 — `aguardando_protocolo` ausente em fiscalSefazStatusMap
- **`src/lib/fiscalStatus.ts`**:
  - Adicionar `"aguardando_protocolo"` ao tipo `FiscalSefazStatus`.
  - Adicionar entry no `fiscalSefazStatusMap` com label "Aguardando protocolo", classes info, ícone `Clock3`.
  - Adicionar ao `fiscalSefazStatusOptions`.

### C-04 — StatusBadge inline em Faturamento.tsx
- **`src/pages/Faturamento.tsx`**:
  - Remover função `StatusBadge` inline e import de `Badge` se não usado em outros pontos.
  - Importar `FiscalSefazStatusBadge` de `@/components/fiscal/FiscalStatusBadges`.
  - Substituir `<StatusBadge status={n.status_sefaz} />` pelo canônico.

## Altos (degradam fluxo)

### A-01 — Matriz Fiscal default CRT "3" → "1" (Simples)
- **`FaturamentoCadastros.tsx` MatrizTab `useForm` defaults**:
  - `crt: "1"`, `cst_csosn: "102"`, `aliquota_icms: 0`, `aliquota_pis: 0`, `aliquota_cofins: 0`.

### A-02 — Botão "Duplicar" na Matriz Fiscal
- Adicionar coluna Ações com botão `Copy` (lucide).
- Handler `duplicarRegra(m)`: `setEditing(null)` + `form.reset({...m, nome: m.nome+" (cópia)"})` + `setOpen(true)`.

### A-03 — Auto-aplicar matriz fiscal após carregar OV
- Em `carregarOrdemVenda`, depois de `form.setValue("itens", itensWizard)`:
  - Loop por item chamando `supabase.rpc("aplicar_matriz_fiscal", {...})`.
  - `setValue` em cfop, cst, alíquotas, `matriz_aplicada: true`.
  - Toast informativo no início e contagem ao final.

### A-04 — Aba Documentos como ConsultaDocumentos real
- Criar `src/pages/faturamento/ConsultaDocumentos.tsx`:
  - DataTableV2 (ou tabela simples) sobre `notas_fiscais`.
  - Colunas: numero, parceiro, data_emissao, status_sefaz (badge canônico), valor_total.
  - Filtros: tipo (entrada/saida), status_sefaz (multi), período (PeriodFilter).
  - Ações: "Ver" → `/fiscal/:id`, "Emitir similar" → `/faturamento/emitir?refNFeId=…`.
- Substituir conteúdo do `TabsContent value="documentos"` em `Faturamento.tsx`.

## Médios (qualidade/UX)

### M-01 — Busca do Backlog cobrir nome do cliente
- Em `BacklogFaturamento` queryFn: pré-busca `clientes.id` por nome, monta `or` com `cliente_id.in.(...)` + `numero.ilike` + `po_number.ilike`.

### M-02 — CST default derivado do CRT da empresa
- Em `EmitirNFeWizard.adicionarProduto` (e `adicionarVazio` para coerência):
  - Cachear via `useQuery` o `empresa_config.crt` no escopo do wizard.
  - `cstDefault = (crt === "1" || crt === "2") ? "102" : "00"`.

### M-03 — staleTime nos KPIs do Painel
- Em `Faturamento.tsx`, ambos `useQuery` (kpis e ultimas):
  - `staleTime: 60_000`, `refetchOnWindowFocus: false`.

### M-04 — Botão "Duplicar" em NaturezasTab
- Mesma mecânica de A-02, com sufixo `_COPIA` no código e " (cópia)" na descrição.

## Baixos (conformidade)

### B-01 — Bloco infIntermed (NT 2020.006)
- **Migration**: adicionar em `notas_fiscais`:
  - `via_intermediador boolean default false`
  - `intermediador_cnpj text null`
  - `intermediador_identificador text null`
- **wizardSchema** Passo 1: 3 campos opcionais.
- **Step1Identificacao**: Switch "Operação via intermediador (marketplace)" que revela 2 inputs.
- **salvarRascunho**: mapear no payload.

### B-02 — Deep-link manifestação preservar aba origem
- Em `Faturamento.tsx`, no `useEffect` de deep-link:
  - Ler `returnTab` do searchParams; se ausente, manter `tab` atual.
  - Após limpar `tab` e `nfe`, setar `next.set("tab", returnTab)`.

## Detalhes técnicos

```text
Migrations a criar
└─ alter_notas_fiscais_indicador_presenca_saida_intermed
   ├─ ADD COLUMN indicador_presenca text DEFAULT '0'
   ├─ ADD COLUMN data_saida date
   ├─ ADD COLUMN hora_saida time
   ├─ ADD COLUMN via_intermediador boolean DEFAULT false
   ├─ ADD COLUMN intermediador_cnpj text
   ├─ ADD COLUMN intermediador_identificador text
   ├─ CHECK chk_nf_indicador_presenca IN ('0','1','2','3','4','9')
   └─ CHECK chk_nf_data_saida_ge_emissao (data_saida IS NULL OR data_saida >= data_emissao::date)
```

Arquivos editados (sem migration):
- `src/lib/fiscalStatus.ts` (C-03)
- `src/pages/Faturamento.tsx` (C-04, M-03, B-02)
- `src/pages/faturamento/EmitirNFeWizard.tsx` (C-01, C-02, A-03, M-02, B-01)
- `src/pages/faturamento/FaturamentoCadastros.tsx` (A-01, A-02, M-04)
- `src/pages/faturamento/BacklogFaturamento.tsx` (M-01)

Arquivos criados:
- `src/pages/faturamento/ConsultaDocumentos.tsx` (A-04)

Verificações pendentes durante a implementação:
1. Nome exato da flag de transportadora em `fornecedores` (`transportadora` vs `eh_transportadora`).
2. Existência de coluna JSON para dados de transporte; se não houver, persistir placa/UF apenas em `observacoes` no rascunho (sem nova migration).
3. `app_configuracoes` ou `empresa_config` para leitura do CRT em M-02.

## Ordem sugerida de execução

1. Migration (C-01 + B-01) — adicionar colunas em `notas_fiscais`.
2. C-03 + C-04 (rápidos, baixo risco).
3. C-01, C-02, B-01 no wizard.
4. A-01, A-02, M-04 nos cadastros.
5. A-03 (auto-matriz na OV).
6. A-04 (ConsultaDocumentos).
7. M-01, M-02, M-03, B-02 (polimentos).

Posso prosseguir?
