# CT-e e NFS-e — contratos operacionais 2026

## Escopo desta entrega

O recebimento fiscal de CT-e e NFS-e passa a seguir o mesmo princípio já usado para NF-e: **receber/importar → interpretar → conferir → confirmar**. Importação e distribuição automática nunca geram, sozinhas, efeito financeiro, estoque ou rateio definitivo.

## CT-e

- Modelo 57 é CT-e de cargas (`cte`); modelo 67 é CT-e OS (`cte_os`).
- O XML original é preservado no Storage.
- `cte_nfe_referencias` é a relação canônica CT-e ↔ NF-e; `cte_chave_nfe_ref` permanece como compatibilidade/cache do documento.
- `cte_rateios` é o ledger canônico de apropriação de frete. Um rateio confirmado sempre possui origem, valor e estado de estorno.
- Rateio é **fail-closed**: se uma única NF-e referenciada ainda não estiver localizada, o financeiro do CT-e pode ser confirmado, mas nenhum subconjunto é rateado. Quando a última NF-e chegar, o vínculo é reprocessado e o rateio pode ser aplicado sem alterar a proporção original.
- Estorno subtrai exatamente os valores do ledger ativo e preserva os registros como `estornado`.

### Distribuição DF-e

O Ambiente Nacional do CT-e publica o serviço `CTeDistribuicaoDFe` versão 1.00. Em produção o endpoint oficial publicado é `https://www1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx`; em homologação, `https://hom1.cte.fazenda.gov.br/CTeDistribuicaoDFe/CTeDistribuicaoDFe.asmx`.

A implementação desta entrega:

- usa `cte_distdfe_sync`, separado do cursor da NF-e;
- reutiliza o Worker mTLS existente (`SEFAZ_MTLS_PROXY_URL/SECRET`);
- permanece **OFF por padrão** (`CTE_DISTDFE_ENABLED=false`);
- exige homologação do SOAP Action/configuração antes de ativação produtiva;
- materializa documentos recebidos como rascunhos/pendentes, nunca confirmados.

## NFS-e

O domínio normalizado usa:

- cabeçalho comum em `notas_fiscais`;
- campos essenciais do serviço (LC 116, NBS, competência, município, ISS);
- `nfse_retencoes` para ISS, INSS, IRRF, PIS, COFINS, CSLL e preparação de IBS/CBS;
- `nfse_dados_extras` para conteúdo de layout que ainda não tenha uso operacional no ERP;
- `nfse_layout_origem`, `nfse_versao_layout` e `nfse_provedor_origem` para rastrear o parser/origem.

### Valor informado x valor calculado

Em documento importado o XML é evidência e não é sobrescrito silenciosamente. O ERP mantém, quando aplicável:

- `nfse_valor_iss_informado` — valor recebido no documento;
- `nfse_valor_iss_calculado` — conferência interna;
- divergência visual quando a diferença superar a tolerância de arredondamento.

### Retenções

O líquido do fornecedor é:

`valor bruto - retenções retidas que reduzem o valor do fornecedor`.

Obrigação tributária só vira título financeiro quando a empresa é responsável pelo recolhimento **e existe vencimento conhecido**. O ERP não inventa calendário fiscal.

Estorno preserva retenções anteriores como `estornada` e cancela os títulos vinculados por meio do fluxo financeiro canônico.

## NFS-e padrão nacional e 2026

A documentação de produção do Portal Nacional, atualizada em 2026, publica esquemas XSD v1.01 e anexos de domínio para NBS/lista nacional e indicadores IBS/CBS. A evolução da RTC continua versionada; portanto o ERP não presume que toda Nota Técnica futura já esteja implantada no ambiente consultado.

Regras adotadas:

1. campos usados operacionalmente são normalizados;
2. grupos futuros/desconhecidos são preservados em extras;
3. NBS/IBS/CBS são opcionais no parser, nunca motivo isolado para quebrar uma importação antiga;
4. validações possuem severidade `ok/aviso/erro` e não bloqueiam por campo futuro não aplicável;
5. provider nacional/ADN está preparado atrás de feature flag, sem chamadas automáticas até a integração ser homologada.

Referências oficiais consultadas em agosto/2026:

- Portal CT-e — Web Services: https://www.cte.fazenda.gov.br/portal/webServices.aspx
- Portal CT-e — Schemas XML: https://www.cte.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=0xlG1bdBass%3D
- Portal NFS-e — Documentação Atual (Produção): https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/documentacao-atual
- Portal NFS-e — RTC: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/rtc/rtc

## Feature flags

| Flag | Default | Função |
|---|---:|---|
| `CTE_DISTDFE_ENABLED` | `false` | Habilita consulta automática ao Ambiente Nacional CT-e |
| `VITE_NFSE_ADN_ENABLED` | `false` | Expõe integração ADN como habilitada na UI/client |
| `VITE_NFSE_ADN_ENDPOINT` | vazio | Endpoint configurado para futura consulta ADN |

## Limites conhecidos

- A importação XML CT-e/NFS-e é tolerante a namespaces e cobre os campos operacionais normalizados; campos específicos de provedores municipais não reconhecidos continuam preservados quando disponíveis, mas podem exigir adapter dedicado.
- Consulta automática ao ADN da NFS-e não é ativada nesta entrega; o provider existe para evitar acoplamento futuro ao formulário.
- Distribuição CT-e depende da configuração/homologação do Worker mTLS e do SOAP Action no ambiente da empresa. O código permanece fail-closed até isso ocorrer.
