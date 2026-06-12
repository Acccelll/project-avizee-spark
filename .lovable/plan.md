# Plano: Cursor NSU travado e contagem "138 vs 5 NF-e" confusa

## Diagnóstico (logs reais)

Pelo `edge-function-logs` do `sefaz-distdfe` e pelo estado de `nfe_distdfe_sync`:

- O serviço enviou `ultNSU="000000000000050"` (correto, era o último cursor salvo).
- A SEFAZ respondeu **`cStat 138`, `ultNSU=000000000000050`, `maxNSU=000000000000137`, 50 docZips**.
- Ou seja: o AN devolveu o **mesmo** `ultNSU` que recebeu — o cursor não andou.
- O loop em `sincronizarDistDFe` (`distdfe.service.ts:472-478`) tem proteção contra loop infinito (`if (!avancou) break;`) — então sai depois de 1 lote, mostrando "0 NF-e novas, 50 existentes, ainda restam ~87 documento(s)". Próximo clique repete a mesma resposta. **Comportamento atual está correto** — sem essa guarda viraria loop com risco de 656.
- Sobre "138 vs 5 NF-e": **138 é o `maxNSU`** (universo total de NSUs do CNPJ no AN), não o número de NF-es. A base hoje tem 5 `procNFe` + 6 eventos = 11 linhas. Os outros NSUs (até 137) podem ser eventos para outras notas, resumos, ou notas para outros destinatários — só dá pra confirmar olhando o XML real de cada docZip.

## Por que a SEFAZ está devolvendo o mesmo cursor

Duas hipóteses precisam ser distinguidas com log adicional:

1. **AN está re-entregando docs ≤ 50** (NF-es já processadas). Acontece quando o cron/cliente nunca confirmou avanço, ou quando há quirk do AN para CNPJ com poucos NSUs novos.
2. **Parser está lendo o `ultNSU` errado** do envelope SOAP. Se SEFAZ devolveu, por exemplo, `<ultNSU>100</ultNSU>`, mas há outro `<ultNSU>` antes (header SOAP, retorno aninhado, eco da requisição), o regex `extrairTag("ultNSU")` casa o primeiro.

Sem ver os primeiros KB da resposta crua, não dá para escolher entre (1) e (2). O plano inclui um log defensivo para essa próxima sync e um fallback que destrava o cursor sem risco quando os docZips trazem NSU maior do que o `ultNSU` devolvido.

## O que muda

### 1. `supabase/functions/sefaz-distdfe/index.ts` — diagnóstico mínimo

Logar, **após o unwrap do Worker**, os primeiros 1.500 chars do bloco `retDistDFeInt` (já existe `extrairTag` para isolar). Antes do `parseRetDistDFeInt`:

```ts
log.info("retDistDFeInt preview", {
  preview: (extrairTag(xmlRetorno, "retDistDFeInt") ?? xmlRetorno).slice(0, 1500),
  totalBytes: xmlRetorno.length,
});
```

E logar a lista de NSUs dos docZips processados (apenas atributo, não conteúdo):

```ts
log.info("docZips NSUs", { nsus: parsed.docs.map(d => d.nsu) });
```

Zero impacto funcional — só telemetria para a próxima sync revelar se a SEFAZ está realmente travada no NSU 50 ou se o parser está pulando o `ultNSU` correto.

### 2. `src/services/fiscal/sefaz/distdfe.service.ts` — cursor defensivo

No loop, depois de receber `data` e calcular `novoUltNSU`, se `novoUltNSU === ultNSUAtual` **mas** `data.docs` tem algum `nsu > ultNSUAtual`, considerar o cursor como o **maior NSU dentre os docZips recebidos**:

```ts
let novoUltNSU = data.ultNSU ?? ultNSUAtual;
if (novoUltNSU === ultNSUAtual && data.docs?.length) {
  const maxDocNsu = data.docs
    .map((d) => d.nsu)
    .filter((n) => /^\d+$/.test(n))
    .reduce((acc, n) => (BigInt(n) > BigInt(acc) ? n : acc), ultNSUAtual);
  if (BigInt(maxDocNsu) > BigInt(ultNSUAtual)) novoUltNSU = maxDocNsu;
}
```

Se a hipótese (2) (parser/echo) for verdade, isso destrava o cursor para o próximo lote sem precisar mexer em parser. Se for hipótese (1) (AN realmente parado em 50), o fallback fica inerte — o cursor continua em 50 e a guarda anti-loop continua barrando, exatamente como hoje. Não há piora possível.

### 3. `src/pages/fiscal/PortalFiscal.tsx` — clareza no card e no toast

O número "138" no toast atual vem como `~87 documento(s) na fila` (correto), mas o card mostra "138 / 50" sem contexto do que é cada coisa. Ajustes:

- Renomear no card o rótulo "NSU" para "Cursor NSU (universo do AN)" e adicionar tooltip:
  > "NSU é um contador interno da SEFAZ por CNPJ. Cada NSU pode ser uma NF-e completa, um resumo (resNFe) ou um evento (ciência, cancelamento, manifestação). Por isso o universo (138) costuma ser maior que o número de NF-es completas no grid."
- Quando o sync devolver `novos === 0 && duplicados > 0 && restantes > 0`, mudar o toast para **aviso** em vez de sucesso, com descrição:
  > "A SEFAZ devolveu N documento(s) que já estavam na base. Cursor permanece em X — clique novamente em alguns minutos."
- No card, complementar a linha "Na base" para refletir o universo SEFAZ:
  > "Na base: 5 NF-e completas · 6 eventos · 0 resumos. (Universo SEFAZ: 137 NSU — os demais costumam ser eventos para outras NF-es ou documentos de outros destinatários filtrados pelo CNPJ.)"

## Verificação

Depois do deploy:

1. Pedir ao usuário para clicar **uma vez** em Sincronizar.
2. Ler os novos logs: `retDistDFeInt preview` + `docZips NSUs`.
3. Se NSUs > 50 aparecerem na lista → confirma hipótese (2), o fallback do passo 2 já fez o cursor avançar — pronto.
4. Se NSUs forem todos ≤ 50 → confirma hipótese (1), abrir tíquete no PSC/SEFAZ ou usar `consChNFe` por chave específica; o app está correto.

## Fora de escopo

- Não mexer em RLS, RPC, schema, transporte mTLS ou edge functions além do log defensivo.
- Não tocar no parser de NSU sem a evidência do preview (mudar regex às cegas pode quebrar casos OK).
- Não adicionar nova tabela.
