## Correções para habilitar emissão de NF-e (modelo 55) na SEFAZ

Aplicar as 4 correções (3 obrigatórias + 1 opcional recomendada) nos arquivos indicados. Escopo restrito: apenas o que bloqueia a transmissão da autorização. Nada do restante do módulo fiscal (consulta, DistDFe, eventos, pré-validação) é tocado.

### Arquivos modificados

1. **`src/services/fiscal/sefaz/xmlBuilder.service.ts`**
   - Substituir `construirXMLNFe` para gerar `<enviNFe versao="4.00">` compacto (síncrono, `idLote=1`, `indSinc=1`), sem `<?xml?>` e sem espaços/quebras entre tags (MOC §4.2.1.3).
   - Substituir `buildItem` para aceitar `crt` e delegar o grupo ICMS a um novo helper `buildIcmsGroup`.
   - Adicionar `buildIcmsGroup(item, crt)` com ramos ICMSSN/CSOSN (CRT=1/2) e ICMS/CST (CRT=3). Cobre CSOSN 101/102/103/300/400/500/900.
   - Forçar `dest/xNome = "NF-E EMITIDA EM AMBIENTE DE HOMOLOGACAO - SEM VALOR FISCAL"` quando `tpAmb=2` (regra E04-20 / Rej. 598).
   - Verificar se a função `buildItem` é chamada em outros pontos (testes) e ajustar a assinatura.

2. **`supabase/functions/sefaz-proxy/index.ts`**
   - Substituir `assinarXml` para injetar `xmlns="http://www.portalfiscal.inf.br/nfe"` no `<infNFe>` antes do digest SHA-1 (corrige Rej. 297/298).
   - Na action `assinar-e-enviar-vault`, trocar `enviarSoap(...)` por `enviarSoapMtls(...)` usando `pfxToPem` (cert+key) — mTLS obrigatório (MOC §4.2.2).
   - Em `enviarSoapMtls`, derivar `dadosMsgNs = soapAction.replace(/\/[^/]+$/, "")` e usar no `xmlns:nfe` do `nfeDadosMsg` (passo 4 opcional, recomendado).
   - Manter `enviarSoap` removida ou marcada como morta (sem uso).

3. **`src/services/fiscal/sefaz/autorizacao.service.ts`**
   - Já contém o parsing correto de `protNFe/infProt/cStat` com aceitação de `100` e `150`. Conferir que continua intacto após os demais passos (nenhuma reescrita).

### Pós-implementação

- Re-deploy automático do `sefaz-proxy` (Lovable Cloud).
- Validações sugeridas em homologação (cStat=100, nProt) ficam por conta do usuário com `ambiente_sefaz="2"` e A1 já no Storage.

### Fora de escopo

- Modo assíncrono (`indSinc=0` + `NfeRetAutorizacao`).
- Montagem e persistência do `nfeProc` autorizado.
- Validação XSD local.
- `vTotTrib` por item.
- Ajustes em `nfeBuilders.service.ts` para popular CSOSN a partir do cadastro (só necessário se a empresa for Simples Nacional — fica como follow-up condicional).
