# Plano: Bloqueio SEFAZ 656 não pode se repetir a cada clique

## Diagnóstico

Olhei o código de `sincronizarDistDFe` (`src/services/fiscal/sefaz/distdfe.service.ts`) e o estado do banco:

- `nfe_distdfe_sync` (ambiente=1): última sync **ontem 21:43**, com `ultimo_nsu=50`, `max_nsu=137`, `cStat=138`. Hoje, ao clicar Sincronizar, a SEFAZ está devolvendo **cStat 656** ("Consumo Indevido — CNPJ bloqueado por ~1h").
- Existe um circuit breaker client-side (`verificarCircuitBreaker`) que lê `app_configuracoes` na chave `distdfe_circuit_break_until_<ambiente>`. **Essa chave está vazia.** Ninguém grava nela quando o 656 acontece. Resultado: cada clique reabre o chamado contra a SEFAZ, alimenta o bloqueio e devolve o mesmo texto de "1 hora".
- O botão "Sincronizar SEFAZ" não tem nenhum gate — fica sempre habilitado, mesmo durante o bloqueio.
- O card de status novo já mostra `cStat 138` da última sync OK, mas não mostra o bloqueio atual.

Ou seja: o erro é real (SEFAZ 656), mas o app está **propagando** o problema porque (a) não persiste o bloqueio e (b) não impede novos cliques.

## O que muda

Apenas dois arquivos. Zero migrations, zero edge function nova.

### 1. `src/services/fiscal/sefaz/distdfe.service.ts`

Quando a chamada à edge `sefaz-distdfe` voltar com `cStat === "656"` (já existe o `if` na linha 348), gravar antes do `return`:

```ts
const until = new Date(Date.now() + 60 * 60_000).toISOString();
await supabase.from("app_configuracoes").upsert(
  { chave: `distdfe_circuit_break_until_${ambienteResolvido}`, valor: { until } },
  { onConflict: "chave" },
);
```

E ajustar `minutosRestantes` no retorno para refletir os 60 min reais. Assim o próximo clique já cai no `verificarCircuitBreaker` (linha 279) e nem chega à SEFAZ — exatamente o que a memória `mem://tech/sefaz-mtls-transporte` recomenda para 656.

### 2. `src/pages/fiscal/PortalFiscal.tsx`

- Adicionar estado `bloqueio: { ate: string; minutosRestantes: number } | null`.
- Em `carregarStatus`, ler `app_configuracoes` da chave `distdfe_circuit_break_until_1` (ou 2). Se `until > now`, preencher `bloqueio`. Se vencido, limpar.
- Em `sincronizar`, se `r.circuitBreaker?.ativo`, atualizar o `bloqueio` local com o que voltou (evita esperar o reload).
- Card de status: quando `bloqueio` ativo, mostrar uma faixa vermelha:
  > "CNPJ bloqueado pela SEFAZ até `HH:MM` (~N min). Aguardando expirar."
- Botão "Sincronizar SEFAZ": `disabled={syncing || !!bloqueio}`. Tooltip explicando que está aguardando o desbloqueio.

## Por que isso encerra o loop

- Primeiro 656 grava a janela de 60 min em `app_configuracoes`.
- Próximos cliques caem no breaker antes de qualquer fetch à SEFAZ — não há mais request → não há como o "1 hora" se repetir vindo da SEFAZ.
- O botão fica desabilitado, então o usuário não consegue mais provocar o mesmo erro acidentalmente.
- Quando o `until` expira, `carregarStatus` zera `bloqueio`, botão reabilita, fluxo normal volta sozinho.

## Fora de escopo

- Não mexer na edge function `sefaz-distdfe`.
- Não mudar nada de RLS, RPC, ou estrutura de `nfe_distdfe_sync`.
- Não alterar o transporte mTLS / Cloudflare Worker.
- Não mudar a UI de filtros/grid/CSV — só o card de status + estado do botão.
