

# Ajustes em Orçamentos — endereço, frete, layout e correção de erro ao salvar

Seis problemas independentes na tela de Orçamentos. O foco é resolver a causa real do erro de salvar (constraint), simplificar campos confusos e melhorar a usabilidade da grade de itens.

---

## 1. Causa do erro "Valor Fora do Intervalo Permitido"

**Diagnóstico:** o erro é o SQLSTATE `23514` (check violation) traduzido por `src/utils/errorMessages.ts`. Duas constraints estão sendo violadas:

- `chk_orcamento_frete_tipo` permite só `'CIF' | 'FOB' | 'sem_frete'`, mas o campo "Transportadora / Serviço de Frete" é texto livre (envia coisas como `"CORREIOS SEDEX"`).
- `chk_orcamentos_status` permite só os 7 canônicos (`rascunho|pendente|aprovado|convertido|rejeitado|cancelado|expirado`), mas o `<Select>` da UI ainda lista `"confirmado"` como opção.

**Correções:**
- Remover do schema/UI o status `"confirmado"` (substituir por `"pendente"` — já é o alias normalizado).
- Trocar a coluna `frete_tipo` de uso. Hoje o **payload** envia o texto livre da transportadora dentro de `frete_tipo`, contaminando a constraint. O correto:
  - `frete_tipo` ↔ apenas modalidade (CIF/FOB/sem_frete).
  - `servico_frete` (já existe na tabela) ↔ texto livre (ex.: `"CORREIOS SEDEX"`).
- Atualizar `OrcamentoCondicoesCard` e `OrcamentoForm` para usar **`servico_frete`** no campo "Frete" (item 4), e parar de gravar o texto livre em `frete_tipo`.
- Em `salvar_orcamento`: passar `NULLIF(p_payload->>'frete_tipo','')` para evitar string vazia → constraint (string vazia falha o CHECK porque não está na lista). Mesma proteção para `modalidade`.

## 2. Endereço completo do cliente no formulário e no link público

**Em `OrcamentoForm.tsx` (bloco "Cliente")** — após o grid existente, adicionar um sub-bloco "Endereço" exibindo `logradouro`, `numero`, `bairro`, `cidade/uf`, `cep` (já estão no `clienteSnapshot`). Layout em 2 colunas, somente leitura, com fallback "—".

**Em `OrcamentoPublico.tsx`** — a `cliente_snapshot` já é JSON e contém endereço; basta renderizar. Adicionar bloco "Endereço de entrega/cobrança" no card do cliente com `logradouro, numero · bairro · cidade/uf · cep`. **Não precisa migration** — a view `orcamentos_public_view` já expõe `cliente_snapshot` inteiro.

## 3. Visualização de "Itens do Orçamento"

A tabela tem `min-w-[1150px]` e estoura a tela em viewports comuns. Estratégia em duas frentes:

- **Compactar a grade in-page**: reduzir paddings (`px-3 py-2` → `px-2 py-1.5`), encurtar headers ("Desc. %" → "%"), unidade colada ao Qtd, esconder coluna "Código" abaixo de `lg` (mostrar só dentro do edit do produto), e usar `text-xs` consistente. Meta: caber em ≥1100px sem scroll horizontal.
- **Botão "Editar em tela cheia"** ao lado de "Adicionar Item" → abre um `Dialog` largo (`max-w-6xl`) com a mesma grade em modo expandido (todas as colunas, inclusive custo/margem para quem tem permissão). O dialog usa o mesmo `OrcamentoItemsGrid` controlado pelo mesmo `items`/`setItems`, então edição é bidirecional.

**Mesmo padrão para "Análise Interna · Base x Cenário"** (`OrcamentoInternalAnalysisPanel`): adicionar ação "Expandir" que abre `Dialog` `max-w-7xl` com o conteúdo já existente, sem reescrever a lógica.

## 4. Renomear campo "Transportadora / Serviço de Frete" → "Frete"

Em `OrcamentoCondicoesCard.tsx`:
- Label: `"Transportadora / Serviço de Frete"` → `"Frete"`.
- Placeholder mais curto: `"Ex.: SEDEX, Transportadora X"`.
- Vincular ao novo campo `servicoFrete` (no form) em vez de `freteTipo` (ver item 1).

No `OrcamentoForm` adicionar `servicoFrete: z.string().optional()` no `orcamentoSchema` e mapear:
- carregar `orc.servico_frete` em `servicoFrete`;
- gravar em `payload.servico_frete` (já existe coluna).

O `freteTipo` continua existindo no schema/payload, mas vira **derivado da modalidade** (CIF/FOB) ou `null`. O `FreteSimuladorCard` que hoje seta `freteTipo: "CORREIOS (SEDEX)"` passa a setar **`servicoFrete`** com esse texto e `freteTipo` segue `'CIF'|'FOB'|null`.

## 5. Verificar consulta de frete dos Correios

A edge function `correios-api` (action `cotacao_multi`) está implementada e usa o calculador público `CalcPrecoPrazo.aspx` com fallback estimado. Plano de verificação em runtime (sem alterar a função se passar):

- Após deploy das mudanças, abrir `/orcamentos/novo`, escolher cliente com CEP, clicar "Consultar Correios" no `FreteSimuladorCard`.
- Inspecionar o painel de logs da edge function `correios-api`. Se aparecer `fallback_estimativa`, significa que o WS dos Correios respondeu com erro/timeout — comportamento esperado quando `CORREIOS_USER`/`PASS` não estão configurados ou a API legacy está fora do ar.
- **Correção mínima já necessária no client (`useFreteSimulador.handleConsultarCorreios`)**: hoje o filtro `validas = result.filter(o => !o.erro && o.valor > 0)` descarta as opções de fallback (que não vêm com `erro` mas vêm com sufixo "(estimativa)"), então o usuário pode estar vendo "Nenhuma opção" mesmo quando o backend retornou estimativa. Aceitar fallback e mostrar toast informativo: "Valores estimados — credenciais Correios indisponíveis."
- Se mesmo o fallback não aparecer: log `fetch` no console do client + verificar `400` por CEP de origem ausente (`cepOrigem` precisa ter 8 dígitos sem máscara — já está em `consultarCorreios` mas vale auditar `freteSimulacao.service.ts`).

## 6. Botões da parte superior da tela de orçamentos

A barra de ações atual (vide print) tem 8 controles (`Salvar Rascunho`, `Visualizar`, `Gerar PDF`, `Aplicar template`, input "Nome do template", `Salvar Meu`, `Compartilhar`, e mais Duplicar quando edit). Estoura visualmente, mistura ações principais com gestão de templates.

**Reorganização:**
- **Ações primárias** (sempre visíveis): `Salvar` (primary), `Visualizar`, `Gerar PDF`.
- **Ações secundárias** num menu `DropdownMenu` "Mais": `Duplicar`, `Reenviar por e-mail`.
- **Templates** num bloco próprio `DropdownMenu` "Templates" com sub-itens: lista de templates clicáveis (aplica), separador, e dois itens "Salvar como meu…" / "Compartilhar com equipe…" que abrem um `Dialog` pedindo o nome (em vez do input solto na barra). Remove o input `Nome do template` da topbar.

Resultado: barra com 4 botões em vez de 8, sem perder nenhuma funcionalidade.

---

## Detalhes técnicos

**Arquivos editados**
- `src/lib/orcamentoSchema.ts` — adicionar `servicoFrete`, remover `'confirmado'` do enum se ainda existir.
- `src/pages/OrcamentoForm.tsx` — bloco endereço do cliente; usar `servicoFrete`; reorganizar topbar com `DropdownMenu`; dialog "Salvar template"; remover opção `confirmado` do `<Select>` de status; passar `frete_tipo` derivado (CIF/FOB/null) no payload.
- `src/components/Orcamento/OrcamentoCondicoesCard.tsx` — label "Frete", binding em `servicoFrete`.
- `src/components/Orcamento/OrcamentoItemsGrid.tsx` — densidade compacta + botão "Expandir" abrindo `Dialog max-w-6xl` que renderiza a própria grade.
- `src/components/Orcamento/OrcamentoInternalAnalysisPanel.tsx` — botão "Expandir" abrindo `Dialog max-w-7xl`.
- `src/components/Orcamento/useFreteSimulador.ts` — aceitar opções de fallback dos Correios; setar `servicoFrete` no payload em vez de embutir no `freteTipo`.
- `src/services/freteSimulacao.service.ts` — adicionar `servicoFrete` em `FreteSelecaoPayload` e propagação.
- `src/pages/OrcamentoPublico.tsx` — bloco "Endereço" usando `cliente_snapshot.{logradouro, numero, bairro, cidade, uf, cep}`.

**Migration SQL** (1 arquivo):
- `CREATE OR REPLACE FUNCTION salvar_orcamento(...)` — aplicar `NULLIF` nos campos `frete_tipo`, `modalidade`, `pagamento` antes do cast/insert para que string vazia vire `NULL` (evita o 23514 quando o usuário não escolhe modalidade). Sem alterar assinatura nem itens.
- Nenhuma alteração de schema/constraints — a regra `frete_tipo ∈ {CIF,FOB,sem_frete}` continua correta; o que era errado era o uso da coluna no client.

**Compatibilidade**
- Orçamentos antigos cujo `frete_tipo` contém texto livre (ex.: "CORREIOS SEDEX") continuarão a violar a constraint **só ao serem editados/salvos novamente**. Backfill: `UPDATE orcamentos SET servico_frete = frete_tipo, frete_tipo = NULL WHERE frete_tipo NOT IN ('CIF','FOB','sem_frete')` na mesma migration.

**Fora de escopo**
- Editor inline de endereço do cliente dentro do orçamento (continua somente leitura — alterações via `/clientes`).
- Cache local de tarifas Correios (otimização futura).
- Suporte a SEDEX 10/12 no simulador (apenas SEDEX e PAC hoje, conforme função existente).

