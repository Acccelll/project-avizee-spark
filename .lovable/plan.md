# Revisão à luz da NT 2014.002 v1.30

Confrontei a NT oficial WsNFeDistribuicaoDFe com o que está implementado em `sefaz-distdfe`, `sefaz-proxy` e `BuscarPorChaveDialog`. Encontrei divergências objetivas com o leiaute oficial que explicam o `connection reset by peer` e podem causar futuros problemas funcionais.

## Divergências confirmadas

### 1) SOAP 1.2 em vez de SOAP 1.1 (causa raiz mais provável do reset)
- Os três exemplos da NT (distNSU, consNSU, consChNFe) e os exemplos de retorno usam:
  - `xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"` (SOAP 1.1)
  - `Content-Type: text/xml; charset=utf-8`
  - header separado `SOAPAction: "<...>"`
- Nossa edge function `sefaz-distdfe` usa `soap12:Envelope` com namespace `http://www.w3.org/2003/05/soap-envelope` e `Content-Type: application/soap+xml; charset=utf-8; action="..."`.
- O servidor IIS do Ambiente Nacional aceita o endpoint SOAP 1.1 publicado e fecha a conexão para SOAP 1.2 sem responder Fault — exatamente o comportamento que estamos vendo.
- A memória atual do projeto (`mem/features/fiscal-consulta-por-chave.md`) afirma que SOAP 1.2 é obrigatório. Isso está incorreto perante a NT 2014.002.

### 2) `cUFAutor` hardcoded em "91"
- A NT mostra `<cUFAutor>29</cUFAutor>` (BA) — é o código IBGE da UF do **autor** (empresa).
- Nossa montagem usa `91` fixo (código do Ambiente Nacional), o que é semanticamente errado e pode ser rejeitado em mudanças futuras de validação.

### 3) Mensagem de erro da UI mascara causa real
- O texto "instabilidade temporária da Receita / não é problema do A1" induz o usuário ao erro: o portal oficial responde normalmente para a mesma chave.
- A causa real, à luz da NT, é a divergência de envelope SOAP — não o webservice.

### 4) Risco de bloqueio por consumo indevido (656)
- A NT prevê bloqueio de 1h se o usuário fizer mais de 20 consultas `consChNFe` por hora ou ficar repetindo `distNSU` sem avançar `ultNSU`.
- Hoje, o botão "Buscar" pode ser repetido livremente, e a UI sugere "tentar novamente em alguns minutos" — caminho direto para bloqueio do CNPJ.

### 5) Mensagens UI ainda não cobrem o catálogo oficial de cStat
- A UI trata só `137`/`138`. A NT define códigos específicos relevantes:
  - `217` NF-e inexistente, `236` DV inválido, `252` ambiente divergente, `593` CNPJ-base do certificado difere do consultado, `632` fora do prazo de 90 dias, `640/641` interessado sem permissão / NF do próprio emitente, `653/654` cancelada/denegada, `656` consumo indevido.

## Pontos onde estamos conformes
- Namespace `http://www.portalfiscal.inf.br/nfe` no `<distDFeInt>`.
- `versao="1.01"` no `<distDFeInt>`.
- Estrutura `consChNFe > chNFe`.
- mTLS com A1 (Vault) e HTTP/1.1 forçado.
- URLs `www1.nfe.fazenda.gov.br` (produção) e `hom1.nfe.fazenda.gov.br` (homologação).
- Extração do CNPJ do certificado e uso na tag `<CNPJ>`.
- Limite de tamanho do XML (muito abaixo dos 10 KB).

# O que vou implementar

## A) Voltar para SOAP 1.1 conforme a NT
- Em `sefaz-distdfe`:
  - Envelope `xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"`.
  - Header `Content-Type: text/xml; charset=utf-8`.
  - Header separado `SOAPAction: "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse"`.
  - Manter HTTP/1.1.
- Atualizar `mem/features/fiscal-consulta-por-chave.md` removendo a afirmação errada de "SOAP 1.2 obrigatório" e registrando o que a NT realmente exige.

## B) Corrigir `cUFAutor`
- Ler a UF da empresa de `empresa_config.uf` na própria edge function (já temos service-role) e converter para o código IBGE.
- Cair em `91` (AN) só se a UF não estiver configurada — mantendo um fallback seguro, mas avisando no log.

## C) UI honesta + proteção contra consumo indevido (cStat 656)
- Mudar a mensagem de erro do dialog para descrever a causa real quando a SEFAZ devolve cStat conhecido (NT seção 4):
  - 137 / 138 / 217 / 236 / 252 / 593 / 632 / 640 / 641 / 653 / 654 / 656.
- Tratar reset de conexão como erro de transporte real — sem inventar "indisponibilidade da Receita".
- Adicionar throttling client-side de "Buscar por chave" para não exceder o limite previsto pela NT (20/hora por CNPJ), prevenindo bloqueio acidental.

## D) Tratamento do retorno alinhado à NT
- Manter o parser atual de `retDistDFeInt` mas garantir leitura correta de:
  - `cStat`, `xMotivo`, `dhResp`, `ultNSU`, `maxNSU`.
- Mapear cStat → mensagem amigável usando a tabela oficial.

## E) Cobertura de testes
- Testes para garantir que:
  - o envelope gerado é SOAP 1.1 com SOAPAction correto e Content-Type `text/xml`;
  - `cUFAutor` reflete a UF da empresa, com fallback para 91;
  - `consChNFe` produz exatamente o leiaute do exemplo 3 da NT;
  - mensagens de cStat conhecidos são traduzidas corretamente para o usuário;
  - reset de conexão NÃO é mais reportado como "instabilidade SEFAZ".

## Fora de escopo
- Refatorar fluxos não relacionados (consulta de protocolo, autorização).
- Implementar novas funcionalidades além das previstas pela NT.
- Mudar arquitetura do módulo Fiscal.

# Arquivos afetados
- `supabase/functions/sefaz-distdfe/index.ts`
- `src/pages/fiscal/components/BuscarPorChaveDialog.tsx`
- `mem/features/fiscal-consulta-por-chave.md`
- testes da edge function `sefaz-distdfe` e/ou utilitários relacionados

# Resultado esperado
- Requisição passa a estar conforme NT 2014.002 v1.30, removendo a divergência de envelope que provoca o reset no IIS do AN.
- `cUFAutor` semanticamente correto.
- UI deixa de empurrar a culpa para a Receita e protege o usuário do bloqueio por consumo indevido.
- Erros funcionais (cStat) ficam corretamente diferenciados de erros de transporte.
