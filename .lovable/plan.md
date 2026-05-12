## Objetivo

Resolver dois ajustes:

1. **Pré-preencher o nº do orçamento sem consumir a sequência** — exibir o "próximo número que de fato será salvo" (ex.: ORC100279), avançando só após o save real.
2. **Definir #b2592c (primária) e #690500 (secundária) como cores default** — incluindo a tela de login, sem depender de configuração no banco.

---

## 1) Numeração de orçamento — peek vs consume

### Problema

Hoje, ao abrir o formulário de novo orçamento, o front chama `proximo_numero_orcamento()` (RPC), que executa `nextval(seq_orcamento)` e **consome** a sequência. Se o usuário fechar sem salvar, o número fica "queimado" — daí o gap entre o que aparece pré-preenchido e o que aparece no Grid.

### Solução

**a) Nova RPC `peek_proximo_numero_orcamento()`** (apenas leitura, não consome a sequência):

```text
SELECT 'ORC' || LPAD( (GREATEST(
   (SELECT COALESCE(MAX(SUBSTRING(numero FROM 4)::int), 0) FROM orcamentos
      WHERE numero ~ '^ORC[0-9]+$'),
   (SELECT last_value FROM seq_orcamento)
) + 1)::text, 6, '0')
```

`SECURITY DEFINER`, `search_path = public`, `STABLE`. Retorna `text`.

**b) Frontend — `OrcamentoForm.tsx`**

- Ao abrir em modo "novo": chamar `peek_proximo_numero_orcamento()` em vez de `proximo_numero_orcamento()` para pré-preencher o campo (display).
- No `handleSave` (novo orçamento): **não enviar** `numero` no payload (passar `null`/string vazia) — o RPC `salvar_orcamento` já faz `COALESCE(p_payload->>'numero', proximo_numero_orcamento())` e gera o número definitivo de forma atômica no momento do INSERT.
- Após save bem-sucedido, atualizar o campo do form com o `numero` real retornado pelo RPC (`setValue('numero', orcamentoSalvo.numero)`).
- **Duplicação** (`handleDuplicate`): mesmo padrão — passar `numero: null` para o RPC; o número só sai depois do save.

Resultado: o número exibido é uma **previsão** baseada em `MAX(numero) + 1`, e a sequência só avança quando o INSERT acontece de verdade. Sem gaps por formulários abandonados.

### Atenção

- Como há janela entre "peek" e "save", dois usuários simultâneos podem ver o mesmo número de previsão — mas só **um** vai vencer no INSERT (a sequência é atômica). O perdedor recebe o próximo número definitivo no retorno do save (e o front atualiza o campo). Toast informativo: *"Número atualizado para ORC100280 (já havia outro orçamento criado em paralelo)."*

---

## 2) Cores default da empresa

Hoje `src/index.css` tem invertido:
- `--primary: 2 100% 21%` ≈ **#690500** (deveria ser secundária)
- `--secondary: 21 63% 44%` ≈ **#b76029** (deveria ser primária)

### Mudança em `src/index.css`

**`:root`:**
- `--primary: 20 60% 44%`  (#b2592c)
- `--ring: 20 60% 44%`
- `--sidebar-primary: 20 60% 44%`
- `--sidebar-ring: 20 60% 44%`
- `--secondary: 3 100% 21%`  (#690500)

**`.dark`:** mesmo swap, com leve elevação de luminância no primary (`20 60% 52%`) para contraste AA.

Tokens de gradient (`--gradient-primary`, hero-gradient etc.) já usam `var(--primary)`/`var(--secondary)` — herdam automaticamente.

### Tela de login

`Login.tsx` usa exclusivamente `bg-primary`, `text-primary-foreground` etc. e `useBranding` só para logo/textos — **não** sobrescreve cores. Como `ThemeProvider` aplica `applyCorporateTheme(branding.corPrimaria, branding.corSecundaria)` **só quando há valores não-nulos** no `empresa_config`, os defaults do CSS valem para login e para qualquer tenant que não tenha configurado cores. Não precisa tocar no Login.

---

## Arquivos a alterar

- **Nova migration**: `peek_proximo_numero_orcamento` (SQL function read-only).
- `src/types/rpc.ts` — exportar wrapper `peekProximoNumeroOrcamento()`.
- `src/pages/OrcamentoForm.tsx` — usar peek no load, omitir `numero` no payload do save/duplicate, atualizar campo com retorno do RPC.
- `src/index.css` — swap de `--primary` / `--secondary` em `:root` e `.dark`, mais `--ring` e tokens de sidebar.

## O que NÃO muda

- Lógica de RLS, permissões, validação do form, contrato de status.
- `proximo_numero_orcamento()` permanece igual (continua sendo a função autoritativa no INSERT).
- `useBranding` / `ThemeProvider` — overrides de tenant continuam funcionando.
- Login.tsx — nenhuma mudança.