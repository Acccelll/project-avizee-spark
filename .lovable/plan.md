## Por que só vieram NF-es de Maio (e nem todas)

### Diagnóstico (dados reais)

Estado atual da base e do cursor (`nfe_distdfe_sync` ambiente=1, CNPJ 53.078.538/0001-85):

- `ultimo_nsu` = **137**, `max_nsu` = **137**, último `cStat` = **656** (Consumo Indevido).
- `nfe_distribuicao`: **11 linhas** (5 procNFe + 6 eventos), NSUs entre **10 e 46**, datas de emissão entre **06/05/2026 e 14/05/2026**.

Cruzando com o histórico de syncs no `distdfe.service.ts`, há **duas causas distintas** para o que o usuário está vendo:

### 1. Por que "só Maio" — janela de 90 dias do Ambiente Nacional

O AN só mantém disponível para download (DistDFe) os documentos dos **últimos ~90 dias** por CNPJ. A primeira sincronização foi em 09/06/2026; o menor NSU devolvido pelo AN foi **10** com emissão em **06/05/2026**, ou seja: o primeiro NSU disponível para esse CNPJ já era de Maio. Documentos anteriores a essa janela (Março/Abril, e Maio antes do dia 06) **não estão mais no AN** — só podem ser recuperados via `consChNFe` por chave específica (consulta avulsa). É comportamento da SEFAZ, não bug do ERP.

### 2. Por que "nem todas de Maio" — o cursor pulou docs sem baixá-los

O AN devolveu o primeiro lote com `ultNSU=50` trazendo 50 docZips, mas apenas **11** foram persistidos (NSUs 10, 13, 23, 24, 29, 30, 32, 34, 40, 41, 46). Os outros 39 NSUs do intervalo 1–50 foram descartados porque o filtro `docs.filter(d => d.chave && /^\d{44}$/.test(d.chave))` em `distdfe.service.ts:412` rejeita qualquer docZip sem chave de 44 dígitos — **incluindo `resNFe` (resumos), `procEventoNFe` e `resEvento` que vêm sem a chave extraída no parser**, e schemas auxiliares do AN (resCancNFe, etc.).

Esse filtro é defensivo demais. O esperado é:
- `resNFe`: tem chave de 44 dígitos no XML — deveria ser persistido. Se não foi, é falha do parser que extrai `chave` no edge function (não está pegando do `<resNFe>` quando o `procNFe` completo não veio).
- `procEventoNFe` / `resEvento`: têm chave de 44 dígitos da NF-e referenciada — deveriam ser persistidos como evento.

Pior: depois desse lote, o próximo clique recebeu `cStat 656` (consumo indevido). A correção anterior (do turno passado) avançou o cursor para **137** lendo `data.ultNSU` da resposta 656. Isso é incorreto: no 656, o AN devolve o **último NSU consolidado entregue para o CNPJ**, não os NSUs ainda não baixados pelo cliente. Resultado: os docs **51–137** foram "pulados" do cursor sem nunca terem sido entregues ao ERP, e agora não voltam mais — a única forma de recuperá-los é resetar o cursor.

### O que muda

#### A. Reset do cursor + remoção da lógica errada de avanço no 656

Migration: voltar `nfe_distdfe_sync.ultimo_nsu` para `'000000000000000'` (zerar) para reentregar todos os 137 NSUs do universo na próxima sincronização. `ultima_resposta_cstat` e `xmotivo` resetados.

```sql
UPDATE public.nfe_distdfe_sync
   SET ultimo_nsu = '000000000000000',
       ultima_resposta_cstat = NULL,
       ultima_resposta_xmotivo = 'Cursor resetado em <data> para recuperar docs perdidos por avanço indevido no 656',
       updated_at = now()
 WHERE cnpj = '53078538000185' AND ambiente = 1;
```

Também limpar o circuit breaker da chave `app_configuracoes.distdfe_circuit_break_until_1` se ainda estiver ativo.

Em `src/services/fiscal/sefaz/distdfe.service.ts` (linhas 348–409): **remover** o trecho que faz `upsert` do `ultimo_nsu` com o valor devolvido no 656. No 656 o cursor **fica parado** — só o circuit breaker é persistido e o usuário aguarda 1h. Sem isso, a próxima sincronização tenta o mesmo NSU velho e o AN responde 137 (nenhum doc novo) ou 138 com novo lote.

#### B. Corrigir o filtro que descarta docs sem chave

Em `distdfe.service.ts:412`, a regra atual ignora qualquer docZip sem `d.chave` de 44d. Trocar para uma estratégia em camadas:

1. Se `d.chave` está presente e válida → persistir normalmente.
2. Se `d.chave` está vazia, tentar extrair da raiz do XML interno (`chNFe`, `chave`, atributo `Id="NFe..."`). Já existe um helper de extração no edge function — espelhar a mesma lógica no cliente como fallback.
3. Só descartar quando, mesmo após o fallback, não houver chave (eventos de manifestação 3ª parte sem referência).

Logar `console.warn` com `{ nsu, schema, motivo: 'sem_chave_extraivel' }` para qualquer descarte, para visibilidade futura sem precisar mexer no edge function.

#### C. Aviso na UI sobre a janela de 90 dias

Em `src/pages/fiscal/PortalFiscal.tsx`, no card de status do DistDF-e, acrescentar abaixo da linha "Na base":

> "Documentos com mais de ~90 dias não ficam disponíveis no Ambiente Nacional — para esses, use **Buscar por chave** na barra superior."

Sem nova feature; só texto explicativo.

### Verificação

1. Após deploy + migration, clicar **Sincronizar** uma vez.
2. Esperar `~137 documentos novos` (todos os NSUs 1–137 reentregues pelo AN).
3. Conferir `nfe_distribuicao`: contagem deve subir de 11 para algo próximo de 50–80 (descontando resumos sem chave e duplicados de evento).
4. Conferir nos logs do edge function se aparecem `console.warn` de descarte — caso sim, listar para decidir se vale ajustar o parser do edge function em outro turno.

### Fora de escopo

- Não tocar no parser do edge function `sefaz-distdfe` nesta rodada (só o filtro do cliente). Se sobrarem docs sem chave após o fallback, abre-se turno separado.
- Não implementar UI para `consChNFe` em massa (recuperação de docs > 90 dias) — fora do pedido.
- Não mexer em RLS, schema de tabelas, transporte mTLS, manifestação automática.
